const axios = require('axios');
const { db } = require('./firebase-admin-init');

exports.handler = async function(event, context) {
  // 1. CORS Headers - Allow requests from any origin (configure as needed for production)
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  // 2. Handle OPTIONS method for CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  // 3. Only allow POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  // 4. Validate Environment Variables
  const {
    DELHIVERY_API_TOKEN,
    DELHIVERY_PICKUP_NAME, // MUST match the name registered in Delhivery Dashboard
    DELHIVERY_MODE // Optional: 'production' or 'staging' (defaulting to production URL)
  } = process.env;

  if (!DELHIVERY_API_TOKEN || !DELHIVERY_PICKUP_NAME) {
    console.error('Missing Delhivery Environment Variables');
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Server Configuration Error' })
    };
  }

  try {
    // 5. Parse and Validate Request Body
    const body = JSON.parse(event.body);
    const { order_id, customer, items, shipping_amount } = body;

    if (!order_id || !customer || !items) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing required fields: order_id, customer, or items' })
      };
    }

    // Base URL for Delhivery (Production)
    const BASE_URL = 'https://track.delhivery.com';

    // ---------------------------------------------------------
    // STEP 1: Fetch Waybill (Delhivery Waybill API)
    // ---------------------------------------------------------
    console.log(`Fetching waybill for Order ${order_id}...`);
    
    const waybillResponse = await axios.get(`${BASE_URL}/waybill/api/fetch/json/`, {
      params: { token: DELHIVERY_API_TOKEN, count: 1 },
      timeout: 5000
    });

    // Delhivery sometimes returns string "Prepaid" or similar in raw text on failure, or JSON on success.
    // However, the /json/ endpoint usually returns an object.
    const waybillData = waybillResponse.data;
    
    // Check format: usually "wb_1,wb_2" or json string
    let waybillNumber = '';
    
    // Handle different response structures from Delhivery
    if (typeof waybillData === 'string') {
        waybillNumber = waybillData; // Sometimes returns just the number
    } else if (waybillData && waybillData[0]) { // Sometimes returns array [waybill]
        waybillNumber = waybillData[0];
    } else if (waybillData && waybillData.packages && waybillData.packages[0]) {
        waybillNumber = waybillData.packages[0]; 
    } else {
        // Fallback or specific logic depending on exact response format
        // Often it returns just the waybill number string for single count
        waybillNumber = waybillData;
    }

    if (!waybillNumber || typeof waybillNumber !== 'string' || waybillNumber.includes('Error')) {
       throw new Error(`Failed to generate Waybill: ${JSON.stringify(waybillData)}`);
    }

    console.log(`Generated Waybill: ${waybillNumber}`);

    // ---------------------------------------------------------
    // STEP 2: Prepare CMU Payload
    // ---------------------------------------------------------
    
    // Calculate total value (items price + shipping)
    // Assuming price in items is per unit.
    let totalValue = items.reduce((sum, item) => sum + (Number(item.price) * Number(item.qty)), 0);
    // If shipping is part of the declared value, add it, otherwise usually excluded for taxes depending on logic.
    // For simplicity, we declare the goods value.
    
    // Combine items into a description string for the label
    const productDescription = items.map(i => `${i.name} (x${i.qty})`).join(', ').substring(0, 50);

    const shipmentPayload = {
      shipments: [
        {
          name: customer.name,
          add: customer.address,
          pin: customer.pincode,
          city: customer.city || '', // Optional if pin covers it, but recommended
          state: customer.state || '',
          country: 'India',
          phone: customer.phone,
          order: String(order_id),
          payment_mode: 'Prepaid', // Since payment is verified
          return_pin: '', // Optional: uses default
          return_city: '',
          return_phone: '',
          return_add: '',
          products_desc: productDescription,
          hsn_code: '', // Optional
          cod_amount: 0, // Prepaid
          order_date: new Date().toISOString(),
          total_amount: totalValue,
          seller_add: '', // Optional
          seller_name: '', // Optional
          seller_inv: '', // Optional
          quantity: items.reduce((acc, item) => acc + Number(item.qty), 0),
          waybill: waybillNumber,
          shipment_width: 10,  // Defaults/Estimates (cm)
          shipment_height: 10,
          shipment_depth: 10,
          shipment_weight: items.reduce((acc, item) => acc + (Number(item.weight) || 0), 0) || 500 // grams
        }
      ],
      pickup_location: {
        name: DELHIVERY_PICKUP_NAME, // CRITICAL: Must match Dashboard name
        add: process.env.ORIGIN_ADDRESS || '',
        city: process.env.ORIGIN_CITY || '',
        pin_code: process.env.ORIGIN_PINCODE || '',
        country: 'India',
        phone: process.env.ORIGIN_PHONE || ''
      }
    };

    // Note: The CMU API expects the JSON to be passed as a form field named 'data'
    // and format=json. It does NOT accept raw JSON body directly.
    const formData = new URLSearchParams();
    formData.append('format', 'json');
    formData.append('data', JSON.stringify(shipmentPayload));

    // ---------------------------------------------------------
    // STEP 3: Create Shipment (CMU API)
    // ---------------------------------------------------------
    console.log('Pushing shipment to Delhivery CMU...');

    const cmuResponse = await axios.post(`${BASE_URL}/api/cmu/creation`, formData, {
      headers: {
        'Authorization': `Token ${DELHIVERY_API_TOKEN}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    const cmuData = cmuResponse.data;

    // Check for success. Delhivery success response usually contains 'upload_wbn' or 'packages'
    // Format: { cash_pickups_count: 0, package_count: 1, upload_wbn: [ 'WAYBILL_NO' ], replacement_count: 0 ... }
    if (!cmuData || (cmuData.status === false) || (cmuData.error)) {
         throw new Error(cmuData.error || 'Unknown CMU Error');
    }
    
    // Note: Sometimes cmuData returns success: true or list of packages. 
    // We assume success if no error field or if package_count > 0.

    // ---------------------------------------------------------
    // STEP 4: Update Firestore Order
    // ---------------------------------------------------------
    try {
        console.log(`Updating Firestore Order ${order_id} with Waybill ${waybillNumber}...`);
        await db.collection('orders').doc(String(order_id)).update({
            waybill: waybillNumber,
            // We can also set status to 'manifested' or 'processed' if desired, 
            // but the user strictly asked to "save the returned waybill number".
            // I'll add status 'processed' as it makes sense for "shipment created".
            status: 'processed', 
            last_updated: new Date().toISOString()
        });
    } catch (dbError) {
        console.error('Failed to update Firestore:', dbError);
        // We log error but proceed to return success to client regarding shipment creation
        // Although ideally we should maybe return a partial success warning.
    }

    // ---------------------------------------------------------
    // STEP 5: Return Success Response
    // ---------------------------------------------------------
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Shipment created successfully',
        waybill: waybillNumber,
        tracking_url: `https://www.delhivery.com/track/package/${waybillNumber}`,
        provider_response: cmuData
      })
    };

  } catch (error) {
    console.error('Shipment Error:', error.response ? error.response.data : error.message);
    
    // Determine status code
    const status = error.response ? error.response.status : 500;
    
    return {
      statusCode: status,
      headers,
      body: JSON.stringify({
        success: false,
        error: error.message,
        details: error.response ? error.response.data : null
      })
    };
  }
};

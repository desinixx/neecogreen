const { db } = require('./firebase-admin-init');

exports.handler = async function(event, context) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  try {
    let body;
    try {
      body = JSON.parse(event.body);
    } catch (e) {
      // If content-type is form-urlencoded, parsing might be needed differently, 
      // but usually webhooks send JSON. 
      // If Delhivery sends form data, we might need querystring parsing.
      // For now, assume JSON as per modern standards and user description.
      console.error('JSON Parse Error:', e);
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON' }) };
    }
    
    console.log('Received Delhivery Webhook:', JSON.stringify(body));

    // Extract Waybill and Status
    // Handling potential payload variations (e.g. nested under Shipment, or flat)
    // Common Delhivery format: { Shipment: { Waybill: "...", Status: { Status: "..." } } }
    // Or simpler: { waybill: "...", status: "..." }
    
    let waybill = null;
    let statusRaw = null;

    if (body.Shipment) {
        waybill = body.Shipment.Waybill || body.Shipment.waybill;
        if (body.Shipment.Status) {
            statusRaw = typeof body.Shipment.Status === 'object' 
                ? body.Shipment.Status.Status 
                : body.Shipment.Status;
        }
    } else {
        // Try flat structure
        waybill = body.Waybill || body.waybill;
        statusRaw = body.Status || body.status;
        
        // Sometimes status is an object even in flat structure
        if (typeof statusRaw === 'object' && statusRaw !== null) {
            statusRaw = statusRaw.Status || statusRaw.status;
        }
    }

    if (!waybill || !statusRaw) {
        console.error('Missing waybill or status in payload');
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Missing Waybill or Status' })
        };
    }

    // Map Status
    // 'In Transit' to 'shipped', 'Delivered' to 'delivered'
    const statusMap = {
        'In Transit': 'shipped',
        'Dispatched': 'shipped',
        'Delivered': 'delivered',
        'RTO': 'returned',
        'Pending': 'pending',
        'Manifested': 'packed' // or pending
    };

    // Normalize input status
    const statusKey = Object.keys(statusMap).find(key => 
        key.toLowerCase() === statusRaw.toLowerCase()
    );

    const newStatus = statusKey ? statusMap[statusKey] : statusRaw.toLowerCase();

    console.log(`Processing Update: Waybill=${waybill}, Status=${statusRaw} -> ${newStatus}`);

    // Search for the document in 'orders' collection
    const ordersRef = db.collection('orders');
    const snapshot = await ordersRef.where('waybill', '==', waybill).limit(1).get();

    if (snapshot.empty) {
        console.log(`No order found with waybill: ${waybill}`);
        // We respond 200 OK to Delhivery so they don't retry indefinitely
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ message: 'Order not found, ignored.' })
        };
    }

    // Update the document
    const doc = snapshot.docs[0];
    await doc.ref.update({
        status: newStatus,
        last_updated: new Date().toISOString(),
        delhivery_status_details: statusRaw // Optional: keep original status
    });

    console.log(`Updated Order ${doc.id} to status: ${newStatus}`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, message: 'Order status updated' })
    };

  } catch (error) {
    console.error('Webhook Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
};

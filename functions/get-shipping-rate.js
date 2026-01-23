const axios = require('axios');

exports.handler = async function(event, context) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

  try {
    const { pincode, weight } = JSON.parse(event.body);

    if (!pincode || pincode.length !== 6) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: "Invalid Pincode" }) };
    }

    const ORIGIN_PIN = "560001"; 
    const weightInGrams = Math.ceil((weight || 0.5) * 1000);
    
    // Delhivery API (Surface, Delivered, Prepaid)
    const url = `https://track.delhivery.com/api/kinko/v1/invoice/charges/.json?md=S&ss=Delivered&d_pin=${pincode}&o_pin=${ORIGIN_PIN}&cgm=${weightInGrams}&pt=Prepaid`;

    const response = await axios.get(url, {
      headers: {
        'Authorization': `Token ${process.env.DELHIVERY_API_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    const shippingAmount = response.data[0]?.total_amount;

    if (shippingAmount === undefined) throw new Error("No rate returned");

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ shipping: parseFloat(shippingAmount) })
    };

  } catch (error) {
    console.error("Delhivery Error:", error.message);
    // Fallback rate for safety
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ shipping: 150 }) 
    };
  }
};
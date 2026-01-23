const axios = require('axios');

exports.handler = async function(event, context) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };
  
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

  try {
    const orderData = JSON.parse(event.body);
    // Logic to create shipment with Delhivery
    // ... (Use previous implementation)
    return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
  } catch (error) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: "Shipment Failed" }) };
  }
};
const axios = require('axios');

exports.handler = async function(event, context) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  const { waybill } = event.queryStringParameters;
  const { DELHIVERY_API_TOKEN } = process.env;

  if (!waybill) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Missing waybill parameter' })
    };
  }

  if (!DELHIVERY_API_TOKEN) {
    console.error('Missing DELHIVERY_API_TOKEN env var');
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Server configuration error' })
    };
  }

  try {
    const response = await axios.get('https://track.delhivery.com/api/v1/packages/json/', {
      params: {
        waybill: waybill,
        token: DELHIVERY_API_TOKEN
      }
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(response.data)
    };

  } catch (error) {
    console.error('Delhivery API Error:', error.message);
    return {
      statusCode: error.response ? error.response.status : 500,
      headers,
      body: JSON.stringify({ 
        error: 'Failed to fetch tracking data', 
        details: error.message 
      })
    };
  }
};

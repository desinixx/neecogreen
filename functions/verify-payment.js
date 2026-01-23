const crypto = require('crypto');

exports.handler = async function(event, context) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = JSON.parse(event.body);
    const body = razorpay_order_id + "|" + razorpay_payment_id;

    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest('hex');

    if (expectedSignature === razorpay_signature) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ status: "success" })
      };
    } else {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ status: "failure" })
      };
    }
  } catch (error) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: "Verification Error" }) };
  }
};
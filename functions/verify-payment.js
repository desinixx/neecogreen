const crypto = require('crypto');

/**
 * verify-payment.js
 * * Verifies Razorpay Payment Signature for Production.
 * Requirements: 
 * - RAZORPAY_KEY_SECRET environment variable must be set.
 */

exports.handler = async function(event, context) {
  const headers = {
    'Access-Control-Allow-Origin': '*', // Adjust to your domain in production
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // 1. Handle CORS Preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  // 2. Only allow POST
  if (event.httpMethod !== 'POST') {
    return { 
      statusCode: 405, 
      headers, 
      body: JSON.stringify({ error: "Method Not Allowed" }) 
    };
  }

  try {
    const secret = process.env.RAZORPAY_KEY_SECRET;
    if (!secret) {
      console.error("Critical: RAZORPAY_KEY_SECRET is not defined.");
      return { 
        statusCode: 500, 
        headers, 
        body: JSON.stringify({ error: "Internal Server Configuration Error" }) 
      };
    }

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = JSON.parse(event.body);

    // 3. Input Validation
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return { 
        statusCode: 400, 
        headers, 
        body: JSON.stringify({ status: "failure", message: "Missing required fields" }) 
      };
    }

    // 4. Duplicate Check (Idempotency)
    // NOTE: In a real production app, you should check your database here.
    // Example: 
    // const existingPayment = await db.collection('payments').doc(razorpay_payment_id).get();
    // if (existingPayment.exists) return { statusCode: 200, headers, body: JSON.stringify({ status: "success", duplicate: true }) };

    // 5. Generate Expected Signature
    const data = `${razorpay_order_id}|${razorpay_payment_id}`;
    const generatedSignature = crypto
      .createHmac('sha256', secret)
      .update(data)
      .digest('hex');

    // 6. Security: Constant-Time Comparison
    // Prevents timing attacks where an attacker guesses the signature character by character
    const isSignatureValid = crypto.timingSafeEqual(
      Buffer.from(generatedSignature),
      Buffer.from(razorpay_signature)
    );

    if (isSignatureValid) {
      // 7. Success - Update Database
      console.log(`Payment Verified Successfully: ${razorpay_payment_id} for Order: ${razorpay_order_id}`);
      
      /**
       * DB LOGIC HERE:
       * await db.collection('orders').doc(razorpay_order_id).update({
       * status: 'paid',
       * payment_id: razorpay_payment_id,
       * verified_at: new Date().toISOString()
       * });
       */

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          status: "success", 
          message: "Payment verified successfully" 
        })
      };
    } else {
      // 8. Signature Mismatch
      console.warn(`Invalid Signature Attempt for Order: ${razorpay_order_id}`);
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          status: "failure", 
          message: "Invalid payment signature" 
        })
      };
    }

  } catch (error) {
    console.error("Verification Function Error:", error.message);
    return { 
      statusCode: 500, 
      headers, 
      body: JSON.stringify({ error: "Verification system failed", message: error.message }) 
    };
  }
};
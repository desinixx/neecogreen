const admin = require('firebase-admin');

// Initialize Firebase Admin only once
if (!admin.apps.length) {
  try {
    let serviceAccount;
    
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      // If the entire JSON key is provided in one variable
      serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    } else {
      // Fallback to individual variables
      serviceAccount = {
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        // Handle escaped newlines in private key if they exist
        privateKey: process.env.FIREBASE_PRIVATE_KEY 
          ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') 
          : undefined,
      };
    }

    // Check if we have enough credentials
    if (!serviceAccount.projectId && !serviceAccount.clientEmail && !serviceAccount.privateKey && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
         console.warn("No specific Firebase credentials found in env. Relying on default Google Cloud context if available.");
         admin.initializeApp();
    } else {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
    }

  } catch (error) {
    console.error('Firebase Admin Initialization Error:', error.message);
  }
}

const db = admin.firestore();

module.exports = { db };

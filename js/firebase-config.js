// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyA9I8tDpTuDasrUCAKvdQlfHeuM485SHiA",
  authDomain: "neecogreen-52d52.firebaseapp.com",
  projectId: "neecogreen-52d52",
  storageBucket: "neecogreen-52d52.firebasestorage.app",
  messagingSenderId: "749084953737",
  appId: "1:749084953737:web:3e53aa2b197d22d3bfca58"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db };

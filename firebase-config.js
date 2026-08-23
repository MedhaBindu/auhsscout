// Import the functions you need from the SDKs you need using correct CDN links
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDt7Z-MScRwH3NEYZb8C4aJDL6Q32WFldk",
  authDomain: "auhs-scout.firebaseapp.com",
  projectId: "auhs-scout",
  storageBucket: "auhs-scout.firebasestorage.app",
  messagingSenderId: "202185981408",
  appId: "1:202185981408:web:34464ba2f098c8b589ff85",
  measurementId: "G-K8L7JY63M5"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Services with custom names
const realdb = getDatabase(app);
const firedb = getFirestore(app);

// Export for use in other files
export { realdb, firedb };

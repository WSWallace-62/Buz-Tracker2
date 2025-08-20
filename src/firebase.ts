// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyC5jKXUPs3f7MXbapg62d54PwxdFWIEBzk",
  authDomain: "buz-tracker-fd3e3.firebaseapp.com",
  projectId: "buz-tracker-fd3e3",
  storageBucket: "buz-tracker-fd3e3.firebasestorage.app",
  messagingSenderId: "1041547886894",
  appId: "1:1041547886894:web:d774d506c22c1b17eafabf",
  measurementId: "G-ZCEDT2MCL1"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);

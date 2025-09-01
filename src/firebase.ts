// src/firebase.ts
import { initializeApp } from "firebase/app";
import { getFirestore, Firestore } from "firebase/firestore";
import { getStorage, FirebaseStorage } from "firebase/storage";
import {
  initializeAuth,
  indexedDBLocalPersistence,
  Auth,
} from "firebase/auth";

// Get Firebase config from Vite environment variables
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: "buz-tracker-fd3e3.firebaseapp.com",
  projectId: "buz-tracker-fd3e3",
  storageBucket: "buz-tracker-fd3e3.appspot.com",
  messagingSenderId: "1041547886894",
  appId: "1:1041547886894:web:d774d506c22c1b17eafabf",
  measurementId: "G-ZCEDT2MCL1"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize services
let auth: Auth;
let db: Firestore;
let storage: FirebaseStorage;

// Initialize Firebase services only in the browser environment
if (typeof window !== 'undefined') {
  auth = initializeAuth(app, {
    persistence: indexedDBLocalPersistence,
  });
  db = getFirestore(app);
  storage = getStorage(app);
}

export { auth, db, storage };

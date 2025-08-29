// wswallace-62/buz-tracker2/Buz-Tracker2-Logouts-still-happening/src/firebase.ts
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
  storageBucket: "buz-tracker-fd3e3.firebasestorage.app",
  messagingSenderId: "1041547886894",
  appId: "1:1041547886894:web:d774d506c22c1b17eafabf",
  measurementId: "G-ZCEDT2MCL1"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize services
// FIX: Initialize Auth with explicit persistence to avoid race conditions
// and ensure the session is stored in IndexedDB for long-term persistence.
export const auth: Auth = initializeAuth(app, {
  persistence: indexedDBLocalPersistence,
});

export const db: Firestore = getFirestore(app);
export const storage: FirebaseStorage = getStorage(app);
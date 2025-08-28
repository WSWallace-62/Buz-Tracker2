// src/firebase.ts
import { initializeApp } from "firebase/app";
import { getAuth, Auth } from "firebase/auth";
import { getFirestore, Firestore } from "firebase/firestore";
import { getStorage, FirebaseStorage } from "firebase/storage";

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
export const auth: Auth = getAuth(app);
export const db: Firestore = getFirestore(app);
export const storage: FirebaseStorage = getStorage(app);

// Create a promise that resolves when auth state is first determined
export const firebaseInitializedPromise = new Promise<void>((resolve) => {
  const unsubscribe = auth.onAuthStateChanged(() => {
    unsubscribe();
    resolve();
  });
});
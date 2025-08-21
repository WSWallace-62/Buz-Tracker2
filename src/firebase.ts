// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth, Auth } from "firebase/auth";
import { getFirestore, Firestore } from "firebase/firestore";
import { getStorage, FirebaseStorage } from "firebase/storage";

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional\n
// Initialize Firebase
// Export a promise that resolves after Firebase initialization with a specific name
export const firebaseInitializedPromise = (async () => {
  // Fetch the Firebase API key from the deployed Cloud Run service.
  // Ensure the service account running the Cloud Run service has the "Secret Manager Secret Accessor" role.
  const response = await fetch('https://getapikey-5qdwpuzi5q-uc.a.run.app');
  const { apiKey } = await response.json();
  const firebaseConfig = {
    apiKey: apiKey,
    authDomain: "buz-tracker-fd3e3.firebaseapp.com",
    projectId: "buz-tracker-fd3e3",
    storageBucket: "buz-tracker-fd3e3.firebasestorage.app",
    messagingSenderId: "1041547886894",
    appId: "1:1041547886894:web:d774d506c22c1b17eafabf",
    measurementId: "G-ZCEDT2MCL1"
  };

  const app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  auth = getAuth(app);
  storage = getStorage(app);

  // The promise resolves implicitly after the assignments
})(); // Immediately invoke the async function

export let db: Firestore | undefined = undefined;
export let auth: Auth | undefined = undefined;
export let storage: FirebaseStorage | undefined = undefined;
// public/firebase-messaging-sw.js

// Imports for Firebase. Using the compat libraries because this is a traditional service worker.
importScripts('https://www.gstatic.com/firebasejs/9.15.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.15.0/firebase-messaging-compat.js');

// NOTE: This file is not processed by Vite, so we cannot use import.meta.env.
// The VITE_FIREBASE_API_KEY from your .env file needs to be manually inserted here.
const firebaseConfig = {
  apiKey: "AIzaSyC5jKXUPs3f7MXbapg62d54PwxdFWIEBzk",
  authDomain: "buz-tracker-fd3e3.firebaseapp.com",
  projectId: "buz-tracker-fd3e3",
  storageBucket: "buz-tracker-fd3e3.appspot.com",
  messagingSenderId: "1041547886894",
  appId: "1:1041547886894:web:d774d506c22c1b17eafabf",
  measurementId: "G-ZCEDT2MCL1"
};

// Initialize Firebase
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

// Retrieve an instance of Firebase Messaging so that it can handle background
// messages.
const messaging = firebase.messaging();

// Optional: Add a background message handler.
// This will be triggered when the app is in the background or closed.
messaging.onBackgroundMessage((payload) => {
  console.log(
    '[firebase-messaging-sw.js] Received background message ',
    payload,
  );

  // Customize notification here from the data payload
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/pwa-192x192.png',
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

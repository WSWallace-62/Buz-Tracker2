// src/notifications.ts
import { messaging, auth, db as firestoreDb } from './firebase';
import { getToken } from 'firebase/messaging';
import { doc, setDoc } from 'firebase/firestore';

// IMPORTANT: Replace this with your actual VAPID key from the Firebase console.
// This key is used to authenticate your app with web push services.
const VAPID_KEY = 'BI3FpN9JNmJHVaJxz1Nhr9zSbXK_VpYzmW-Swq3KvKHYqzByB3IYblTn-lPt4dqAyhaAcjIcyM4eltqBufEpsss';

/**
 * Requests permission from the user to show notifications and then
 * retrieves the unique FCM registration token for this device.
 *
 * @returns The FCM token string if permission is granted and a token is available, otherwise null.
 */

/**
 * Saves the given FCM token to the user's document in Firestore.
 * @param token The FCM registration token to save.
 */
export const saveFCMToken = async (token: string): Promise<void> => {
  if (!auth?.currentUser || !firestoreDb) {
    console.log("User not logged in or Firestore not available. Skipping token save.");
    return;
  }
  try {
    const userId = auth.currentUser.uid;
    // Use the token as the document ID to prevent duplicates for the same device.
    const tokenDocRef = doc(firestoreDb, 'users', userId, 'fcmTokens', token);
    await setDoc(tokenDocRef, {
      token: token,
      createdAt: new Date().toISOString(),
    });
    console.log('FCM token saved to Firestore.');
  } catch (error) {
    console.error('Error saving FCM token to Firestore:', error);
  }
};

export const requestNotificationPermission = async (): Promise<string | null> => {
  // First, check if messaging is available. It might not be in non-browser environments.
  if (!messaging) {
    console.error('Firebase Messaging has not been initialized.');
    return null;
  }

  try {
    // Request permission from the user.
    const permission = await Notification.requestPermission();

    if (permission === 'granted') {
      console.log('Notification permission granted.');

      // Get the token.
      const currentToken = await getToken(messaging, { vapidKey: VAPID_KEY });

      if (currentToken) {
        console.log('FCM Token retrieved:', currentToken);
        // Save the token to Firestore.
        await saveFCMToken(currentToken);
        return currentToken;
      } else {
        // This can happen if the browser doesn't support push notifications,
        // or if there's an issue with the service worker.
        console.log('No registration token available. A problem occurred during token generation.');
        return null;
      }
    } else {
      console.log('User denied notification permission.');
      return null;
    }
  } catch (err) {
    console.error('An error occurred while requesting permission or retrieving the token.', err);
    return null;
  }
};

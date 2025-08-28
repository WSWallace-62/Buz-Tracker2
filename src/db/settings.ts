// wswallace-62/buz-tracker2/Buz-Tracker2-Github-errors/src/db/settings.ts

import { collection, getDocs, addDoc, updateDoc, doc } from "firebase/firestore";
import { db } from "../firebase";

export interface Settings {
  id: string;
  lastProjectId?: string;
  theme: 'light' | 'dark';
  stopwatchPrecisionMs: number;
}

// Helper to get the user-specific settings collection
const getSettingsCollection = (userId: string) => {
  if (!db) throw new Error("Firestore is not initialized");
  return collection(db, `users/${userId}/settings`);
};


export const getSettings = async (userId: string): Promise<Settings | null> => {
  const snapshot = await getDocs(getSettingsCollection(userId));
  if (snapshot.empty) {
    return null;
  }
  const settingsDoc = snapshot.docs[0];
  return { id: settingsDoc.id, ...settingsDoc.data() } as Settings;
};

export const addSettings = async (userId: string, settings: Omit<Settings, 'id'>) => {
  const docRef = await addDoc(getSettingsCollection(userId), settings);
  return { ...settings, id: docRef.id };
};

export const updateSettings = async (userId: string, id: string, updates: Partial<Settings>) => {
  if (!db) throw new Error("Firestore is not initialized");
  const settingsDoc = doc(db, `users/${userId}/settings`, id);
  await updateDoc(settingsDoc, updates);
};

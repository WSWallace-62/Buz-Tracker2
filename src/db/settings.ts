import { collection, getDocs, addDoc, updateDoc, doc } from "firebase/firestore";
// Corrected import path
import { db } from "../firebase";

export interface Settings {
  id: string;
  lastProjectId?: string;
  theme: 'light' | 'dark';
  stopwatchPrecisionMs: number;
}

export const getSettings = async (): Promise<Settings | null> => {
  if (!db) throw new Error("Firestore is not initialized");

  const settingsCollection = collection(db, "settings");
  const snapshot = await getDocs(settingsCollection);
  if (snapshot.empty) {
    return null;
  }
  const settingsDoc = snapshot.docs[0];
  return { id: settingsDoc.id, ...settingsDoc.data() } as Settings;
};

export const addSettings = async (settings: Omit<Settings, 'id'>) => {
  if (!db) throw new Error("Firestore is not initialized");

  const settingsCollection = collection(db, "settings");
  const docRef = await addDoc(settingsCollection, settings);
  return { ...settings, id: docRef.id };
};

export const updateSettings = async (id: string, updates: Partial<Settings>) => {
  if (!db) throw new Error("Firestore is not initialized");

  const settingsDoc = doc(db, "settings", id);
  await updateDoc(settingsDoc, updates);
};

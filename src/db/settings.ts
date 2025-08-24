import { collection, getDocs, addDoc, updateDoc, doc } from "firebase/firestore";
// 1. Import the promise from the corrected path
import { db, firebaseInitializedPromise } from "../firebase";

export interface Settings {
  id: string;
  lastProjectId?: string;
  theme: 'light' | 'dark';
  stopwatchPrecisionMs: number;
}

export const getSettings = async (): Promise<Settings | null> => {
  // 2. Wait for initialization and add the type guard
  await firebaseInitializedPromise;
  if (!db) throw new Error("Firestore is not initialized");

  // 3. Define the collection reference inside the function
  const settingsCollection = collection(db, "settings");
  const snapshot = await getDocs(settingsCollection);
  if (snapshot.empty) {
    return null;
  }
  const settingsDoc = snapshot.docs[0];
  return { id: settingsDoc.id, ...settingsDoc.data() } as Settings;
};

export const addSettings = async (settings: Omit<Settings, 'id'>) => {
  await firebaseInitializedPromise;
  if (!db) throw new Error("Firestore is not initialized");

  const settingsCollection = collection(db, "settings");
  const docRef = await addDoc(settingsCollection, settings);
  return { ...settings, id: docRef.id };
};

export const updateSettings = async (id: string, updates: Partial<Settings>) => {
  await firebaseInitializedPromise;
  if (!db) throw new Error("Firestore is not initialized");

  const settingsDoc = doc(db, "settings", id);
  await updateDoc(settingsDoc, updates);
};

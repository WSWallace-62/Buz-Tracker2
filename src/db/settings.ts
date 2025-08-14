import { collection, getDocs, addDoc, updateDoc, doc } from "firebase/firestore";
import { db } from "../firebase";

export interface Settings {
  id: string
  lastProjectId?: string
  theme: 'light' | 'dark'
  stopwatchPrecisionMs: number
}

const settingsCollection = collection(db, "settings");

export const getSettings = async (): Promise<Settings | null> => {
  const snapshot = await getDocs(settingsCollection);
  if (snapshot.empty) {
    return null;
  }
  const doc = snapshot.docs[0];
  return { id: doc.id, ...doc.data() } as Settings;
};

export const addSettings = async (settings: Omit<Settings, 'id'>) => {
  const docRef = await addDoc(settingsCollection, settings);
  return { ...settings, id: docRef.id };
};

export const updateSettings = async (id: string, updates: Partial<Settings>) => {
  const settingsDoc = doc(db, "settings", id);
  await updateDoc(settingsDoc, updates);
};

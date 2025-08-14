import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from "firebase/firestore";
import { db } from "../firebase";

export interface Session {
  id: string
  projectId: string
  start: number
  stop: number | null
  durationMs: number
  note?: string
  createdAt: number
}

const sessionsCollection = collection(db, "sessions");

export const getSessions = async (): Promise<Session[]> => {
  const snapshot = await getDocs(sessionsCollection);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Session));
};

export const addSession = async (session: Omit<Session, 'id'>) => {
  const docRef = await addDoc(sessionsCollection, session);
  return { ...session, id: docRef.id };
};

export const updateSession = async (id: string, updates: Partial<Session>) => {
  const sessionDoc = doc(db, "sessions", id);
  await updateDoc(sessionDoc, updates);
};

export const deleteSession = async (id: string) => {
  const sessionDoc = doc(db, "sessions", id);
  await deleteDoc(sessionDoc);
};

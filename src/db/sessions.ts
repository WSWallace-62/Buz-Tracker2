import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, CollectionReference, DocumentReference } from "firebase/firestore";
import { db } from "../firebase";
import { getAuth } from "firebase/auth";

export interface Session {
  id: string
  projectId: string
  start: number
  stop: number | null
  durationMs: number
  note?: string
  createdAt: number
}

export const getSessions = async (): Promise<Session[]> => {
  const user = getAuth().currentUser;
  if (!user) {
 throw new Error("User not authenticated.");
  }
  const sessionsCollection = collection(db, "users", user.uid, "sessions") as CollectionReference<Session>;
  const snapshot = await getDocs(sessionsCollection);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

export const addSession = async (session: Omit<Session, 'id'>) => {
  const user = getAuth().currentUser;
  if (!user) {
 throw new Error("User not authenticated.");
  }
  const sessionsCollection = collection(db, "users", user.uid, "sessions") as CollectionReference<Omit<Session, 'id'>>;
  const docRef = await addDoc(sessionsCollection, session);
  return { ...session, id: docRef.id };
};

export const updateSession = async (id: string, updates: Partial<Session>) => {
  const user = getAuth().currentUser;
  if (!user) {
 throw new Error("User not authenticated.");
  }
  const sessionDoc = doc(db, "users", user.uid, "sessions", id) as DocumentReference<Partial<Session>>;
  await updateDoc(sessionDoc, updates);
};

export const deleteSession = async (id: string) => {
  const user = getAuth().currentUser;
  if (!user) {
 throw new Error("User not authenticated.");
  }
  const sessionDoc = doc(db, "users", user.uid, "sessions", id) as DocumentReference<Session>;
  await deleteDoc(sessionDoc);
};

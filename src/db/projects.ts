import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from "firebase/firestore";
// 1. Corrected import path and added firebaseInitializedPromise
import { db, firebaseInitializedPromise } from "../firebase";

// Your Project interface (this part was already correct)
export interface Project {
  id: string;
  name: string;
  color: string;
  createdAt: number;
  archived: boolean;
}

// Get all projects
export const getProjects = async (): Promise<Project[]> => {
  // 2. Wait for initialization
  await firebaseInitializedPromise;
  // 3. Add a type guard to prove to TypeScript that db is ready
  if (!db) throw new Error("Firestore is not initialized");

  // 4. Define the collection reference inside the function
  const projectsCollection = collection(db, "projects");
  const snapshot = await getDocs(projectsCollection);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Project));
};

// Add a new project
export const addProject = async (project: Omit<Project, 'id'>) => {
  await firebaseInitializedPromise;
  if (!db) throw new Error("Firestore is not initialized");

  const projectsCollection = collection(db, "projects");
  const docRef = await addDoc(projectsCollection, project);
  return { ...project, id: docRef.id };
};

// Update an existing project
export const updateProject = async (id: string, updates: Partial<Project>) => {
  await firebaseInitializedPromise;
  if (!db) throw new Error("Firestore is not initialized");

  const projectDoc = doc(db, "projects", id);
  await updateDoc(projectDoc, updates);
};

// Delete a project
export const deleteProject = async (id: string) => {
  await firebaseInitializedPromise;
  if (!db) throw new Error("Firestore is not initialized");

  const projectDoc = doc(db, "projects", id);
  await deleteDoc(projectDoc);
};
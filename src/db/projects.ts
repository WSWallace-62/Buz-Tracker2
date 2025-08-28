import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from "firebase/firestore";
// Corrected import path
import { db } from "../firebase";

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
  if (!db) throw new Error("Firestore is not initialized");

  const projectsCollection = collection(db, "projects");
  const snapshot = await getDocs(projectsCollection);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Project));
};

// Add a new project
export const addProject = async (project: Omit<Project, 'id'>) => {
  if (!db) throw new Error("Firestore is not initialized");

  const projectsCollection = collection(db, "projects");
  const docRef = await addDoc(projectsCollection, project);
  return { ...project, id: docRef.id };
};

// Update an existing project
export const updateProject = async (id: string, updates: Partial<Project>) => {
  if (!db) throw new Error("Firestore is not initialized");

  const projectDoc = doc(db, "projects", id);
  await updateDoc(projectDoc, updates);
};

// Delete a project
export const deleteProject = async (id: string) => {
  if (!db) throw new Error("Firestore is not initialized");

  const projectDoc = doc(db, "projects", id);
  await deleteDoc(projectDoc);
};
// wswallace-62/buz-tracker2/Buz-Tracker2-Github-errors/src/db/projects.ts

import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from "firebase/firestore";
import { db } from "../firebase";

export interface Project {
  id: string;
  name: string;
  color: string;
  createdAt: number;
  archived: boolean;
}

// Helper to get the user-specific projects collection
const getProjectsCollection = (userId: string) => {
  if (!db) throw new Error("Firestore is not initialized");
  return collection(db, `users/${userId}/projects`);
};

// Get all projects for a user
export const getProjects = async (userId: string): Promise<Project[]> => {
  const snapshot = await getDocs(getProjectsCollection(userId));
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Project));
};

// Add a new project for a user
export const addProject = async (userId: string, project: Omit<Project, 'id'>) => {
  const docRef = await addDoc(getProjectsCollection(userId), project);
  return { ...project, id: docRef.id };
};

// Update an existing project for a user
export const updateProject = async (userId: string, id: string, updates: Partial<Project>) => {
  if (!db) throw new Error("Firestore is not initialized");
  const projectDoc = doc(db, `users/${userId}/projects`, id);
  await updateDoc(projectDoc, updates);
};

// Delete a project for a user
export const deleteProject = async (userId: string, id: string) => {
  if (!db) throw new Error("Firestore is not initialized");
  const projectDoc = doc(db, `users/${userId}/projects`, id);
  await deleteDoc(projectDoc);
};
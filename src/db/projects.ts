import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from "firebase/firestore"; 
import { db } from "../firebase";

export interface Project {
  id: string
  name: string
  color: string
  createdAt: number
  archived: boolean
}

const projectsCollection = collection(db, "projects");

export const getProjects = async (): Promise<Project[]> => {
  const snapshot = await getDocs(projectsCollection);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Project));
};

export const addProject = async (project: Omit<Project, 'id'>) => {
  const docRef = await addDoc(projectsCollection, project);
  return { ...project, id: docRef.id };
};

export const updateProject = async (id: string, updates: Partial<Project>) => {
  const projectDoc = doc(db, "projects", id);
  await updateDoc(projectDoc, updates);
};

export const deleteProject = async (id: string) => {
  const projectDoc = doc(db, "projects", id);
  await deleteDoc(projectDoc);
};

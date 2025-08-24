import { create } from 'zustand'
import { db, Project } from '../db/dexie'
import { db as firestoreDB, firebaseInitializedPromise } from '../firebase'
import { collection, addDoc, doc, updateDoc, deleteDoc } from 'firebase/firestore'
import { useAuthStore } from './auth'

interface ProjectsState {
  projects: Project[]
  isLoading: boolean
  error: string | null
  
  // Actions
  loadProjects: () => Promise<void>
  createProject: (project: Omit<Project, 'id' | 'createdAt'>) => Promise<void>
  updateProject: (id: number, updates: Partial<Project>) => Promise<void>
  deleteProject: (id: number) => Promise<void>
  archiveProject: (id: number, archived: boolean) => Promise<void>
}

export const useProjectsStore = create<ProjectsState>((set, get) => ({
  projects: [],
  isLoading: false,
  error: null,

  loadProjects: async () => {
    set({ isLoading: true, error: null })
    try {
      const projects = await db.projects.orderBy('createdAt').toArray()
      set({ projects, isLoading: false })
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false })
    }
  },

  createProject: async (projectData) => {
    const { user } = useAuthStore.getState()
    if (!user) {
      set({ error: "User not authenticated" })
      return
    }

    try {
      await firebaseInitializedPromise;
      if (!firestoreDB) throw new Error("Firestore not initialized");

      // 1. Save to Firestore to get the firestoreId
      const projectsCol = collection(firestoreDB, 'users', user.uid, 'projects');
      const newProjectFsData = {
        ...projectData,
        createdAt: Date.now(),
        archived: false,
      }
      const docRef = await addDoc(projectsCol, newProjectFsData);

      // 2. Save to Dexie with the new firestoreId
      const newProject: Project = {
        ...newProjectFsData,
        firestoreId: docRef.id
      }
      const id = await db.projects.add(newProject)
      const projectWithId = { ...newProject, id: id as number }
      
      set(state => ({
        projects: [...state.projects, projectWithId]
      }))
    } catch (error) {
      set({ error: (error as Error).message })
    }
  },

  updateProject: async (id, updates) => {
    const { user } = useAuthStore.getState()
    if (!user) {
      set({ error: "User not authenticated" })
      return
    }

    try {
      // Update Firestore
      const project = get().projects.find(p => p.id === id)
      if (project?.firestoreId) {
        if (!firestoreDB) throw new Error("Firestore not initialized");
        const projectRef = doc(firestoreDB, 'users', user.uid, 'projects', project.firestoreId);
        await updateDoc(projectRef, updates);
      }

      // Update Dexie
      await db.projects.update(id, updates)
      
      set(state => ({
        projects: state.projects.map(p => 
          p.id === id ? { ...p, ...updates } : p
        )
      }))
    } catch (error) {
      set({ error: (error as Error).message })
    }
  },

  deleteProject: async (id) => {
    const { user } = useAuthStore.getState()
    if (!user) {
      set({ error: "User not authenticated" })
      return
    }

    try {
      // Delete from Firestore
      const project = get().projects.find(p => p.id === id)
      if (project?.firestoreId) {
        if (!firestoreDB) throw new Error("Firestore not initialized");
        const projectRef = doc(firestoreDB, 'users', user.uid, 'projects', project.firestoreId);
        await deleteDoc(projectRef);
        // Note: This does not delete subcollections (sessions).
        // For a full cleanup, a cloud function would be needed.
        // This is acceptable for now as the user did not require this.
      }

      // Delete from Dexie
      await db.sessions.where('projectId').equals(id).delete()
      await db.projects.delete(id)
      
      set(state => ({
        projects: state.projects.filter(p => p.id !== id)
      }))
    } catch (error) {
      set({ error: (error as Error).message })
    }
  },

  archiveProject: async (id, archived) => {
    await get().updateProject(id, { archived })
  }
}))
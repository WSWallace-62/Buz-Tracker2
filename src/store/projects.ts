import { create } from 'zustand'
import { db, Project } from '../db/dexie'
import { db as firestoreDB, firebaseInitializedPromise } from '../firebase'
import { collection, addDoc, doc, updateDoc, deleteDoc, getDocs } from 'firebase/firestore'
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
  reconcileProjects: () => Promise<void>
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

  reconcileProjects: async () => {
    const { user } = useAuthStore.getState()
    if (!user) return; // Not logged in, nothing to reconcile

    set({ isLoading: true, error: null });
    console.log("Reconciling projects...");

    try {
      await firebaseInitializedPromise;
      if (!firestoreDB) throw new Error("Firestore not initialized");

      const projectsCol = collection(firestoreDB, 'users', user.uid, 'projects');

      // 1. Fetch all data from both sources
      const firestoreSnapshot = await getDocs(projectsCol);
      const firestoreProjects = firestoreSnapshot.docs.map(doc => ({ ...doc.data(), firestoreId: doc.id } as Project));
      const dexieProjects = await db.projects.toArray();

      const dexieProjectsByName = new Map(dexieProjects.map(p => [p.name, p]));
      const firestoreProjectsByName = new Map(firestoreProjects.map(p => [p.name, p]));

      // 2. Sync Firestore projects down to Dexie
      for (const fsProject of firestoreProjects) {
        const dexieMatch = dexieProjectsByName.get(fsProject.name);
        if (dexieMatch) {
          // Project exists in Dexie, check if firestoreId is missing
          if (!dexieMatch.firestoreId && dexieMatch.id) {
            console.log(`Reconcile: Updating Dexie project "${fsProject.name}" with Firestore ID.`);
            await db.projects.update(dexieMatch.id, { firestoreId: fsProject.firestoreId });
          }
        } else {
          // Project does not exist in Dexie, add it
          console.log(`Reconcile: Adding Firestore project "${fsProject.name}" to Dexie.`);
          await db.projects.add(fsProject);
        }
      }

      // 3. Sync Dexie projects up to Firestore
      for (const dxProject of dexieProjects) {
        if (!dxProject.firestoreId) {
          // This project was likely created offline.
          // Check if a project with the same name now exists on Firestore to avoid duplicates.
          const firestoreMatch = firestoreProjectsByName.get(dxProject.name);
          if (firestoreMatch) {
            // A project with this name was created on another device. Link them.
            if(dxProject.id) {
              console.log(`Reconcile: Linking offline Dexie project "${dxProject.name}" to existing Firestore project.`);
              await db.projects.update(dxProject.id, { firestoreId: firestoreMatch.firestoreId });
            }
          } else {
            // This is a new offline project, upload it.
            console.log(`Reconcile: Uploading offline project "${dxProject.name}" to Firestore.`);
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { id, ...fsData } = dxProject;
            const docRef = await addDoc(projectsCol, fsData);
            if (dxProject.id) {
              await db.projects.update(dxProject.id, { firestoreId: docRef.id });
            }
          }
        }
      }

      // 4. Load the fully reconciled projects into state
      await get().loadProjects();
      console.log("Project reconciliation complete.");

    } catch (error) {
      console.error("Project reconciliation failed:", error);
      set({ error: (error as Error).message, isLoading: false });
    }
  },

  archiveProject: async (id, archived) => {
    await get().updateProject(id, { archived })
  }
}))
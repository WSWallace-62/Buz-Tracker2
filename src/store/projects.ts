import { create } from 'zustand'
import { db, Project } from '../db/dexie'

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
    try {
      const newProject: Project = {
        ...projectData,
        createdAt: Date.now()
      }
      
      const id = await db.projects.add(newProject)
      const project = { ...newProject, id: id as number }
      
      set(state => ({
        projects: [...state.projects, project]
      }))
    } catch (error) {
      set({ error: (error as Error).message })
    }
  },

  updateProject: async (id, updates) => {
    try {
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
    try {
      // Delete all sessions for this project first
      await db.sessions.where('projectId').equals(id).delete()
      // Delete the project
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
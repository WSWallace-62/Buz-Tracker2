import { create } from 'zustand'
import { db, Session, RunningSession } from '../db/dexie'
import { startOfDay, endOfDay } from '../utils/time'

interface SessionsState {
  sessions: Session[]
  runningSession: RunningSession | null
  isLoading: boolean
  error: string | null
  
  // Actions
  loadSessions: (filters?: { 
    startDate?: number
    endDate?: number
    projectIds?: number[]
  }) => Promise<void>
  createSession: (session: Omit<Session, 'id' | 'createdAt'>) => Promise<void>
  updateSession: (id: number, updates: Partial<Session>) => Promise<void>
  deleteSession: (id: number) => Promise<void>
  
  // Running session management
  loadRunningSession: () => Promise<void>
  startSession: (projectId: number, note?: string) => Promise<void>
  stopSession: () => Promise<void>
  getCurrentElapsed: () => number
  
  // Queries
  getTodaySessions: (projectId?: number) => Session[]
  getSessionsByDateRange: (start: number, end: number, projectIds?: number[]) => Session[]
  getTotalDuration: (sessions: Session[]) => number
  
  // Bulk operations
  clearTodaySessions: (projectId: number) => Promise<void>
}

export const useSessionsStore = create<SessionsState>((set, get) => ({
  sessions: [],
  runningSession: null,
  isLoading: false,
  error: null,

  loadSessions: async (filters = {}) => {
    set({ isLoading: true, error: null })
    try {
      let query = db.sessions.orderBy('start').reverse()
      
      if (filters.startDate || filters.endDate) {
        const start = filters.startDate || 0
        const end = filters.endDate || Date.now()
        query = query.filter(session => 
          session.start >= start && session.start <= end
        )
      }
      
      let sessions = await query.toArray()
      
      if (filters.projectIds?.length) {
        sessions = sessions.filter(s => filters.projectIds!.includes(s.projectId))
      }
      
      set({ sessions, isLoading: false })
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false })
    }
  },

  createSession: async (sessionData) => {
    try {
      const newSession: Session = {
        ...sessionData,
        createdAt: Date.now()
      }
      
      const id = await db.sessions.add(newSession)
      const session = { ...newSession, id: id as number }
      
      set(state => ({
        sessions: [session, ...state.sessions]
      }))
    } catch (error) {
      set({ error: (error as Error).message })
    }
  },

  updateSession: async (id, updates) => {
    try {
      // Recalculate duration if start or stop changed
      if (updates.start !== undefined || updates.stop !== undefined) {
        const session = get().sessions.find(s => s.id === id)
        if (session) {
          const start = updates.start ?? session.start
          const stop = updates.stop ?? session.stop
          if (stop) {
            updates.durationMs = stop - start
          }
        }
      }
      
      await db.sessions.update(id, updates)
      
      set(state => ({
        sessions: state.sessions.map(s => 
          s.id === id ? { ...s, ...updates } : s
        )
      }))
    } catch (error) {
      set({ error: (error as Error).message })
    }
  },

  deleteSession: async (id) => {
    try {
      await db.sessions.delete(id)
      
      set(state => ({
        sessions: state.sessions.filter(s => s.id !== id)
      }))
    } catch (error) {
      set({ error: (error as Error).message })
    }
  },

  loadRunningSession: async () => {
    try {
      const running = await db.runningSession.toCollection().first()
      set({ runningSession: running || null })
    } catch (error) {
      set({ error: (error as Error).message })
    }
  },

  startSession: async (projectId, note) => {
    try {
      // Check if there's already a running session
      const existing = await db.runningSession.toCollection().first()
      if (existing) {
        throw new Error('A session is already running. Please stop it first.')
      }
      
      const now = Date.now()
      const runningSession: RunningSession = {
        running: true,
        projectId,
        startTs: now,
        note
      }
      
      await db.runningSession.clear()
      await db.runningSession.add(runningSession)
      
      set({ runningSession })
    } catch (error) {
      set({ error: (error as Error).message })
    }
  },

  stopSession: async () => {
    try {
      const running = get().runningSession
      if (!running) {
        throw new Error('No running session found')
      }
      
      const now = Date.now()
      const durationMs = now - running.startTs
      
      // Create the completed session
      await get().createSession({
        projectId: running.projectId,
        start: running.startTs,
        stop: now,
        durationMs,
        note: running.note
      })
      
      // Clear running session
      await db.runningSession.clear()
      set({ runningSession: null })
    } catch (error) {
      set({ error: (error as Error).message })
    }
  },

  getCurrentElapsed: () => {
    const running = get().runningSession
    if (!running) return 0
    return Date.now() - running.startTs
  },

  getTodaySessions: (projectId) => {
    const sessions = get().sessions
    const today = startOfDay(Date.now())
    const tomorrow = endOfDay(Date.now())
    
    return sessions.filter(s => {
      const matchesDate = s.start >= today && s.start <= tomorrow
      const matchesProject = projectId ? s.projectId === projectId : true
      return matchesDate && matchesProject
    })
  },

  getSessionsByDateRange: (start, end, projectIds) => {
    const sessions = get().sessions
    
    return sessions.filter(s => {
      const matchesDate = s.start >= start && s.start <= end
      const matchesProject = projectIds ? projectIds.includes(s.projectId) : true
      return matchesDate && matchesProject
    })
  },

  getTotalDuration: (sessions) => {
    return sessions.reduce((total, session) => total + session.durationMs, 0)
  },

  clearTodaySessions: async (projectId) => {
    try {
      const today = startOfDay(Date.now())
      const tomorrow = endOfDay(Date.now())
      
      const sessionsToDelete = await db.sessions
        .where('start')
        .between(today, tomorrow)
        .and(s => s.projectId === projectId)
        .toArray()
      
      const ids = sessionsToDelete.map(s => s.id!).filter(Boolean)
      await db.sessions.bulkDelete(ids)
      
      set(state => ({
        sessions: state.sessions.filter(s => 
          !(s.start >= today && s.start <= tomorrow && s.projectId === projectId)
        )
      }))
    } catch (error) {
      set({ error: (error as Error).message })
    }
  }
}))
import { create } from 'zustand';
import { db, Session, RunningSession } from '../db/dexie';
import { getAuth } from 'firebase/auth';
import {
  addDoc,
  collection,
  doc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  Unsubscribe,
  writeBatch,
} from 'firebase/firestore';
import { db as firestoreDb } from '../firebase';
import { startOfDay, endOfDay } from '../utils/time';

// Keep track of the unsubscribe function
let unsubscribeFromFirestore: Unsubscribe | null = null;

interface SessionsState {
  sessions: Session[];
  runningSession: RunningSession | null;
  isLoading: boolean;
  error: string | null;
  isSyncing: boolean;

  // Actions
  loadSessions: (filters?: {
    startDate?: number;
    endDate?: number;
    projectIds?: number[];
  }) => Promise<void>;
  createSession: (session: Omit<Session, 'id' | 'createdAt' | 'firestoreId'>) => Promise<void>;
  updateSession: (id: number, updates: Partial<Session>) => Promise<void>;
  deleteSession: (id: number) => Promise<void>;

  // Sync actions
  startSync: () => void;
  stopSync: () => void;

  // Running session management
  loadRunningSession: () => Promise<void>;
  startSession: (projectId: number, note?: string) => Promise<void>;
  stopSession: () => Promise<void>;
  discardRunningSession: () => Promise<void>;
  getCurrentElapsed: () => number;

  // Queries
  getTodaySessions: (projectId?: number) => Session[];
  getSessionsByDateRange: (start: number, end: number, projectIds?: number[]) => Session[];
  getTotalDuration: (sessions: Session[]) => number;

  // Bulk operations
  clearTodaySessions: (projectId: number) => Promise<void>;
}

export const useSessionsStore = create<SessionsState>((set, get) => ({
  sessions: [],
  runningSession: null,
  isLoading: true,
  error: null,
  isSyncing: false,

  startSync: () => {
    const user = getAuth().currentUser;
    if (!user || !firestoreDb) {
      console.log("User not logged in or firestore not available. Skipping sync.");
      get().loadSessions(); // Load local data for logged-out user
      return;
    }

    if (unsubscribeFromFirestore) {
      console.log("Sync already active.");
      return;
    }

    set({ isSyncing: true });
    console.log("Starting Firestore sync...");

    const sessionsCollection = query(collection(firestoreDb, 'users', user.uid, 'sessions'));

    unsubscribeFromFirestore = onSnapshot(sessionsCollection, async (snapshot) => {
      set({ isLoading: true });
      const changes = snapshot.docChanges();

      for (const change of changes) {
        const firestoreSession = { ...change.doc.data(), firestoreId: change.doc.id };

        const existingSession = await db.sessions.where('firestoreId').equals(change.doc.id).first();

        switch (change.type) {
          case 'added':
            if (!existingSession) {
              console.log("Sync: Adding new session from Firestore to Dexie", firestoreSession.firestoreId);
              await db.sessions.add({
                projectId: Number(firestoreSession.projectId),
                start: firestoreSession.start,
                stop: firestoreSession.stop,
                durationMs: firestoreSession.durationMs,
                note: firestoreSession.note,
                createdAt: firestoreSession.createdAt,
                firestoreId: firestoreSession.firestoreId,
              });
            }
            break;
          case 'modified':
            if (existingSession && existingSession.id) {
              console.log("Sync: Modifying session in Dexie from Firestore", existingSession.firestoreId);
              // eslint-disable-next-line @typescript-eslint/no-unused-vars
              const { id, ...updates } = firestoreSession;
              await db.sessions.update(existingSession.id, updates);
            }
            break;
          case 'removed':
            if (existingSession && existingSession.id) {
              console.log("Sync: Removing session from Dexie from Firestore", existingSession.firestoreId);
              await db.sessions.delete(existingSession.id);
            }
            break;
        }
      }

      // After processing all changes, reload the full session list from Dexie
      // This is simpler than trying to update the state incrementally
      if (changes.length > 0) {
        console.log("Sync: Changes detected, reloading sessions from Dexie.");
        await get().loadSessions();
      }
      set({ isLoading: false, isSyncing: false });

    }, (error) => {
      console.error("Error with Firestore snapshot listener:", error);
      set({ error: "Failed to sync sessions.", isSyncing: false, isLoading: false });
    });
  },

  stopSync: () => {
    if (unsubscribeFromFirestore) {
      console.log("Stopping Firestore sync.");
      unsubscribeFromFirestore();
      unsubscribeFromFirestore = null;
      set({ isSyncing: false });
    }
  },

  loadSessions: async (filters = {}) => {
    if (!get().isSyncing) set({ isLoading: true });
    try {
      let query = db.sessions.orderBy('start').reverse();

      if (filters.startDate || filters.endDate) {
        const start = filters.startDate || 0;
        const end = filters.endDate || Date.now();
        query = query.filter(session =>
          session.start >= start && session.start <= end
        );
      }

      let sessions = await query.toArray();

      if (filters.projectIds?.length) {
        sessions = sessions.filter(s => filters.projectIds!.includes(s.projectId));
      }

      set({ sessions, isLoading: false });
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
    }
  },

  createSession: async (sessionData) => {
    try {
      const isOnline = navigator.onLine;
      const user = getAuth().currentUser;

      const newSession: Omit<Session, 'id' | 'firestoreId'> = {
        ...sessionData,
        createdAt: Date.now(),
      };

      if (user && firestoreDb && isOnline) {
        // Online: Add to Firestore only. onSnapshot will handle adding to Dexie.
        try {
          await addDoc(collection(firestoreDb, 'users', user.uid, 'sessions'), newSession);
        } catch (firestoreError) {
          console.error('Error saving session to Firestore, saving locally as fallback:', firestoreError);
          // If Firestore fails, save it locally as a fallback.
          await db.sessions.add(newSession as Session);
          get().loadSessions(); // and update UI
        }
      } else {
        // Offline or not logged in: Add to Dexie and update UI.
        await db.sessions.add(newSession as Session);
        get().loadSessions();
      }
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },

  updateSession: async (id, updates) => {
    try {
      if (updates.start !== undefined || updates.stop !== undefined) {
        const session = await db.sessions.get(id);
        if (session) {
          const start = updates.start ?? session.start;
          const stop = updates.stop ?? session.stop;
          if (stop) {
            updates.durationMs = stop - start;
          }
        }
      }

      await db.sessions.update(id, updates);
      get().loadSessions();

      const session = await db.sessions.get(id);
      const user = getAuth().currentUser;
      if (user && firestoreDb && session?.firestoreId) {
        try {
            const sessionDocRef = doc(firestoreDb, 'users', user.uid, 'sessions', session.firestoreId);
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { id: localId, firestoreId, ...firestoreUpdates } = { ...session, ...updates };
            await updateDoc(sessionDocRef, firestoreUpdates);
        } catch (firestoreError) {
          console.error("Error updating session in Firestore:", firestoreError);
        }
      }
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },

  deleteSession: async (id) => {
    try {
      const sessionToDelete = await db.sessions.get(id);
      if (!sessionToDelete) return;

      await db.sessions.delete(id);
      get().loadSessions();

      const user = getAuth().currentUser;
      if (user && firestoreDb && sessionToDelete.firestoreId) {
        try {
            const sessionDocRef = doc(firestoreDb, 'users', user.uid, 'sessions', sessionToDelete.firestoreId);
            await deleteDoc(sessionDocRef);
        } catch (firestoreError) {
          console.error("Error deleting session from Firestore:", firestoreError);
        }
      }
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },

  loadRunningSession: async () => {
    try {
      const running = await db.runningSession.toCollection().first();
      set({ runningSession: running || null });
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },

  startSession: async (projectId, note) => {
    try {
      const existing = await db.runningSession.toCollection().first();
      if (existing) {
        throw new Error('A session is already running. Please stop it first.');
      }

      const now = Date.now();
      const runningSession: RunningSession = {
        running: true,
        projectId,
        startTs: now,
        note
      };

      await db.runningSession.clear();
      await db.runningSession.add(runningSession);
      set({ runningSession });
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },

  discardRunningSession: async () => {
    try {
      await db.runningSession.clear();
      set({ runningSession: null });
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },

  stopSession: async () => {
    try {
      const running = get().runningSession;
      if (!running) {
        throw new Error('No running session found');
      }

      const now = Date.now();
      const durationMs = now - running.startTs;

      const newSessionData: Omit<Session, 'id' | 'createdAt' | 'firestoreId'> = {
        projectId: running.projectId,
        start: running.startTs,
        stop: now,
        durationMs,
        note: running.note,
      };

      await get().createSession(newSessionData);
      await db.runningSession.clear();
      set({ runningSession: null });

    } catch (error) {
      set({ error: (error as Error).message });
    }
  },

  getCurrentElapsed: () => {
    const running = get().runningSession;
    if (!running) return 0;
    return Date.now() - running.startTs;
  },

  getTodaySessions: (projectId) => {
    const sessions = get().sessions;
    const today = startOfDay(Date.now());
    const tomorrow = endOfDay(Date.now());

    return sessions.filter(s => {
      const matchesDate = s.start >= today && s.start <= tomorrow;
      const matchesProject = projectId ? s.projectId === projectId : true;
      return matchesDate && matchesProject;
    });
  },

  getSessionsByDateRange: (start, end, projectIds) => {
    const sessions = get().sessions;

    return sessions.filter(s => {
      const matchesDate = s.start >= start && s.start <= end;
      const matchesProject = projectIds ? projectIds.includes(s.projectId) : true;
      return matchesDate && matchesProject;
    });
  },

  getTotalDuration: (sessions) => {
    return sessions.reduce((total, session) => total + session.durationMs, 0);
  },

  clearTodaySessions: async (projectId) => {
    try {
      const today = startOfDay(Date.now());
      const tomorrow = endOfDay(Date.now());

      const sessionsToDelete = await db.sessions
        .where('start')
        .between(today, tomorrow)
        .and(s => s.projectId === projectId)
        .toArray();

      const user = getAuth().currentUser;
      if (user && firestoreDb) {
        const batch = writeBatch(firestoreDb);
        sessionsToDelete.forEach(session => {
          if (session.firestoreId) {
            const docRef = doc(firestoreDb, 'users', user.uid, 'sessions', session.firestoreId);
            batch.delete(docRef);
          }
        });
        await batch.commit();
      } else {
        const ids = sessionsToDelete.map(s => s.id!).filter(Boolean);
        await db.sessions.bulkDelete(ids);
        get().loadSessions();
      }
    } catch (error) {
      set({ error: (error as Error).message });
    }
  }
}));

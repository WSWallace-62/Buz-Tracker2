import { create } from 'zustand';
import { db, Session, RunningSession } from '../db/dexie';
import { getAuth } from 'firebase/auth';
import { useProjectsStore } from './projects';
import { useNotificationSettingsStore } from './notificationSettings';
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
  setDoc,
} from 'firebase/firestore';
import { db as firestoreDb } from '../firebase';
import { startOfDay, endOfDay } from '../utils/time';
import { audioManager } from '../utils/audioManager';

// Keep track of the unsubscribe function
let unsubscribeFromFirestore: Unsubscribe | null = null;

// --- Media Session API Integration ---

// Holds the interval ID for updating the media session position.
let mediaSessionInterval: NodeJS.Timeout | null = null;

/**
 * Clears all Media Session metadata and handlers.
 */
const clearMediaSession = () => {
  if ('mediaSession' in navigator) {
    if (mediaSessionInterval) {
      clearInterval(mediaSessionInterval);
      mediaSessionInterval = null;
    }
    navigator.mediaSession.metadata = null;
    navigator.mediaSession.playbackState = 'none';
    navigator.mediaSession.setActionHandler('play', null);
    navigator.mediaSession.setActionHandler('pause', null);
    navigator.mediaSession.setPositionState(undefined);
  }
};

/**
 * Updates the Media Session state based on the timer's action.
 * @param action The action being performed ('start', 'pause', 'stop').
 * @param session The current running session object.
 */
const updateMediaSession = (
  action: 'start' | 'pause' | 'stop',
  session: RunningSession | null
) => {
  if (!('mediaSession' in navigator)) {
    return; // Media Session API not supported.
  }

  // Check if the feature is enabled in settings.
  const { settings } = useNotificationSettingsStore.getState();
  if (!settings.showLiveTimer) {
    clearMediaSession();
    return;
  }

  if (action === 'stop' || !session) {
    clearMediaSession();
    return;
  }

  // Get project name for the metadata title.
  const { projects } = useProjectsStore.getState();
  const project = projects.find(p => p.id === session.projectId);
  const projectName = project?.name || 'BuzTracker Project';

  // Set the metadata that shows up on the lock screen/media controls.
  navigator.mediaSession.metadata = new MediaMetadata({
    title: projectName,
    artist: 'BuzTracker',
    album: 'Time Tracking Sessions',
  });

  // Get actions from the store to hook into the media controls.
  const { resumeSession, pauseSession, getCurrentElapsed } = useSessionsStore.getState();

  navigator.mediaSession.setActionHandler('play', () => resumeSession());
  navigator.mediaSession.setActionHandler('pause', () => pauseSession());

  // Function to update the timer position in the media notification.
  const updatePosition = () => {
    const elapsedSeconds = Math.max(0, getCurrentElapsed() / 1000);
    navigator.mediaSession.setPositionState({
      duration: elapsedSeconds,
      playbackRate: 1,
      position: elapsedSeconds,
    });
  };

  if (action === 'start') {
    navigator.mediaSession.playbackState = 'playing';
    if (mediaSessionInterval) clearInterval(mediaSessionInterval);
    mediaSessionInterval = setInterval(updatePosition, 1000);
    updatePosition(); // Update immediately
  } else if (action === 'pause') {
    navigator.mediaSession.playbackState = 'paused';
    // When paused, stop the interval but update the position one last time.
    if (mediaSessionInterval) clearInterval(mediaSessionInterval);
    mediaSessionInterval = null;
    updatePosition();
  }
};

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
  // --- New Actions for Pause/Resume ---
  pauseSession: () => Promise<void>;
  resumeSession: () => Promise<void>;
  continueSession: (session: Session) => Promise<void>;

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
      const projects = useProjectsStore.getState().projects;

      // Wrap all changes in a single transaction for efficiency and atomicity
      await db.transaction('rw', db.sessions, async () => {
        for (const change of changes) {
          const firestoreSessionData = change.doc.data();
          const firestoreId = change.doc.id;

          // Find the corresponding local project using the Firestore project ID
          const localProject = projects.find(p => p.firestoreId === firestoreSessionData.projectId);
          
          const existingSessionByFirestoreId = await db.sessions.where('firestoreId').equals(firestoreId).first();

          switch (change.type) {
            case 'added':
              if (existingSessionByFirestoreId) continue; // Already exists, do nothing.

              if (localProject?.id) {
                // Check for a logical duplicate (created offline, not yet linked)
                const logicalDuplicate = await db.sessions.where({
                  projectId: localProject.id,
                  start: firestoreSessionData.start,
                }).first();

                if (logicalDuplicate?.id) {
                  // Found an offline session. Link it instead of creating a new one.
                  console.log(`Sync: Linking local session to Firestore doc ${firestoreId}`);
                  await db.sessions.update(logicalDuplicate.id, { firestoreId });
                } else {
                  // Genuinely new session, add it.
                  console.log(`Sync: Adding new session from Firestore to Dexie ${firestoreId}`);
                  await db.sessions.put({
                    ...firestoreSessionData,
                    firestoreId,
                    projectId: localProject.id,
                  } as Session);
                }
              }
              break;
            case 'modified':
              if (existingSessionByFirestoreId?.id && localProject?.id) {
                console.log(`Sync: Modifying session in Dexie from Firestore ${firestoreId}`);
                await db.sessions.update(existingSessionByFirestoreId.id, {
                  ...firestoreSessionData,
                  projectId: localProject.id,
                });
              }
              break;
            case 'removed':
              if (existingSessionByFirestoreId?.id) {
                console.log(`Sync: Removing session from Dexie via Firestore ${firestoreId}`);
                await db.sessions.delete(existingSessionByFirestoreId.id);
              }
              break;
          }
        }
      });

      // After processing all changes, reload the full session list from Dexie
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
      const user = getAuth().currentUser;

      // 1. Create the session object for Dexie.
      const newSessionForDexie: Omit<Session, 'id' | 'firestoreId'> = {
        ...sessionData,
        createdAt: Date.now(),
      };

      // 2. ALWAYS save to Dexie first. This guarantees data is not lost.
      const newDexieId = await db.sessions.add(newSessionForDexie as Session);
      
      // 3. Eagerly update the UI with the local data.
      get().loadSessions();

      // 4. If online and logged in, attempt to sync to Firestore.
      if (user && firestoreDb && navigator.onLine) {
        const projects = useProjectsStore.getState().projects;
        const project = projects.find(p => p.id === sessionData.projectId);

        if (project?.firestoreId) {
          const newSessionForFirestore = {
            ...newSessionForDexie,
            projectId: project.firestoreId, // Use the string ID for Firestore
          };

          try {
            const docRef = await addDoc(collection(firestoreDb, 'users', user.uid, 'sessions'), newSessionForFirestore);
            // 5. If successful, update the local record with the firestoreId to link them.
            await db.sessions.update(newDexieId, { firestoreId: docRef.id });
            // The onSnapshot listener will handle the UI update for the linked record, so no need to call loadSessions() again.
          } catch (firestoreError) {
            console.error('Failed to sync new session to Firestore. It remains saved locally.', firestoreError);
            // The session is already saved locally, so no data is lost.
            // A background sync process or the next app load can sync it later.
          }
        } else {
           console.error(`Project with Dexie ID ${sessionData.projectId} does not have a Firestore ID. Cannot save session to Firestore.`);
        }
      }
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },

  updateSession: async (id, updates) => {
    try {
      const session = await db.sessions.get(id);
      if (session) {
        const start = updates.start ?? session.start;
        const stop = updates.stop ?? session.stop;
        if (stop && (updates.start !== undefined || updates.stop !== undefined || updates.durationMs === undefined)) {
          updates.durationMs = stop - start;
        }
      }
      await db.sessions.update(id, updates);
      get().loadSessions();

      // Then, update Firestore
      const updatedSession = await db.sessions.get(id);
      const user = getAuth().currentUser;
      if (user && firestoreDb && updatedSession?.firestoreId) {
        const firestoreUpdates: { [key: string]: any } = { ...updates };

        if (updates.projectId !== undefined) {
          const projects = useProjectsStore.getState().projects;
          const project = projects.find(p => p.id === updates.projectId);
          if (!project?.firestoreId) {
            throw new Error(`Cannot update session: Project with Dexie ID ${updates.projectId} has no Firestore ID.`);
          }
          firestoreUpdates.projectId = project.firestoreId;
        }

        try {
            const sessionDocRef = doc(firestoreDb, 'users', user.uid, 'sessions', updatedSession.firestoreId);
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { id: localId, firestoreId, ...finalUpdates } = { ...updatedSession, ...firestoreUpdates };
            await updateDoc(sessionDocRef, finalUpdates);
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
      audioManager.play(); // Play silent audio immediately on user interaction

      const existing = await db.runningSession.toCollection().first();
      if (existing) {
        throw new Error('A session is already running. Please stop it first.');
      }

      const now = Date.now();
      const runningSession: RunningSession = {
        running: true,
        projectId,
        startTs: now,
        note,
        isPaused: false,
        pauseStartTime: null,
        totalPausedTime: 0,
        baseDuration: 0, // New field
        originalStartTs: now, // New field
      };

      await db.runningSession.clear();
      const newId = await db.runningSession.add(runningSession);
      const newRunningSession = { ...runningSession, id: newId as number };
      set({ runningSession: newRunningSession });
      updateMediaSession('start', newRunningSession);

      const user = getAuth().currentUser;
      if (user && firestoreDb) {
        try {
          const projects = useProjectsStore.getState().projects;
          const project = projects.find(p => p.id === projectId);

          if (project?.firestoreId) {
            const runningSessionDocRef = doc(firestoreDb, 'users', user.uid, 'status', 'runningSession');
            await setDoc(runningSessionDocRef, {
              projectId: project.firestoreId,
              projectName: project.name,
              startTs: newRunningSession.startTs,
              note: newRunningSession.note || ''
            });
          }
        } catch (fsError) {
          console.error("Failed to sync running session status to Firestore:", fsError);
        }
      }
    } catch (error) {
      set({ error: (error as Error).message });
      audioManager.pause(); // Ensure audio is paused if start fails
    }
  },

  discardRunningSession: async () => {
    try {
      await db.runningSession.clear();
      set({ runningSession: null });
      updateMediaSession('stop', null);
      audioManager.pause(); // Pause silent audio

      const user = getAuth().currentUser;
      if (user && firestoreDb) {
        try {
          const runningSessionDocRef = doc(firestoreDb, 'users', user.uid, 'status', 'runningSession');
          await deleteDoc(runningSessionDocRef);
        } catch (fsError) {
          console.error("Failed to delete running session status from Firestore:", fsError);
        }
      }
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
      let totalPaused = running.totalPausedTime;
      if (running.isPaused && running.pauseStartTime) {
        totalPaused += (now - running.pauseStartTime);
      }
      const durationMs = running.baseDuration + (now - running.startTs) - totalPaused;

      const newSessionData: Omit<Session, 'id' | 'createdAt' | 'firestoreId'> = {
        projectId: running.projectId,
        start: running.originalStartTs,
        stop: now,
        durationMs,
        note: running.note,
      };

      await get().createSession(newSessionData);
      await db.runningSession.clear();
      set({ runningSession: null });
      updateMediaSession('stop', null);
      audioManager.pause(); // Pause silent audio

      const user = getAuth().currentUser;
      if (user && firestoreDb) {
        try {
          const runningSessionDocRef = doc(firestoreDb, 'users', user.uid, 'status', 'runningSession');
          await deleteDoc(runningSessionDocRef);
        } catch (fsError) {
          console.error("Failed to delete running session status from Firestore:", fsError);
        }
      }
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },

  continueSession: async (sessionToContinue: Session) => {
    try {
      audioManager.play();
  
      const existing = await db.runningSession.toCollection().first();
      if (existing) {
        throw new Error('A session is already running. Please stop it first.');
      }
  
      // First, delete the old session that is being continued
      await db.sessions.delete(sessionToContinue.id!);
      get().loadSessions();
  
      const now = Date.now();
      const runningSession: RunningSession = {
        running: true,
        projectId: sessionToContinue.projectId,
        startTs: now,
        note: sessionToContinue.note,
        isPaused: false,
        pauseStartTime: null,
        totalPausedTime: 0,
        baseDuration: sessionToContinue.durationMs,       // Carry over the old duration
        originalStartTs: sessionToContinue.start,       // Preserve the original start time
      };
  
      await db.runningSession.clear();
      const newId = await db.runningSession.add(runningSession);
      const newRunningSession = { ...runningSession, id: newId as number };
      set({ runningSession: newRunningSession });
      updateMediaSession('start', newRunningSession);
      
    } catch (error) {
      set({ error: (error as Error).message });
      audioManager.pause();
    }
  },

  pauseSession: async () => {
    try {
      const running = get().runningSession;
      if (running && !running.isPaused) {
        const updates = { isPaused: true, pauseStartTime: Date.now() };
        await db.runningSession.update(running.id!, updates);
        const updatedSession = { ...running, ...updates };
        set({ runningSession: updatedSession });
        updateMediaSession('pause', updatedSession);
        audioManager.pause(); // Pause silent audio
      }
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },

  resumeSession: async () => {
    try {
      audioManager.play(); // Play silent audio immediately on user interaction

      const running = get().runningSession;
      if (running && running.isPaused && running.pauseStartTime) {
        const pausedDuration = Date.now() - running.pauseStartTime;
        const newTotalPausedTime = running.totalPausedTime + pausedDuration;
        const updates = {
          isPaused: false,
          pauseStartTime: null,
          totalPausedTime: newTotalPausedTime,
        };
        await db.runningSession.update(running.id!, updates);
        const updatedSession = { ...running, ...updates };
        set({ runningSession: updatedSession });
        updateMediaSession('start', updatedSession);
      }
    } catch (error) {
      set({ error: (error as Error).message });
      audioManager.pause(); // Ensure audio is paused if resume fails
    }
  },

  getCurrentElapsed: () => {
    const running = get().runningSession;
    if (!running) return 0;
    
    const elapsedSinceStart = (Date.now() - running.startTs) - running.totalPausedTime;
    let currentPauseDuration = 0;
    if (running.isPaused && running.pauseStartTime) {
      currentPauseDuration = Date.now() - running.pauseStartTime;
    }
    
    return running.baseDuration + elapsedSinceStart - currentPauseDuration;
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
      const firestoreDBInstance = firestoreDb;
      if (user && firestoreDBInstance) {
        const batch = writeBatch(firestoreDBInstance);
        sessionsToDelete.forEach(session => {
          if (session.firestoreId) {
            const docRef = doc(firestoreDBInstance, 'users', user.uid, 'sessions', session.firestoreId);
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

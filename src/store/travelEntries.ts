import { create } from 'zustand';
import { db, type TravelEntry, type Project } from '../db/dexie';
import { getAuth } from 'firebase/auth';
import { useUIStore } from './ui';
import {
  addDoc,
  collection,
  doc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  Unsubscribe,
} from 'firebase/firestore';
import { db as firestoreDb } from '../firebase';
import { useProjectsStore } from './projects';

export type { TravelEntry };

let unsubscribeFromFirestore: Unsubscribe | null = null;
const recentlyAddedIds = new Set<string>();

interface TravelEntriesState {
  travelEntries: TravelEntry[];
  isLoading: boolean;
  error: string | null;
  isSyncing: boolean;
  loadTravelEntries: (filters?: any) => Promise<void>;
  createTravelEntry: (entry: Omit<TravelEntry, 'id' | 'createdAt' | 'firestoreId'>) => Promise<boolean>;
  updateTravelEntry: (id: number, updates: Partial<TravelEntry>) => Promise<void>;
  deleteTravelEntry: (id: number) => Promise<void>;
  startSync: () => void;
  stopSync: () => void;
  reconcileTravelEntries: () => Promise<void>;
}

export const useTravelEntriesStore = create<TravelEntriesState>((set, get) => ({
  travelEntries: [],
  isLoading: true,
  error: null,
  isSyncing: false,

  startSync: () => {
    const user = getAuth().currentUser;
    if (!user || !firestoreDb) {
      get().loadTravelEntries();
      return;
    }

    if (get().isSyncing) return;

    set({ isSyncing: true });
    const travelEntriesQuery = query(collection(firestoreDb, 'users', user.uid, 'travelEntries'));

    unsubscribeFromFirestore = onSnapshot(travelEntriesQuery, async (snapshot) => {
      const changes = snapshot.docChanges();
      await db.transaction('rw', db.travelEntries, async () => {
        const projects = useProjectsStore.getState().projects;

        for (const change of changes) {
          const firestoreData = change.doc.data();
          const firestoreId = change.doc.id;

          const firestoreProjectId = firestoreData.projectId;
          let localProjectId = firestoreProjectId;

          if (typeof firestoreProjectId === 'string') {
            const project = projects.find(p => p.firestoreId === firestoreProjectId);
            if (project?.id) {
              localProjectId = project.id;
            }
          }

          const existingEntry = await db.travelEntries.where('firestoreId').equals(firestoreId).first();

          if (change.type === 'added' && !recentlyAddedIds.has(firestoreId) && !existingEntry) {
            await db.travelEntries.add({ ...firestoreData, projectId: localProjectId, firestoreId } as TravelEntry);
          } else if (change.type === 'modified' && existingEntry?.id) {
            await db.travelEntries.update(existingEntry.id, { ...firestoreData, projectId: localProjectId, firestoreId });
          } else if (change.type === 'removed' && existingEntry?.id) {
            await db.travelEntries.delete(existingEntry.id);
          }
        }
      });
      await get().loadTravelEntries();
    }, (error) => {
      console.error("Error with Firestore listener:", error);
      set({ error: "Failed to sync.", isSyncing: false });
    });
  },

  stopSync: () => {
    unsubscribeFromFirestore?.();
    unsubscribeFromFirestore = null;
    set({ isSyncing: false });
  },

  loadTravelEntries: async (filters = {}) => {
    set({ isLoading: true, error: null });
    try {
      let query = db.travelEntries.orderBy('date');
      if (filters.startDate && filters.endDate) {
        query = query.filter(e => e.date >= filters.startDate && e.date <= filters.endDate);
      }
      let entries = await query.reverse().toArray();
      if (filters.projectIds?.length) {
        const idSet = new Set(filters.projectIds);
        entries = entries.filter(e => idSet.has(e.projectId));
      }
      if (filters.customerIds?.length) {
        const customers = await db.customers.toArray();
        const customerIdSet = new Set(filters.customerIds);
        const firestoreIdSet = new Set(customers.filter(c => c.id && customerIdSet.has(c.id) && c.firestoreId).map(c => c.firestoreId!));
        entries = entries.filter(e => (e.customerId != null && customerIdSet.has(e.customerId)) || (e.customerFirestoreId && firestoreIdSet.has(e.customerFirestoreId)));
      }
      set({ travelEntries: entries, isLoading: false });
    } catch (e) {
      console.error("Failed to load travel entries:", e);
      set({ error: "Failed to load travel entries.", isLoading: false });
    }
  },

  createTravelEntry: async (entryData) => {
    const user = getAuth().currentUser;
    const { showToast } = useUIStore.getState();

    try {
      let project: Project | undefined;
      if (typeof entryData.projectId === 'string') {
        project = await db.projects.where('firestoreId').equals(entryData.projectId).first();
      } else {
        project = await db.projects.get(entryData.projectId);
      }

      if (!project) {
        throw new Error(`Project with ID ${entryData.projectId} not found locally.`);
      }

      const newEntryForDexie: Omit<TravelEntry, 'id'> = {
        ...entryData,
        projectId: project.id!,
        customerId: project.customerId!,
        customerFirestoreId: project.customerFirestoreId,
        createdAt: Date.now(),
        userId: user?.uid,
      };

      const localId = await db.travelEntries.add(newEntryForDexie as TravelEntry);
      const newEntryForState = { ...newEntryForDexie, id: localId } as TravelEntry;
      set(state => ({
        travelEntries: [newEntryForState, ...state.travelEntries].sort((a, b) => b.date - a.date)
      }));

      if (user && firestoreDb && navigator.onLine) {
        const entryForFirestore = { ...newEntryForDexie, projectId: project.firestoreId };
        try {
          const docRef = await addDoc(collection(firestoreDb, 'users', user.uid, 'travelEntries'), entryForFirestore);
          recentlyAddedIds.add(docRef.id); // Add ID to set
          setTimeout(() => recentlyAddedIds.delete(docRef.id), 5000); // Schedule removal

          await db.travelEntries.update(localId, { firestoreId: docRef.id });
          set(state => ({
            travelEntries: state.travelEntries.map(e => e.id === localId ? { ...e, firestoreId: docRef.id } : e)
          }));
        } catch (firestoreError) {
          console.error("Firestore sync failed:", firestoreError);
          showToast('Entry saved locally, but failed to sync.', 'error');
        }
      }
      return true;
    } catch (error) {
      console.error("Failed to create travel entry:", error);
      showToast('Failed to add travel entry', 'error');
      return false;
    }
  },

  updateTravelEntry: async (id, updates) => {
    const user = getAuth().currentUser;
    await db.travelEntries.update(id, updates);
    set(state => ({ travelEntries: state.travelEntries.map(e => e.id === id ? { ...e, ...updates } : e) }));

    if (user && firestoreDb && navigator.onLine) {
      const entry = await db.travelEntries.get(id);
      if (entry?.firestoreId) {
        await updateDoc(doc(firestoreDb, 'users', user.uid, 'travelEntries', entry.firestoreId), updates as any);
      }
    }
  },

  deleteTravelEntry: async (id) => {
    const user = getAuth().currentUser;
    const entryToDelete = await db.travelEntries.get(id);
    await db.travelEntries.delete(id);
    set(state => ({ travelEntries: state.travelEntries.filter(e => e.id !== id) }));

    if (user && firestoreDb && navigator.onLine && entryToDelete?.firestoreId) {
      await deleteDoc(doc(firestoreDb, 'users', user.uid, 'travelEntries', entryToDelete.firestoreId));
    }
  },

  reconcileTravelEntries: async () => {
    const user = getAuth().currentUser;
    if (!user || !firestoreDb) return;

    const unsynced = await db.travelEntries.filter(e => !e.firestoreId).toArray();
    if (unsynced.length === 0) return;

    console.log(`Reconciling ${unsynced.length} travel entries...`);
    for (const entry of unsynced) {
      try {
        const project = await db.projects.get(entry.projectId as number);
        const entryForFirestore = { ...entry, projectId: project?.firestoreId };
        delete (entryForFirestore as any).id;

        const docRef = await addDoc(collection(firestoreDb, 'users', user.uid, 'travelEntries'), entryForFirestore);
        recentlyAddedIds.add(docRef.id); // Add ID to set
        setTimeout(() => recentlyAddedIds.delete(docRef.id), 5000); // Schedule removal
        if (entry.id) {
            await db.travelEntries.update(entry.id, { firestoreId: docRef.id });
        }
      } catch (error) {
        console.error(`Failed to reconcile entry ${entry.id}:`, error);
      }
    }
  },
}));

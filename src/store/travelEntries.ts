import { create } from 'zustand';
import { db, type TravelEntry } from '../db/dexie';
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
  writeBatch,
} from 'firebase/firestore';
import { db as firestoreDb } from '../firebase';

export type { TravelEntry };

let unsubscribeFromFirestore: Unsubscribe | null = null;

// This set will hold the firestoreId of documents that were just added locally
// to prevent the onSnapshot listener from immediately re-adding them.
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
      get().loadTravelEntries(); // Load local data if offline
      return;
    }

    if (get().isSyncing) return;

    set({ isSyncing: true });
    const travelEntriesQuery = query(collection(firestoreDb, 'users', user.uid, 'travelEntries'));

    unsubscribeFromFirestore = onSnapshot(travelEntriesQuery, async (snapshot) => {
      const changes = snapshot.docChanges();
      if (changes.length === 0) return;

      await db.transaction('rw', db.travelEntries, async () => {
        for (const change of changes) {
          const firestoreId = change.doc.id;

          // If this ID was recently added locally, skip it to prevent echo.
          if (recentlyAddedIds.has(firestoreId)) {
            // The ID has been seen, so we can remove it from the set.
            recentlyAddedIds.delete(firestoreId);
            continue;
          }

          const firestoreData = change.doc.data() as Omit<TravelEntry, 'id'>;
          const existingEntryByFirestoreId = await db.travelEntries.where('firestoreId').equals(firestoreId).first();

          switch (change.type) {
            case 'added': {
              if (existingEntryByFirestoreId) continue; // Already synced.

              // Check for a logical duplicate (created offline, not yet linked)
              const logicalDuplicate = await db.travelEntries.where({
                projectId: firestoreData.projectId,
                date: firestoreData.date,
                distance: firestoreData.distance,
              }).filter(e => !e.firestoreId).first();

              if (logicalDuplicate?.id) {
                // Found an offline session. Link it instead of creating a new one.
                await db.travelEntries.update(logicalDuplicate.id, { firestoreId });
              } else {
                // Genuinely new session from another client, add it.
                await db.travelEntries.add({ ...firestoreData, firestoreId });
              }
              break;
            }
            case 'modified': {
              if (existingEntryByFirestoreId?.id) {
                await db.travelEntries.update(existingEntryByFirestoreId.id, { ...firestoreData, firestoreId });
              }
              break;
            }
            case 'removed': {
              if (existingEntryByFirestoreId?.id) {
                await db.travelEntries.delete(existingEntryByFirestoreId.id);
              }
              break;
            }
          }
        }
      });

      // Refresh the local state from Dexie
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
      const anyFilters = filters as any;
      if (anyFilters.startDate && anyFilters.endDate) {
        query = query.filter(e => e.date >= anyFilters.startDate && e.date <= anyFilters.endDate);
      }
      let entries = await query.reverse().toArray();
      if (anyFilters.projectIds?.length) {
        const idSet = new Set(anyFilters.projectIds);
        entries = entries.filter(e => idSet.has(e.projectId));
      }
      if (anyFilters.customerIds?.length) {
        const customerIdSet = new Set(anyFilters.customerIds);
        entries = entries.filter(e => e.customerFirestoreId && customerIdSet.has(e.customerFirestoreId));
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
      const project = await db.projects.where('firestoreId').equals(entryData.projectId).first();
      if (!project) {
        throw new Error(`Project with firestoreId ${entryData.projectId} not found locally.`);
      }

      // 1. Create the full entry object for Dexie, but without the firestoreId yet.
      const newEntryForDexie: Omit<TravelEntry, 'id'> = {
        ...entryData,
        customerFirestoreId: project.customerFirestoreId,
        createdAt: Date.now(),
        userId: user?.uid,
      };

      // 2. Save to Dexie first (optimistic update). This is our source of truth.
      const localId = await db.travelEntries.add(newEntryForDexie as TravelEntry);

      // 3. Immediately reload the UI from Dexie.
      await get().loadTravelEntries();

      // 4. Sync to Firestore in the background.
      if (user && firestoreDb && navigator.onLine) {
        try {
          // Create a clean object for Firestore, excluding the local `id`.
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { id, ...entryForFirestore } = { ...newEntryForDexie, id: localId } as TravelEntry;
          const docRef = await addDoc(collection(firestoreDb, 'users', user.uid, 'travelEntries'), entryForFirestore);
          
          // 5. Once synced, update the local record with the permanent firestoreId.
          // The sync listener will now ignore this entry because it finds a match by firestoreId.
          await db.travelEntries.update(localId, { firestoreId: docRef.id });

        } catch (firestoreError) {
          console.error("Firestore sync failed:", firestoreError);
          showToast('Entry saved locally, but failed to sync.', 'error');
          // No need to do anything else; the entry is safe locally and will be reconciled later.
        }
      }
      
      return true;
    } catch (error) {
      console.error("Failed to create travel entry:", error);
      showToast(`Failed to add travel entry: ${(error as Error).message}`, 'error');
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
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { id: localId, ...entryForFirestore } = { ...entry, ...updates };
        await updateDoc(doc(firestoreDb, 'users', user.uid, 'travelEntries', entry.firestoreId), entryForFirestore);
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
    if (!user || !firestoreDb || !navigator.onLine) return;

    const unsynced = await db.travelEntries.filter(e => !e.firestoreId).toArray();
    if (unsynced.length === 0) return;

    console.log(`Reconciling ${unsynced.length} travel entries...`);
    const batch = writeBatch(firestoreDb);
    const updates: { localId: number, firestoreId: string }[] = [];

    for (const entry of unsynced) {
      if (entry.id) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { id, ...entryForFirestore } = entry;
        const docRef = doc(collection(firestoreDb, 'users', user.uid, 'travelEntries'));
        batch.set(docRef, entryForFirestore);
        updates.push({ localId: entry.id, firestoreId: docRef.id });
      }
    }

    try {
      await batch.commit();
      // Now update local Dexie DB with the new firestoreIds
      await db.transaction('rw', db.travelEntries, async () => {
        for (const update of updates) {
          await db.travelEntries.update(update.localId, { firestoreId: update.firestoreId });
        }
      });
      console.log('Reconciliation complete.');
      // Refresh data
      await get().loadTravelEntries();
    } catch (error) {
      console.error('Failed to reconcile travel entries:', error);
    }
  },
}));

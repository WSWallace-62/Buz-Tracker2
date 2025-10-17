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
} from 'firebase/firestore';
import { db as firestoreDb } from '../firebase';
import { useProjectsStore } from './projects';

export type { TravelEntry };

// Keep track of the unsubscribe function
let unsubscribeFromFirestore: Unsubscribe | null = null;

// Track recently added firestoreIds to prevent duplicates from sync listener
const recentlyAddedIds = new Set<string>();

interface TravelEntriesState {
  travelEntries: TravelEntry[];
  isLoading: boolean;
  error: string | null;
  isSyncing: boolean;

  // Actions
  loadTravelEntries: (filters?: {
    startDate?: number;
    endDate?: number;
    projectIds?: (string | number)[];
    customerIds?: (string | number)[];
  }) => Promise<void>;
  createTravelEntry: (entry: Omit<TravelEntry, 'id' | 'createdAt' | 'firestoreId'>) => Promise<void>;
  updateTravelEntry: (id: number, updates: Partial<TravelEntry>) => Promise<void>;
  deleteTravelEntry: (id: number) => Promise<void>;
  subscribeToTravelEntries: () => Unsubscribe;
  startSync: () => void;
  stopSync: () => void;
}

export const useTravelEntriesStore = create<TravelEntriesState>((set, get) => ({
  travelEntries: [],
  isLoading: true,
  error: null,
  isSyncing: false,

  startSync: () => {
    const user = getAuth().currentUser;
    if (!user || !firestoreDb) {
      console.log("User not logged in or firestore not available. Skipping travel entries sync.");
      get().loadTravelEntries();
      return;
    }

    if (unsubscribeFromFirestore) {
      console.log("Travel entries sync already active.");
      return;
    }

    set({ isSyncing: true });
    console.log("Starting Firestore travel entries sync...");

    const travelEntriesCollection = query(collection(firestoreDb, 'users', user.uid, 'travelEntries'));

    unsubscribeFromFirestore = onSnapshot(travelEntriesCollection, async (snapshot) => {
      set({ isLoading: true });
      const changes = snapshot.docChanges();

      await db.transaction('rw', db.travelEntries, async () => {
        // Get projects to convert Firestore project IDs to local IDs
        const projects = useProjectsStore.getState().projects;
        
        for (const change of changes) {
          const firestoreData = change.doc.data();
          const firestoreId = change.doc.id;

          // Convert Firestore projectId to local projectId
          const firestoreProjectId = firestoreData.projectId;
          let localProjectId = firestoreProjectId;
          
          // Check if projectId is a Firestore ID (string) and convert to local ID
          if (typeof firestoreProjectId === 'string') {
            const project = projects.find(p => p.firestoreId === firestoreProjectId);
            if (project?.id) {
              localProjectId = project.id;
            }
          }

          const existingEntry = await db.travelEntries.where('firestoreId').equals(firestoreId).first();

          switch (change.type) {
            case 'added':
              if (recentlyAddedIds.has(firestoreId)) {
                break;
              }
              if (!existingEntry) {
                await db.travelEntries.add({
                  ...firestoreData,
                  projectId: localProjectId,
                  firestoreId,
                } as TravelEntry);
              }
              break;
            case 'modified':
              if (existingEntry?.id) {
                await db.travelEntries.update(existingEntry.id, {
                  ...firestoreData,
                  projectId: localProjectId,
                  firestoreId,
                });
              }
              break;
            case 'removed':
              if (existingEntry?.id) {
                await db.travelEntries.delete(existingEntry.id);
              }
              break;
          }
        }
      });

      await get().loadTravelEntries();
    }, (error) => {
      console.error("Error with Firestore travel entries snapshot listener:", error);
      set({ error: "Failed to sync travel entries.", isSyncing: false });
    });
  },

  stopSync: () => {
    if (unsubscribeFromFirestore) {
      console.log("Stopping Firestore travel entries sync.");
      unsubscribeFromFirestore();
      unsubscribeFromFirestore = null;
    }
    set({ isSyncing: false });
  },

  loadTravelEntries: async (filters) => {
    set({ isLoading: true, error: null });
    try {
      let query = db.travelEntries.orderBy('date');

      if (filters?.startDate && filters?.endDate) {
        query = query.filter(entry =>
          entry.date >= filters.startDate! && entry.date <= filters.endDate!
        );
      }

      let entries = await query.reverse().toArray();

      if (filters?.projectIds && filters.projectIds.length > 0) {
        const projectIdsSet = new Set(filters.projectIds);
        entries = entries.filter(entry => projectIdsSet.has(entry.projectId));
      }

      if (filters?.customerIds && filters.customerIds.length > 0) {
        // Need to match by both customerFirestoreId and customerId for backward compatibility
        // First, get all customers to build a mapping
        const customers = await db.customers.toArray();
        const customerIdSet = new Set(filters.customerIds);

        // Build a set of firestoreIds that correspond to the requested customerIds
        const firestoreIdSet = new Set<string>();
        customers.forEach(customer => {
          if (customer.id && customerIdSet.has(customer.id) && customer.firestoreId) {
            firestoreIdSet.add(customer.firestoreId);
          }
        });

        entries = entries.filter(entry => {
          // Match by local customerId OR by customerFirestoreId
          const matchesLocalId = entry.customerId != null && customerIdSet.has(entry.customerId);
          const matchesFirestoreId = entry.customerFirestoreId && firestoreIdSet.has(entry.customerFirestoreId);
          return matchesLocalId || matchesFirestoreId;
        });
      }

      set({ travelEntries: entries, isLoading: false });
    } catch (error) {
      console.error("Failed to load travel entries:", error);
      set({ error: "Failed to load travel entries.", isLoading: false });
    }
  },

  createTravelEntry: async (entryData) => {
    const user = getAuth().currentUser;
    
    try {
      const newEntry: Omit<TravelEntry, 'id'> = {
        ...entryData,
        createdAt: Date.now(),
        userId: user?.uid,
      };

      const localId = await db.travelEntries.add(newEntry as TravelEntry);

      if (user && firestoreDb) {
        try {
          // Convert local projectId to Firestore projectId before syncing
          const projects = useProjectsStore.getState().projects;
          const project = projects.find(p => p.id === entryData.projectId);
          
          const entryForFirestore = {
            ...newEntry,
            projectId: project?.firestoreId || entryData.projectId, // Use Firestore ID if available
          };
          
          const docRef = await addDoc(
            collection(firestoreDb, 'users', user.uid, 'travelEntries'),
            entryForFirestore
          );

          recentlyAddedIds.add(docRef.id);
          setTimeout(() => recentlyAddedIds.delete(docRef.id), 5000);

          await db.travelEntries.update(localId, { firestoreId: docRef.id });
        } catch (firestoreError) {
          console.error("Failed to sync travel entry to Firestore:", firestoreError);
        }
      }

      await get().loadTravelEntries();
    } catch (error) {
      console.error("Failed to create travel entry:", error);
      useUIStore.getState().showToast('Failed to add travel entry', 'error');
      throw error;
    }
  },

  updateTravelEntry: async (id, updates) => {
    const user = getAuth().currentUser;

    try {
      await db.travelEntries.update(id, updates);

      const entry = await db.travelEntries.get(id);
      if (entry?.firestoreId && user && firestoreDb) {
        try {
          await updateDoc(
            doc(firestoreDb, 'users', user.uid, 'travelEntries', entry.firestoreId),
            updates as any
          );
        } catch (firestoreError) {
          console.error("Failed to sync travel entry update to Firestore:", firestoreError);
        }
      }

      await get().loadTravelEntries();
      useUIStore.getState().showToast('Travel entry updated successfully', 'success');
    } catch (error) {
      console.error("Failed to update travel entry:", error);
      useUIStore.getState().showToast('Failed to update travel entry', 'error');
      throw error;
    }
  },

  deleteTravelEntry: async (id) => {
    const user = getAuth().currentUser;

    try {
      const entry = await db.travelEntries.get(id);
      
      await db.travelEntries.delete(id);

      if (entry?.firestoreId && user && firestoreDb) {
        try {
          await deleteDoc(
            doc(firestoreDb, 'users', user.uid, 'travelEntries', entry.firestoreId)
          );
        } catch (firestoreError) {
          console.error("Failed to delete travel entry from Firestore:", firestoreError);
        }
      }

      await get().loadTravelEntries();
    } catch (error) {
      console.error("Failed to delete travel entry:", error);
      useUIStore.getState().showToast('Failed to delete travel entry', 'error');
      throw error;
    }
  },



  subscribeToTravelEntries: () => {
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user || !firestoreDb) {
      console.log("User not logged in or firestore not available. Skipping travel entries sync.");
      return () => {};
    }

    if (unsubscribeFromFirestore) {
      console.log("Travel entries sync already active.");
      return () => {};
    }

    set({ isSyncing: true });
    console.log("Starting Firestore travel entries sync...");

    const travelEntriesCollection = query(collection(firestoreDb, 'users', user.uid, 'travelEntries'));

    unsubscribeFromFirestore = onSnapshot(travelEntriesCollection, async (snapshot) => {
      set({ isLoading: true });
      const changes = snapshot.docChanges();

      await db.transaction('rw', db.travelEntries, async () => {
        for (const change of changes) {
          const firestoreData = change.doc.data();
          const firestoreId = change.doc.id;

          const existingEntry = await db.travelEntries.where('firestoreId').equals(firestoreId).first();

          switch (change.type) {
            case 'added':
              if (recentlyAddedIds.has(firestoreId)) {
                break;
              }
              if (!existingEntry) {
                await db.travelEntries.add({
                  ...firestoreData,
                  firestoreId,
                } as TravelEntry);
              }
              break;
            case 'modified':
              if (existingEntry?.id) {
                await db.travelEntries.update(existingEntry.id, {
                  ...firestoreData,
                  firestoreId,
                });
              }
              break;
            case 'removed':
              if (existingEntry?.id) {
                await db.travelEntries.delete(existingEntry.id);
              }
              break;
          }
        }
      });

      await get().loadTravelEntries();
    }, (error) => {
      console.error("Error with Firestore travel entries snapshot listener:", error);
      set({ error: "Failed to sync travel entries.", isSyncing: false });
    });

    return () => {
      if (unsubscribeFromFirestore) {
        console.log("Stopping Firestore travel entries sync.");
        unsubscribeFromFirestore();
        unsubscribeFromFirestore = null;
      }
      set({ isSyncing: false });
    };
  },

  reconcileTravelEntries: async () => {
    const user = getAuth().currentUser;
    if (!user || !firestoreDb) {
      console.log("User not logged in. Skipping travel entries reconciliation.");
      return;
    }

    try {
      const entriesWithoutFirestoreId = await db.travelEntries
        .filter(entry => !entry.firestoreId)
        .toArray();

      console.log(`Reconciling ${entriesWithoutFirestoreId.length} travel entries...`);

      for (const entry of entriesWithoutFirestoreId) {
        try {
          const docRef = await addDoc(
            collection(firestoreDb, 'users', user.uid, 'travelEntries'),
            {
              projectId: entry.projectId,
              customerId: entry.customerId,
              customerFirestoreId: entry.customerFirestoreId,
              date: entry.date,
              distance: entry.distance,
              unit: entry.unit,
              note: entry.note,
              createdAt: entry.createdAt,
              userId: entry.userId,
              organizationId: entry.organizationId,
            }
          );
          // Update local entry with the new Firestore ID
          if (entry.id) {
            await db.travelEntries.update(entry.id, { firestoreId: docRef.id });
          }
        } catch (firestoreError) {
          console.error(`Failed to reconcile travel entry ${entry.id}:`, firestoreError);
        }
      }
    } catch (error) {
      console.error("Error during travel entry reconciliation:", error);
    }
  },
}));

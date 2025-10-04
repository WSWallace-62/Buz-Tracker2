import { create } from 'zustand'
import { db, PredefinedNote } from '../db/dexie'
import { db as firestoreDB } from '../firebase'
import { collection, addDoc, doc, updateDoc, deleteDoc, onSnapshot, query, Unsubscribe } from 'firebase/firestore'
import { useAuthStore } from './auth'

// Keep track of the unsubscribe function for predefined notes
let unsubscribeFromPredefinedNotes: Unsubscribe | null = null;

// Track recently added predefined notes to avoid duplicates from sync
const recentlyAddedIds = new Set<string>();

// Track notes being added (by content hash + timestamp) to prevent race conditions
const notesBeingAdded = new Map<string, number>(); // key: note content, value: timestamp

interface PredefinedNotesState {
  predefinedNotes: PredefinedNote[]
  isLoading: boolean
  error: string | null

  // Actions
  loadPredefinedNotes: () => Promise<void>
  addPredefinedNote: (note: string) => Promise<void>
  updatePredefinedNote: (id: number, note: string) => Promise<void>
  deletePredefinedNote: (id: number) => Promise<void>
  startPredefinedNotesSync: () => void
  stopPredefinedNotesSync: () => void
}

export const usePredefinedNotesStore = create<PredefinedNotesState>((set, get) => ({
  predefinedNotes: [],
  isLoading: false,
  error: null,

  startPredefinedNotesSync: () => {
    // Stop any existing listener
    if (unsubscribeFromPredefinedNotes) {
      unsubscribeFromPredefinedNotes();
    }

    const { user } = useAuthStore.getState();
    if (!user) {
      console.error("Cannot start predefined notes sync: User not authenticated");
      return;
    }

    if (!firestoreDB) {
      console.error("Cannot start predefined notes sync: Firestore not initialized");
      return;
    }

    const notesCollection = collection(firestoreDB, 'users', user.uid, 'predefinedNotes');
    unsubscribeFromPredefinedNotes = onSnapshot(notesCollection, async (snapshot) => {
      let hasChanges = false;

      await db.transaction('rw', db.predefinedNotes, async () => {
        for (const change of snapshot.docChanges()) {
          const fsNote = { ...change.doc.data(), firestoreId: change.doc.id } as PredefinedNote;
          const existingNote = await db.predefinedNotes.where('firestoreId').equals(fsNote.firestoreId!).first();

          switch (change.type) {
            case 'added':
              // Check if this note is currently being added locally
              const noteContent = fsNote.note;
              const isBeingAdded = notesBeingAdded.has(noteContent);

              // If this was recently added locally (by ID or content), skip adding from snapshot
              if (fsNote.firestoreId && recentlyAddedIds.has(fsNote.firestoreId)) {
                console.log(`Skipping recently added note by ID: ${fsNote.firestoreId}`);
                break;
              }

              if (isBeingAdded) {
                const addedTime = notesBeingAdded.get(noteContent)!;
                const timeSinceAdded = Date.now() - addedTime;
                // Only skip if it was added very recently (within 10 seconds)
                if (timeSinceAdded < 10000) {
                  console.log(`Skipping note being added locally: "${noteContent}" (${timeSinceAdded}ms ago)`);
                  break;
                }
              }

              if (!existingNote) {
                await db.predefinedNotes.add(fsNote);
                hasChanges = true;
                console.log(`Added note from Firestore: ${fsNote.firestoreId}`);
              }
              break;
            case 'modified':
              if (existingNote?.id) {
                await db.predefinedNotes.update(existingNote.id, fsNote);
                hasChanges = true;
                console.log(`Updated note from Firestore: ${fsNote.firestoreId}`);
              }
              break;
            case 'removed':
               if (existingNote?.id) {
                await db.predefinedNotes.delete(existingNote.id);
                hasChanges = true;
                console.log(`Deleted note from Firestore: ${fsNote.firestoreId}`);
              }
              break;
          }
        }
      });

      // Only reload notes if actual changes were made to Dexie
      if (hasChanges) {
        console.log('Reloading predefined notes after sync changes');
        await get().loadPredefinedNotes();
      }
    }, (error) => {
      console.error("Error with Firestore predefined notes snapshot listener:", error);
      set({ error: "Failed to sync predefined notes." });
    });
  },

  stopPredefinedNotesSync: () => {
    if (unsubscribeFromPredefinedNotes) {
      console.log("Stopping Firestore predefined notes sync.");
      unsubscribeFromPredefinedNotes();
      unsubscribeFromPredefinedNotes = null;
    }
  },

  loadPredefinedNotes: async () => {
    set({ isLoading: true, error: null })
    try {
      const notes = await db.predefinedNotes.orderBy('createdAt').toArray()
      set({ predefinedNotes: notes, isLoading: false })
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false })
    }
  },

  addPredefinedNote: async (noteText) => {
    const { user } = useAuthStore.getState()
    if (!user) {
      set({ error: "User not authenticated" })
      return
    }

    try {
      if (!firestoreDB) throw new Error("Firestore not initialized");

      // Track that we're adding this note BEFORE making any async calls
      notesBeingAdded.set(noteText, Date.now());
      console.log(`Started adding note: "${noteText}"`);

      // 1. Save to Firestore to get the firestoreId
      const notesCol = collection(firestoreDB, 'users', user.uid, 'predefinedNotes');
      const newNoteFsData = {
        note: noteText,
        createdAt: Date.now(),
      }
      const docRef = await addDoc(notesCol, newNoteFsData);

      console.log(`Added note to Firestore with ID: ${docRef.id}`);

      // Track this ID IMMEDIATELY to prevent duplicate from sync listener
      recentlyAddedIds.add(docRef.id);
      console.log(`Tracking note ID to prevent duplicates: ${docRef.id}`);

      // 2. Save to Dexie with the new firestoreId for instant UI feedback
      const newNote: PredefinedNote = {
        ...newNoteFsData,
        firestoreId: docRef.id
      }
      const dexieId = await db.predefinedNotes.add(newNote);
      console.log(`Added note to Dexie with local ID: ${dexieId}, Firestore ID: ${docRef.id}`);

      // 3. Reload notes from Dexie to update UI
      await get().loadPredefinedNotes();

      // Clean up the tracking sets after a delay to ensure sync listener has processed
      setTimeout(() => {
        recentlyAddedIds.delete(docRef.id);
        notesBeingAdded.delete(noteText);
        console.log(`Removed tracking for note ID: ${docRef.id}`);
      }, 10000); // Increased to 10 seconds to match the sync check
    } catch (error) {
      console.error('Error adding predefined note:', error);
      // Clean up tracking on error
      notesBeingAdded.delete(noteText);
      set({ error: (error as Error).message })
    }
  },

  updatePredefinedNote: async (id, noteText) => {
    const { user } = useAuthStore.getState()
    if (!user) {
      set({ error: "User not authenticated" })
      return
    }

    try {
      // Update Firestore
      const note = get().predefinedNotes.find(n => n.id === id)
      if (note?.firestoreId) {
        if (!firestoreDB) throw new Error("Firestore not initialized");
        const noteRef = doc(firestoreDB, 'users', user.uid, 'predefinedNotes', note.firestoreId);
        await updateDoc(noteRef, { note: noteText });
      }

      // Update Dexie
      await db.predefinedNotes.update(id, { note: noteText })

      set(state => ({
        predefinedNotes: state.predefinedNotes.map(n =>
          n.id === id ? { ...n, note: noteText } : n
        )
      }))
    } catch (error) {
      set({ error: (error as Error).message })
    }
  },

  deletePredefinedNote: async (id) => {
    const { user } = useAuthStore.getState()
    if (!user) {
      set({ error: "User not authenticated" })
      return
    }

    try {
      // Delete from Firestore
      const note = get().predefinedNotes.find(n => n.id === id)
      if (note?.firestoreId) {
        if (!firestoreDB) throw new Error("Firestore not initialized");
        const noteRef = doc(firestoreDB, 'users', user.uid, 'predefinedNotes', note.firestoreId);
        await deleteDoc(noteRef);
      }

      // Delete from Dexie
      await db.predefinedNotes.delete(id)

      set(state => ({
        predefinedNotes: state.predefinedNotes.filter(n => n.id !== id)
      }))
    } catch (error) {
      set({ error: (error as Error).message })
    }
  },
}))

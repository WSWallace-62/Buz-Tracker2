import { create } from 'zustand'
import { db, PredefinedNote } from '../db/dexie'
import { db as firestoreDB } from '../firebase'
import { collection, addDoc, doc, updateDoc, deleteDoc, onSnapshot, query, Unsubscribe } from 'firebase/firestore'
import { useAuthStore } from './auth'

// Keep track of the unsubscribe function for predefined notes
let unsubscribeFromPredefinedNotes: Unsubscribe | null = null;

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
    const user = useAuthStore.getState().user;
    if (!user || !firestoreDB) {
      console.log("User not logged in or firestore not available. Skipping predefined notes sync.");
      get().loadPredefinedNotes(); // Still load local notes
      return;
    }

    if (unsubscribeFromPredefinedNotes) {
      console.log("Predefined notes sync already active.");
      return;
    }

    console.log("Starting Firestore predefined notes sync...");
    const notesCollection = query(collection(firestoreDB, 'users', user.uid, 'predefinedNotes'));

    unsubscribeFromPredefinedNotes = onSnapshot(notesCollection, async (snapshot) => {
      await db.transaction('rw', db.predefinedNotes, async () => {
        for (const change of snapshot.docChanges()) {
          const fsNote = { ...change.doc.data(), firestoreId: change.doc.id } as PredefinedNote;
          const existingNote = await db.predefinedNotes.where('firestoreId').equals(fsNote.firestoreId!).first();

          switch (change.type) {
            case 'added':
              if (!existingNote) {
                 await db.predefinedNotes.add(fsNote);
              }
              break;
            case 'modified':
              if (existingNote?.id) {
                await db.predefinedNotes.update(existingNote.id, fsNote);
              }
              break;
            case 'removed':
               if (existingNote?.id) {
                await db.predefinedNotes.delete(existingNote.id);
              }
              break;
          }
        }
      });
      // After processing changes, reload all notes from Dexie to update UI
      await get().loadPredefinedNotes();
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

      // 1. Save to Firestore to get the firestoreId
      const notesCol = collection(firestoreDB, 'users', user.uid, 'predefinedNotes');
      const newNoteFsData = {
        note: noteText,
        createdAt: Date.now(),
      }
      const docRef = await addDoc(notesCol, newNoteFsData);

      // 2. Save to Dexie with the new firestoreId
      const newNote: PredefinedNote = {
        ...newNoteFsData,
        firestoreId: docRef.id
      }
      const id = await db.predefinedNotes.add(newNote)
      const noteWithId = { ...newNote, id: id as number }

      set(state => ({
        predefinedNotes: [...state.predefinedNotes, noteWithId]
      }))
    } catch (error) {
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

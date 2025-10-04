import { create } from 'zustand';
import { db, Customer } from '../db/dexie';
import { db as firestoreDB } from '../firebase';
import { collection, addDoc, doc, updateDoc, deleteDoc, onSnapshot, query, Unsubscribe } from 'firebase/firestore';
import { useAuthStore } from './auth';

// Keep track of the unsubscribe function for customers
let unsubscribeFromCustomers: Unsubscribe | null = null;

interface CustomersState {
  customers: Customer[];
  isLoading: boolean;
  error: string | null;
  
  // Actions
  loadCustomers: () => Promise<void>;
  addCustomer: (customer: Omit<Customer, 'id' | 'createdAt'>) => Promise<void>;
  updateCustomer: (id: number, updates: Partial<Customer>) => Promise<void>;
  deleteCustomer: (id: number) => Promise<void>;
  archiveCustomer: (id: number, archived: boolean) => Promise<void>;
  startCustomerSync: () => void;
  stopCustomerSync: () => void;
}

export const useCustomersStore = create<CustomersState>((set, get) => ({
  customers: [],
  isLoading: false,
  error: null,

  startCustomerSync: () => {
    const user = useAuthStore.getState().user;
    if (!user || !firestoreDB) {
      console.log("User not logged in or firestore not available. Skipping customer sync.");
      get().loadCustomers(); // Still load local customers
      return;
    }

    if (unsubscribeFromCustomers) {
      console.log("Customer sync already active.");
      return;
    }
    
    console.log("Starting Firestore customer sync...");
    const customersCollection = query(collection(firestoreDB, 'users', user.uid, 'customers'));

    unsubscribeFromCustomers = onSnapshot(customersCollection, async (snapshot) => {
      await db.transaction('rw', db.customers, async () => {
        for (const change of snapshot.docChanges()) {
          const fsCustomer = { ...change.doc.data(), firestoreId: change.doc.id } as Customer;
          const existingCustomer = await db.customers.where('firestoreId').equals(fsCustomer.firestoreId!).first();
          
          switch (change.type) {
            case 'added':
              if (!existingCustomer) {
                await db.customers.add(fsCustomer);
              }
              break;
            case 'modified':
              if (existingCustomer?.id) {
                await db.customers.update(existingCustomer.id, fsCustomer);
              }
              break;
            case 'removed':
              if (existingCustomer?.id) {
                await db.customers.delete(existingCustomer.id);
              }
              break;
          }
        }
      });
      // After processing changes, reload all customers from Dexie to update UI
      await get().loadCustomers();
    }, (error) => {
      console.error("Error with Firestore customer snapshot listener:", error);
      set({ error: "Failed to sync customers." });
    });
  },

  stopCustomerSync: () => {
    if (unsubscribeFromCustomers) {
      console.log("Stopping Firestore customer sync.");
      unsubscribeFromCustomers();
      unsubscribeFromCustomers = null;
    }
  },

  loadCustomers: async () => {
    set({ isLoading: true, error: null });
    try {
      const customers = await db.customers.orderBy('createdAt').toArray();
      set({ customers, isLoading: false });
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
    }
  },

  addCustomer: async (customerData) => {
    const { user } = useAuthStore.getState();
    if (!user) {
      set({ error: "User not authenticated" });
      return;
    }

    try {
      const newCustomer: Omit<Customer, 'id'> = {
        ...customerData,
        createdAt: Date.now(),
      };

      // Add to Firestore first
      if (firestoreDB) {
        const docRef = await addDoc(
          collection(firestoreDB, 'users', user.uid, 'customers'),
          newCustomer
        );
        
        // Add to Dexie with firestoreId
        await db.customers.add({
          ...newCustomer,
          firestoreId: docRef.id
        });
      } else {
        // If no Firestore, just add to Dexie
        await db.customers.add(newCustomer);
      }

      // Reload customers
      await get().loadCustomers();
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },

  updateCustomer: async (id, updates) => {
    const { user } = useAuthStore.getState();
    if (!user) {
      set({ error: "User not authenticated" });
      return;
    }

    try {
      const customer = await db.customers.get(id);
      if (!customer) {
        throw new Error("Customer not found");
      }

      // Update in Firestore if it has a firestoreId
      if (customer.firestoreId && firestoreDB) {
        const customerRef = doc(firestoreDB, 'users', user.uid, 'customers', customer.firestoreId);
        await updateDoc(customerRef, updates);
      }

      // Update in Dexie
      await db.customers.update(id, updates);

      // Reload customers
      await get().loadCustomers();
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },

  deleteCustomer: async (id) => {
    const { user } = useAuthStore.getState();
    if (!user) {
      set({ error: "User not authenticated" });
      return;
    }

    try {
      const customer = await db.customers.get(id);
      if (!customer) {
        throw new Error("Customer not found");
      }

      // Delete from Firestore if it has a firestoreId
      if (customer.firestoreId && firestoreDB) {
        const customerRef = doc(firestoreDB, 'users', user.uid, 'customers', customer.firestoreId);
        await deleteDoc(customerRef);
      }

      // Delete from Dexie
      await db.customers.delete(id);

      // Reload customers
      await get().loadCustomers();
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },

  archiveCustomer: async (id, archived) => {
    await get().updateCustomer(id, { archived });
  },
}));

import { create } from 'zustand';
import { User } from 'firebase/auth';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';

// This interface defines the structure of the user document stored in Firestore.
interface UserDocument {
  organizations?: string[];
  activeOrganization?: string;
  // other user-specific fields can go here
}

interface AuthState {
  user: User | null; // The raw Firebase Auth user object
  userDoc: UserDocument | null; // The user's document from the 'users' collection
  activeOrganization: string | null; // The ID of the currently active organization
  isLoading: boolean; // To track the initial auth state check
  // Asynchronously sets the user and fetches their associated data from Firestore.
  setUserAndOrg: (user: User | null) => Promise<void>;
  // Sets the active organization in the state and updates it in Firestore.
  setActiveOrganization: (orgId: string) => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  userDoc: null,
  activeOrganization: null,
  isLoading: true, // Start in a loading state

  setUserAndOrg: async (user) => {
    if (user) {
      try {
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
          const userDoc = userSnap.data() as UserDocument;
          // Determine the active organization: use the one from the doc, or default to the first in the list.
          const activeOrg = userDoc.activeOrganization || (userDoc.organizations?.[0] || null);
          
          set({
            user,
            userDoc,
            activeOrganization: activeOrg,
            isLoading: false,
          });
        } else {
          // Handle case where a user is authenticated but has no document in Firestore.
          // This might be a new user sign-up.
          console.warn(`User document not found for UID: ${user.uid}.`);
          set({ user, userDoc: null, activeOrganization: null, isLoading: false });
        }
      } catch (error) {
        console.error("Error fetching user document:", error);
        // Clear state on error to prevent partial data issues
        set({ user: null, userDoc: null, activeOrganization: null, isLoading: false });
      }
    } else {
      // User is logged out, clear all user-related state.
      set({ user: null, userDoc: null, activeOrganization: null, isLoading: false });
    }
  },

  setActiveOrganization: async (orgId: string) => {
    const { user, userDoc } = get();

    // Ensure the user is logged in and the orgId is valid for them.
    if (user && userDoc?.organizations?.includes(orgId)) {
      set({ activeOrganization: orgId });
      // Persist this change to Firestore so it's remembered across sessions.
      try {
        const userRef = doc(db, 'users', user.uid);
        await updateDoc(userRef, { activeOrganization: orgId });
      } catch (error) {
        console.error("Failed to update active organization in Firestore:", error);
        // Optional: revert state change on UI if persistence fails
      }
    } else {
      console.warn(`Attempted to switch to an invalid or un-authed organization: ${orgId}`);
    }
  },
}));

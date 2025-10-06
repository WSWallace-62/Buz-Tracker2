import { create } from 'zustand';
import { db, Organization, CorporateInfo } from '../db/dexie';
import { 
  createOrganization as createOrgFirestore,
  getOrganization as getOrgFirestore,
  updateOrganization as updateOrgFirestore,
  getUserOrganizationId,
  subscribeToOrganization
} from '../services/organizationService';
import { useAuthStore } from './auth';
import { Unsubscribe } from 'firebase/firestore';

let unsubscribeFromOrganization: Unsubscribe | null = null;

interface OrganizationState {
  organization: Organization | null;
  isLoading: boolean;
  error: string | null;
  isSyncing: boolean;

  // Actions
  loadOrganization: () => Promise<void>;
  createOrganization: (corporateInfo: CorporateInfo) => Promise<void>;
  updateOrganization: (corporateInfo: Partial<CorporateInfo>) => Promise<void>;
  startOrganizationSync: () => Promise<void>;
  stopOrganizationSync: () => void;
  clearOrganization: () => void;
}

export const useOrganizationStore = create<OrganizationState>((set, get) => ({
  organization: null,
  isLoading: false,
  error: null,
  isSyncing: false,

  loadOrganization: async () => {
    set({ isLoading: true, error: null });
    try {
      // Load from IndexedDB first
      const orgs = await db.organizations.toArray();
      if (orgs.length > 0) {
        set({ organization: orgs[0], isLoading: false });
      } else {
        set({ organization: null, isLoading: false });
      }
    } catch (error) {
      console.error('Error loading organization:', error);
      set({ error: 'Failed to load organization', isLoading: false });
    }
  },

  createOrganization: async (corporateInfo: CorporateInfo) => {
    const user = useAuthStore.getState().user;
    if (!user) {
      throw new Error('User must be logged in to create an organization');
    }

    set({ isLoading: true, error: null });
    try {
      // Create in Firestore
      const orgId = await createOrgFirestore(user.uid, corporateInfo);

      // Create in IndexedDB
      const now = Date.now();
      const newOrg: Organization = {
        firestoreId: orgId,
        corporateInfo,
        createdBy: user.uid,
        createdAt: now,
        updatedAt: now,
      };

      await db.organizations.add(newOrg);

      // Update user record in IndexedDB
      const existingUser = await db.users.where('userId').equals(user.uid).first();
      if (existingUser) {
        await db.users.update(existingUser.id!, {
          organizationId: orgId,
          role: 'owner',
          updatedAt: now
        });
      } else {
        await db.users.add({
          userId: user.uid,
          organizationId: orgId,
          role: 'owner',
          updatedAt: now
        });
      }

      set({ organization: newOrg, isLoading: false });
      
      // Start syncing after creation
      await get().startOrganizationSync();
    } catch (error) {
      console.error('Error creating organization:', error);
      set({ error: 'Failed to create organization', isLoading: false });
      throw error;
    }
  },

  updateOrganization: async (corporateInfo: Partial<CorporateInfo>) => {
    const { organization } = get();
    if (!organization || !organization.firestoreId) {
      throw new Error('No organization to update');
    }

    set({ isLoading: true, error: null });
    try {
      // Update in Firestore
      await updateOrgFirestore(organization.firestoreId, corporateInfo);

      // Update in IndexedDB
      const updatedOrg: Organization = {
        ...organization,
        corporateInfo: {
          ...organization.corporateInfo,
          ...corporateInfo
        },
        updatedAt: Date.now()
      };

      if (organization.id) {
        await db.organizations.update(organization.id, updatedOrg);
      }

      set({ organization: updatedOrg, isLoading: false });
    } catch (error) {
      console.error('Error updating organization:', error);
      set({ error: 'Failed to update organization', isLoading: false });
      throw error;
    }
  },

  startOrganizationSync: async () => {
    const user = useAuthStore.getState().user;
    if (!user) {
      console.log('User not logged in. Skipping organization sync.');
      await get().loadOrganization();
      return;
    }

    if (unsubscribeFromOrganization) {
      console.log('Organization sync already active.');
      return;
    }

    set({ isSyncing: true });

    try {
      // Get user's organization ID
      const orgId = await getUserOrganizationId(user.uid);
      
      if (!orgId) {
        console.log('User has no organization yet.');
        set({ isSyncing: false });
        await get().loadOrganization();
        return;
      }

      // Fetch organization once to ensure we have it
      const org = await getOrgFirestore(orgId);
      if (org) {
        // Save to IndexedDB
        const existingOrg = await db.organizations.where('firestoreId').equals(orgId).first();
        if (existingOrg) {
          await db.organizations.update(existingOrg.id!, org);
        } else {
          await db.organizations.add(org);
        }
        set({ organization: org });
      }

      // Subscribe to real-time updates
      console.log('Starting Firestore organization sync...');
      unsubscribeFromOrganization = subscribeToOrganization(
        orgId,
        async (updatedOrg) => {
          // Update IndexedDB
          const existingOrg = await db.organizations.where('firestoreId').equals(orgId).first();
          if (existingOrg) {
            await db.organizations.update(existingOrg.id!, updatedOrg);
          } else {
            await db.organizations.add(updatedOrg);
          }
          
          // Update state
          set({ organization: updatedOrg });
        },
        (error) => {
          console.error('Error with Firestore organization snapshot listener:', error);
          set({ error: 'Failed to sync organization' });
        }
      );

      set({ isSyncing: false });
    } catch (error) {
      console.error('Error starting organization sync:', error);
      set({ error: 'Failed to start organization sync', isSyncing: false });
    }
  },

  stopOrganizationSync: () => {
    if (unsubscribeFromOrganization) {
      console.log('Stopping Firestore organization sync.');
      unsubscribeFromOrganization();
      unsubscribeFromOrganization = null;
    }
    set({ isSyncing: false });
  },

  clearOrganization: () => {
    get().stopOrganizationSync();
    set({ organization: null, isLoading: false, error: null, isSyncing: false });
  }
}));

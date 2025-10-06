import { db as firestoreDB } from '../firebase';
import {
  collection,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  onSnapshot,
  Unsubscribe,
  serverTimestamp,
  Timestamp,
  FieldValue
} from 'firebase/firestore';
import { Organization, CorporateInfo } from '../db/dexie';

export interface FirestoreOrganization {
  corporateInfo: CorporateInfo;
  createdBy: string;
  createdAt: Timestamp | FieldValue | number;
  updatedAt: Timestamp | FieldValue | number;
  members?: {
    [userId: string]: {
      role: 'owner' | 'admin' | 'user';
      addedAt: Timestamp | FieldValue | number;
      email?: string;
    };
  };
}

/**
 * Create a new organization in Firestore
 */
export async function createOrganization(
  userId: string,
  corporateInfo: CorporateInfo
): Promise<string> {
  if (!firestoreDB) {
    throw new Error('Firestore is not initialized. Please check your Firebase configuration.');
  }

  try {
    const orgRef = doc(collection(firestoreDB, 'organizations'));
    const orgId = orgRef.id;

    const orgData: FirestoreOrganization = {
      corporateInfo,
      createdBy: userId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      members: {
        [userId]: {
          role: 'owner',
          addedAt: serverTimestamp(),
        }
      }
    };

    await setDoc(orgRef, orgData);

    // Update user document with organizationId
    const userRef = doc(firestoreDB, 'users', userId);
    await setDoc(userRef, {
      organizationId: orgId,
      role: 'owner',
      updatedAt: serverTimestamp()
    }, { merge: true });

    return orgId;
  } catch (error) {
    console.error('Error creating organization in Firestore:', error);
    if (error instanceof Error) {
      throw new Error(`Failed to create organization: ${error.message}`);
    }
    throw new Error('Failed to create organization. Please check your internet connection and try again.');
  }
}

/**
 * Get organization by ID
 */
export async function getOrganization(orgId: string): Promise<Organization | null> {
  if (!firestoreDB) {
    throw new Error('Firestore is not initialized');
  }

  const orgRef = doc(firestoreDB, 'organizations', orgId);
  const orgSnap = await getDoc(orgRef);

  if (!orgSnap.exists()) {
    return null;
  }

  const data = orgSnap.data() as FirestoreOrganization;

  return {
    firestoreId: orgSnap.id,
    corporateInfo: data.corporateInfo,
    createdBy: data.createdBy,
    createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toMillis() : (typeof data.createdAt === 'number' ? data.createdAt : Date.now()),
    updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toMillis() : (typeof data.updatedAt === 'number' ? data.updatedAt : Date.now()),
  };
}

/**
 * Update organization corporate info
 */
export async function updateOrganization(
  orgId: string,
  corporateInfo: Partial<CorporateInfo>
): Promise<void> {
  if (!firestoreDB) {
    throw new Error('Firestore is not initialized. Please check your Firebase configuration.');
  }

  try {
    const orgRef = doc(firestoreDB, 'organizations', orgId);

    await updateDoc(orgRef, {
      corporateInfo,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error('Error updating organization in Firestore:', error);
    if (error instanceof Error) {
      throw new Error(`Failed to update organization: ${error.message}`);
    }
    throw new Error('Failed to update organization. Please check your internet connection and try again.');
  }
}

/**
 * Get user's organization ID from Firestore
 */
export async function getUserOrganizationId(userId: string): Promise<string | null> {
  if (!firestoreDB) {
    throw new Error('Firestore is not initialized');
  }

  const userRef = doc(firestoreDB, 'users', userId);
  const userSnap = await getDoc(userRef);

  if (!userSnap.exists()) {
    return null;
  }

  const data = userSnap.data();
  return data.organizationId || null;
}

/**
 * Subscribe to organization changes
 */
export function subscribeToOrganization(
  orgId: string,
  onUpdate: (org: Organization) => void,
  onError: (error: Error) => void
): Unsubscribe {
  if (!firestoreDB) {
    throw new Error('Firestore is not initialized');
  }

  const orgRef = doc(firestoreDB, 'organizations', orgId);

  return onSnapshot(
    orgRef,
    (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data() as FirestoreOrganization;
        const org: Organization = {
          firestoreId: snapshot.id,
          corporateInfo: data.corporateInfo,
          createdBy: data.createdBy,
          createdAt: data.createdAt instanceof Timestamp
            ? data.createdAt.toMillis()
            : (typeof data.createdAt === 'number' ? data.createdAt : Date.now()),
          updatedAt: data.updatedAt instanceof Timestamp
            ? data.updatedAt.toMillis()
            : (typeof data.updatedAt === 'number' ? data.updatedAt : Date.now()),
        };
        onUpdate(org);
      }
    },
    (error) => {
      onError(error);
    }
  );
}
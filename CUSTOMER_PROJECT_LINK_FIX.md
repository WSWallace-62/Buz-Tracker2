# Customer-Project Link Fix & Predefined Notes Duplicate Fix

## Problem 1: Customer-Project Links Lost After Refresh
After a refresh, projects were no longer linked to their customers in the UI, even though the customer ID was stored in the database.

### Root Cause
The issue was caused by storing the **local Dexie customer ID** (a number) in the project's `customerId` field. When the application refreshed and synced data from Firestore:

1. Customers were synced from Firestore and assigned **new local Dexie IDs**
2. Projects were synced from Firestore with their stored `customerId` values
3. The `customerId` values no longer matched any customer because the customers had new local IDs

### Solution
Instead of storing the local Dexie customer ID, we now store the **Firestore customer ID** (a string) in a new field called `customerFirestoreId`. This ID is stable across syncs and refreshes.

## Problem 2: Duplicate Predefined Notes in UI
When creating a new predefined note on the stopwatch card, it appeared twice in the UI but only had one entry in the database. Refreshing didn't clear the duplicate, but logging off and back in did.

### Root Cause
The issue was caused by **manually updating the state** after adding a note, AND then having the sync listener reload all notes:

1. User creates a new predefined note
2. Note is added to Firestore (line 120)
3. Note is added to local Dexie database (line 131)
4. **Note is manually added to the state** (lines 134-136) ← **This was the problem!**
5. Firestore sync listener detects the new document
6. Sync listener calls `loadPredefinedNotes()` (line 79) which reloads all notes from Dexie
7. Now the note appears twice in the UI: once from the manual state update, once from the reload

The tracking set (`recentlyAddedIds`) was preventing the note from being added to Dexie twice, but it couldn't prevent the duplicate in the UI state because the manual state update happened before the sync listener fired.

### Solution
**Remove the manual state update** and instead call `loadPredefinedNotes()` to reload from Dexie. This ensures the UI state is always in sync with the database and prevents duplicates.

The fix follows the same pattern used in the customers store:
1. Track the Firestore ID immediately (line 123)
2. Add to Dexie (line 130)
3. **Call `loadPredefinedNotes()` to reload from Dexie** (line 133) ← **Key fix!**
4. Clean up the tracking set after 5 seconds (lines 136-138)

## Changes Made

### 1. Database Schema (`src/db/dexie.ts`)
- Added `customerFirestoreId?: string` field to the `Project` interface
- Kept `customerId?: number` for backward compatibility
- Upgraded database to version 614 with migration to populate `customerFirestoreId` from existing `customerId` values
- Updated initialization code to set both `customerId` and `customerFirestoreId` when creating default projects

### 2. Project Manager Modal (`src/components/ProjectManagerModal.tsx`)
- Updated form data to use `customerFirestoreId` instead of `customerId`
- Modified customer dropdown to use `customer.firestoreId` as the value
- Updated project creation/update to set both `customerId` (for backward compatibility) and `customerFirestoreId`
- Enhanced ProjectItem component to display customer name by looking up customer using `customerFirestoreId`

### 3. Customer Card (`src/components/CustomerCard.tsx`)
- Updated project query to use `customerFirestoreId` instead of `customerId`
- Added fallback to `customerId` for backward compatibility with old data

### 4. Projects Store (`src/store/projects.ts`)
- Updated sync logic to populate `customerId` from `customerFirestoreId` when syncing from Firestore
- Updated reconciliation logic to handle `customerFirestoreId` properly
- Ensured both fields are maintained during all sync operations

### 5. Predefined Notes Store (`src/store/predefinedNotes.ts`)
- Added `recentlyAddedIds` Set to track recently created notes (line 11)
- Updated sync listener to skip notes that were recently added locally (lines 57-60)
- **Fixed `addPredefinedNote` to call `loadPredefinedNotes()` instead of manually updating state** (line 133)
- Track the new note's Firestore ID immediately (line 123)
- Clean up tracking set after 5 seconds (lines 136-138)

## Key Insight: State Management Pattern

The correct pattern for adding items with Firestore sync is:

```typescript
// ✅ CORRECT - Reload from database
async addItem(data) {
  const docRef = await addDoc(collection, data);
  recentlyAddedIds.add(docRef.id);
  await db.items.add({ ...data, firestoreId: docRef.id });
  await get().loadItems(); // ← Reload from database
  setTimeout(() => recentlyAddedIds.delete(docRef.id), 5000);
}

// ❌ WRONG - Manual state update causes duplicates
async addItem(data) {
  const docRef = await addDoc(collection, data);
  recentlyAddedIds.add(docRef.id);
  const id = await db.items.add({ ...data, firestoreId: docRef.id });
  set(state => ({ items: [...state.items, { ...data, id }] })); // ← Causes duplicates!
  setTimeout(() => recentlyAddedIds.delete(docRef.id), 5000);
}
```

The sync listener will call `loadItems()` when it detects the new document, so manually updating the state creates a duplicate.

## Migration Strategy
The solution includes automatic migration:
1. When the database upgrades to version 614, existing projects with `customerId` will have their `customerFirestoreId` populated
2. All new projects will have both fields set
3. Sync operations will maintain both fields for backward compatibility
4. Queries prioritize `customerFirestoreId` but fall back to `customerId` if needed

## Testing Recommendations
1. Test creating a new project with a customer link
2. Refresh the page and verify the customer link persists
3. Test editing a project's customer link
4. Test with existing projects that have old `customerId` values
5. Test syncing across multiple devices/browsers
6. **Test creating a new predefined note and verify it only appears once in the UI**
7. **Test creating multiple predefined notes in quick succession**
8. **Test that refreshing doesn't create duplicates**
9. **Test that the duplicate tracking expires after 5 seconds**

# Predefined Notes Duplicate Fix - Version 2

## Problem
Users were experiencing duplicate predefined notes in the UI after adding a new note. The database only showed one instance, but the UI displayed duplicates. Logging out and back in would clear the duplication.

## Root Cause
The issue was a **race condition** between the local add operation and the Firestore sync listener:

1. User adds a note → `addPredefinedNote()` is called
2. Note is added to Firestore and gets a Firestore ID
3. **Firestore sync listener fires immediately** (before tracking can be set up)
4. Sync listener doesn't see the note in `recentlyAddedIds` yet
5. Sync listener adds the note to Dexie
6. Then `addPredefinedNote()` adds the Firestore ID to `recentlyAddedIds` (too late!)
7. `addPredefinedNote()` adds the note to Dexie again
8. Both operations call `loadPredefinedNotes()`, causing UI confusion

The original fix only tracked Firestore IDs in `recentlyAddedIds`, but this tracking happened **after** the Firestore document was created, leaving a window where the sync listener could fire and add the note before the tracking was in place.

## Solution

### 1. Dual Tracking Mechanism
Added two layers of duplicate prevention:

- **`recentlyAddedIds` Set**: Tracks Firestore document IDs (existing mechanism)
- **`notesBeingAdded` Map**: Tracks note content with timestamps (new mechanism)

```typescript
const recentlyAddedIds = new Set<string>();
const notesBeingAdded = new Map<string, number>(); // key: note content, value: timestamp
```

### 2. Pre-emptive Content Tracking
In `addPredefinedNote()`, we now track the note content **before** any async operations:

```typescript
// Track that we're adding this note BEFORE making any async calls
notesBeingAdded.set(noteText, Date.now());
```

This ensures that even if the Firestore sync listener fires immediately after the document is created, it will see that this note is currently being added locally.

### 3. Enhanced Sync Listener Checks
The sync listener now checks both tracking mechanisms:

```typescript
case 'added':
  // Check if this note is currently being added locally
  const noteContent = fsNote.note;
  const isBeingAdded = notesBeingAdded.has(noteContent);
  
  // Check by Firestore ID
  if (fsNote.firestoreId && recentlyAddedIds.has(fsNote.firestoreId)) {
    console.log(`Skipping recently added note by ID: ${fsNote.firestoreId}`);
    break;
  }
  
  // Check by content with time window
  if (isBeingAdded) {
    const addedTime = notesBeingAdded.get(noteContent)!;
    const timeSinceAdded = Date.now() - addedTime;
    if (timeSinceAdded < 10000) { // 10 second window
      console.log(`Skipping note being added locally: "${noteContent}"`);
      break;
    }
  }
  
  if (!existingNote) {
    await db.predefinedNotes.add(fsNote);
    hasChanges = true;
  }
  break;
```

### 4. Conditional UI Reload
The sync listener now only reloads the UI if actual changes were made to Dexie:

```typescript
// Only reload notes if actual changes were made to Dexie
if (hasChanges) {
  console.log('Reloading predefined notes after sync changes');
  await get().loadPredefinedNotes();
}
```

This prevents unnecessary UI updates when the sync listener skips duplicate notes.

### 5. Comprehensive Logging
Added detailed console logging throughout the process to help debug any future issues:

- When notes are tracked/untracked
- When notes are added to Firestore/Dexie
- When sync listener skips duplicates
- When UI reloads occur

## Key Changes

### `src/store/predefinedNotes.ts`

1. **Added `notesBeingAdded` Map** (line ~14):
   - Tracks notes by content during the add operation
   - Includes timestamp for time-based checks

2. **Updated `addPredefinedNote()`**:
   - Tracks note content BEFORE Firestore operation
   - Cleans up both tracking mechanisms after 10 seconds
   - Cleans up tracking on error

3. **Enhanced `startPredefinedNotesSync()`**:
   - Checks both `recentlyAddedIds` and `notesBeingAdded`
   - Only reloads UI when actual changes occur
   - Added comprehensive logging

## Testing Checklist

- [ ] Add a new predefined note - should appear once in UI
- [ ] Add multiple notes quickly - no duplicates should appear
- [ ] Refresh the page - notes should persist without duplication
- [ ] Add a note, wait 10 seconds, add the same note again - should allow duplicate (different instances)
- [ ] Check browser console for tracking logs
- [ ] Verify database has correct number of notes (no duplicates)
- [ ] Test with slow network connection
- [ ] Test with multiple browser tabs open

## Why This Works

The dual tracking mechanism provides defense in depth:

1. **Content tracking** (`notesBeingAdded`) prevents duplicates during the critical window between Firestore add and ID tracking
2. **ID tracking** (`recentlyAddedIds`) prevents duplicates after the Firestore ID is known
3. **Time-based checks** ensure we don't permanently block legitimate duplicate notes
4. **Conditional reloading** prevents unnecessary UI updates that could cause visual glitches

The key insight is that we need to track the note **before** it gets a Firestore ID, because the sync listener can fire at any time after the Firestore document is created.

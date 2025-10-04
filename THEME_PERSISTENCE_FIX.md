# Theme Persistence Fix

## Problem
The dark mode setting was not persisting after logout and login. When a user logged out and then logged back in, the theme would revert to light mode even if they had previously selected dark mode.

## Root Cause
The issue was in the logout flow in `App.tsx`:

1. When logging out, `handleLogout()` calls `clearDatabase()` (line 171)
2. `clearDatabase()` clears ALL tables including `db.settings.clear()` (dexie.ts line 219)
3. This wipes out the theme preference stored in the database
4. On next login, the theme loads from the database (App.tsx lines 69-77), but since settings were cleared, it defaults to 'light' mode

## Solution
Store the theme preference in **localStorage** in addition to the database. This ensures the theme persists across:
- Browser refreshes
- Logins/logouts
- Database clears

### Changes Made

#### 1. `src/store/ui.ts`
- **Initial state**: Load theme from localStorage on store initialization
  ```typescript
  theme: (localStorage.getItem('buztracker-theme') as 'light' | 'dark') || 'light',
  ```

- **setTheme function**: Save to both localStorage and database
  ```typescript
  setTheme: (theme: 'light' | 'dark') => {
    set({ theme });
    // Save to localStorage for persistence across logins/logouts
    localStorage.setItem('buztracker-theme', theme);
    // Also save to database for sync
    db.settings.toCollection().first().then(settings => {
      if (settings) {
        db.settings.update(settings.id!, { theme });
      }
    });
  }
  ```

#### 2. `src/App.tsx`
- **Theme loading**: Prioritize localStorage over database
  ```typescript
  useEffect(() => {
    const loadTheme = async () => {
      // Check localStorage first (persists across logins)
      const savedTheme = localStorage.getItem('buztracker-theme') as 'light' | 'dark' | null;
      if (savedTheme) {
        setTheme(savedTheme);
      } else {
        // Fallback to database
        const settings = await db.settings.toCollection().first();
        if (settings?.theme) {
          setTheme(settings.theme);
          // Save to localStorage for future
          localStorage.setItem('buztracker-theme', settings.theme);
        }
      }
    };
    loadTheme();
  }, [setTheme]);
  ```

## Benefits
1. **Persistence**: Theme survives logout/login cycles
2. **Performance**: Faster theme loading from localStorage
3. **Reliability**: Not affected by database clears
4. **Backward compatibility**: Still saves to database for potential future sync features

## Testing
1. ✅ Set theme to dark mode
2. ✅ Log out
3. ✅ Log back in
4. ✅ Refresh page
5. ✅ Theme should remain dark

## Alternative Approaches Considered
1. **Preserve theme during database clear**: Would require modifying `clearDatabase()` to save/restore theme
   - Rejected: More complex, doesn't handle browser refresh after logout
2. **User-specific theme in Firestore**: Would sync across devices
   - Future enhancement: Could be added later for cross-device sync

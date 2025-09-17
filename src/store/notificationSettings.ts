import { create } from 'zustand';
import { db } from '../db/dexie';
import { auth, db as firestoreDb } from '../firebase';
import { doc, setDoc } from 'firebase/firestore';

// Define the shape of the settings that this store will manage.
interface NotificationSettings {
  showLiveTimer: boolean;
  enableSmartReminders: boolean;
  reminderThresholdHours: number;
}

// Define the full state of the Zustand store, including data, loading/error states, and actions.
interface NotificationSettingsState {
  settings: NotificationSettings;
  isLoading: boolean;
  error: string | null;
  loadSettings: () => Promise<void>;
  updateSetting: <K extends keyof NotificationSettings>(key: K, value: NotificationSettings[K]) => Promise<void>;
  setEnableSmartReminders: (enabled: boolean) => Promise<void>;
}

// Default values for the settings.
const defaultSettings: NotificationSettings = {
  showLiveTimer: true,
  enableSmartReminders: false,
  reminderThresholdHours: 4,
};

export const useNotificationSettingsStore = create<NotificationSettingsState>((set) => ({
  settings: defaultSettings,
  isLoading: true,
  error: null,

  /**
   * Loads the settings from the Dexie database into the store.
   * There is only one settings document, with a hardcoded id of 1.
   */
  loadSettings: async () => {
    set({ isLoading: true, error: null });
    try {
      const storedSettings = await db.settings.get(1);
      if (storedSettings) {
        // Merge stored settings with defaults to ensure new fields exist for old users
        const mergedSettings = { ...defaultSettings, ...storedSettings };
        set({
          settings: {
            showLiveTimer: mergedSettings.showLiveTimer,
            enableSmartReminders: mergedSettings.enableSmartReminders,
            reminderThresholdHours: mergedSettings.reminderThresholdHours,
          },
          isLoading: false,
        });
      } else {
        // No settings found in DB, so just finish loading.
        // The component will use the initial default state.
        set({ isLoading: false });
      }
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
    }
  },

  /**
   * Updates a single setting value in both the Dexie database and the Zustand store.
   * @param key The name of the setting to update.
   * @param value The new value for the setting.
   */
  updateSetting: async (key, value) => {
    try {
      // 1. Update the local Dexie database first for offline reliability.
      await db.settings.update(1, { [key]: value });

      // 2. Update the local state for immediate UI feedback.
      const newSettings = { ...useNotificationSettingsStore.getState().settings, [key]: value };
      set({ settings: newSettings });

      // 3. Sync the complete settings object to Firestore.
      if (auth.currentUser && firestoreDb) {
        const settingsDocRef = doc(firestoreDb, 'users', auth.currentUser.uid, 'config', 'settings');
        // We set the whole settings object to ensure Firestore is a mirror of the local state.
        // Using merge: true prevents overwriting fields if the operation is partial.
        await setDoc(settingsDocRef, newSettings, { merge: true });
      }
    } catch (error) {
      console.error(`Failed to update setting: ${key}`, error);
      set({ error: (error as Error).message });
    }
  },

  /**
   * A specific action for the "Enable Smart Reminders" toggle.
   * This will be expanded later to trigger the notification permission request.
   * @param enabled The new state of the toggle.
   */
  setEnableSmartReminders: async (enabled: boolean) => {
    // For now, this just updates the setting. The permission request logic will be added
    // in the UI component layer when this action is called.
    await useNotificationSettingsStore.getState().updateSetting('enableSmartReminders', enabled);
  },
}));

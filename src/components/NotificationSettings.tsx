import React, { useEffect } from 'react';
import { useNotificationSettingsStore } from '../store/notificationSettings';
import { requestNotificationPermission } from '../notifications';

/**
 * A React component that provides UI controls for managing notification settings.
 */
const NotificationSettings: React.FC = () => {
  const {
    settings,
    isLoading,
    error,
    loadSettings,
    updateSetting,
    setEnableSmartReminders
  } = useNotificationSettingsStore();

  // Load settings from the database when the component mounts.
  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  /**
   * Handles changes to the "Enable Smart Reminders" toggle.
   * If the user is enabling the feature, it first requests notification permission.
   * If permission is denied, the toggle will not be enabled.
   */
  const handleEnableRemindersChange = async (enabled: boolean) => {
    if (enabled) {
      const token = await requestNotificationPermission();
      if (token) {
        // Only enable the setting if permission was granted and we have a token.
        await setEnableSmartReminders(true);
      } else {
        // If permission is denied or fails, ensure the setting remains disabled.
        // The store's state might need to be explicitly set back to false if the UI updates prematurely.
        await setEnableSmartReminders(false);
      }
    } else {
      // If the user is disabling the feature, just update the setting.
      await setEnableSmartReminders(false);
    }
  };

  if (isLoading) {
    return <div>Loading settings...</div>;
  }

  if (error) {
    return <div className="text-red-500">Error loading settings: {error}</div>;
  }

  return (
    <div className="space-y-6 p-4 border rounded-lg dark:border-gray-700">
      <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
        Notifications
      </h3>

      {/* Live Timer Toggle */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-gray-800 dark:text-gray-200">Show Live Timer in Media Controls</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Display the running timer on your lock screen.</p>
        </div>
        <label htmlFor="live-timer-toggle" className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            id="live-timer-toggle"
            className="sr-only peer"
            checked={settings.showLiveTimer}
            onChange={(e) => updateSetting('showLiveTimer', e.target.checked)}
          />
          <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-focus:ring-2 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
        </label>
      </div>

      {/* Smart Reminders Toggle */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-gray-800 dark:text-gray-200">Enable Smart Reminders</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Get a push notification for long-running timers.</p>
        </div>
        <label htmlFor="smart-reminders-toggle" className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            id="smart-reminders-toggle"
            className="sr-only peer"
            checked={settings.enableSmartReminders}
            onChange={(e) => handleEnableRemindersChange(e.target.checked)}
          />
          <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-focus:ring-2 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
        </label>
      </div>

      {/* Reminder Threshold Input - Conditionally rendered */}
      {settings.enableSmartReminders && (
        <div className="flex items-center justify-between pl-4 border-l-2 border-gray-200 dark:border-gray-700">
          <label htmlFor="reminder-threshold" className="text-gray-700 dark:text-gray-300">Remind me after (hours)</label>
          <input
            type="number"
            id="reminder-threshold"
            min="1"
            step="1"
            className="w-24 p-2 border border-gray-300 rounded-md dark:bg-gray-800 dark:border-gray-600 dark:text-white focus:ring-blue-500 focus:border-blue-500"
            value={settings.reminderThresholdHours}
            onChange={(e) => {
              const value = parseInt(e.target.value, 10);
              if (value > 0) {
                updateSetting('reminderThresholdHours', value);
              }
            }}
          />
        </div>
      )}
    </div>
  );
};

export default NotificationSettings;

 // src/pages/SettingsPage.tsx

import { lazy } from 'react';
import { ThemeSelector } from '../components/ThemeSelector';

const NotificationSettings = lazy(() => import('../components/NotificationSettings'));
const CsvImportExportCard = lazy(() => import('../components/CsvImportExportCard').then(module => ({ default: module.CsvImportExportCard })));

export function SettingsPage() {
  return (
    <div className="space-y-8">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Settings</h2>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6" style={{ minHeight: '10vh' }}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Appearance</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">Choose your preferred theme</p>
          </div>
          <ThemeSelector />
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <CsvImportExportCard />
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Keyboard Shortcuts</h3>
          <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
            <div><kbd className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">Ctrl+N</kbd> Add Entry</div>
            <div><kbd className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">Space</kbd> Start/Stop Timer (when stopwatch is focused)</div>
            <div><kbd className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">Enter</kbd> Submit forms</div>
            <div><kbd className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">Escape</kbd> Close modals</div>
          </div>
        </div>
      </div>
      <NotificationSettings />
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">About BuzTracker</h3>
        <div className="text-gray-600 dark:text-gray-400 space-y-2">
          <p>BuzTracker is a local-first time tracking application that works offline.</p>
          <p>All your data is stored locally in your browser and never sent to any server.</p>
          <p>You can export your data at any time and import it on another device.</p>
          <div className="mt-4 text-xs text-gray-500 dark:text-gray-500">Version 2.0 • Built with React, TypeScript, and IndexedDB</div>
        </div>
      </div>
    </div>
  );
}

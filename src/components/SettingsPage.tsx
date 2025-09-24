// src/components/SettingsPage.tsx
import { UserProfile } from './UserProfile';
import { CsvImportExportCard } from './CsvImportExportCard';
import NotificationSettings from './NotificationSettings';

export function SettingsPage() {
  return (
    <div className="space-y-6">
        <UserProfile />
        <CsvImportExportCard />
        <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4">Keyboard Shortcuts</h2>
            <div className="grid grid-cols-2 gap-4 text-sm text-gray-700">
                <p><kbd className="font-mono bg-gray-200 rounded-md px-2 py-1">Ctrl</kbd> + <kbd className="font-mono bg-gray-200 rounded-md px-2 py-1">1</kbd></p><p>Time Tracker</p>
                <p><kbd className="font-mono bg-gray-200 rounded-md px-2 py-1">Ctrl</kbd> + <kbd className="font-mono bg-gray-200 rounded-md px-2 py-1">2</kbd></p><p>History</p>
                <p><kbd className="font-mono bg-gray-200 rounded-md px-2 py-1">Ctrl</kbd> + <kbd className="font-mono bg-gray-200 rounded-md px-2 py-1">3</kbd></p><p>Settings</p>
                <p><kbd className="font-mono bg-gray-200 rounded-md px-2 py-1">Spacebar</kbd></p><p>Start/Stop Timer</p>
                <p><kbd className="font-mono bg-gray-200 rounded-md px-2 py-1">Ctrl</kbd> + <kbd className="font-mono bg-gray-200 rounded-md px-2 py-1">N</kbd></p><p>Add Manual Entry</p>
            </div>
        </div>
        <NotificationSettings />
    </div>
  );
}

export default SettingsPage;

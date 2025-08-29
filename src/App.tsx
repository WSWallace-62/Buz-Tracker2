// wswallace-62/buz-tracker2/Buz-Tracker2-Github-errors/src/App.tsx
import { useEffect, useState, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import { useProjectsStore } from './store/projects';
import { useSessionsStore } from './store/sessions';
import { useUIStore } from './store/ui';
import { useAuthStore } from './store/auth';
import { db } from './db/dexie';
import { auth } from './firebase';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { ProjectSelect } from './components/ProjectSelect';
import { Stopwatch } from './components/Stopwatch';
import { SessionsTable } from './components/SessionsTable';
import { Toast } from './components/Toast';
import { InstallButton } from './pwa/InstallButton';
import { getTotalDuration, formatDurationHHMM } from './utils/time';
import './styles.css';

// Lazy load all non-critical/route-specific components
const HistoryPanel = lazy(() => import('./components/HistoryPanel').then(module => ({ default: module.HistoryPanel })));
const UserProfile = lazy(() => import('./components/UserProfile').then(module => ({ default: module.UserProfile })));
const Auth = lazy(() => import('./components/Auth').then(module => ({ default: module.Auth })));
const AddEntryModal = lazy(() => import('./components/AddEntryModal').then(module => ({ default: module.AddEntryModal })));
const ProjectManagerModal = lazy(() => import('./components/ProjectManagerModal').then(module => ({ default: module.ProjectManagerModal })));
const ConfirmDialog = lazy(() => import('./components/ConfirmDialog').then(module => ({ default: module.ConfirmDialog })));


type Tab = 'tracker' | 'history' | 'settings';

export function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}

function AppContent() {
  const isOnline = useOnlineStatus();
  const { reconcileProjects } = useProjectsStore();
  const { loadSessions, loadRunningSession, getTodaySessions, startSync, stopSync } = useSessionsStore();
  const { currentProjectId, setCurrentProject, openAddEntryModal } = useUIStore();
  const { user, setUser } = useAuthStore();
  const [isLoading, setIsLoading] = useState(true);
  const [isGuest, setIsGuest] = useState(false);
  const location = useLocation();

  const activeTab: Tab = location.pathname === '/history' ? 'history' : location.pathname === '/settings' ? 'settings' : 'tracker';

  useEffect(() => {
    const initializeApp = async (currentUser: User | null) => {
      setUser(currentUser);
      setIsLoading(true);

      if (currentUser) {
        setIsGuest(false);
        await reconcileProjects();
        startSync();
      } else if (isGuest) {
        await loadSessions();
      }
      
      if (currentUser || isGuest) {
        await loadRunningSession();
        const settings = await db.settings.toCollection().first();
        if (settings?.lastProjectId) {
          setCurrentProject(settings.lastProjectId);
        }
      }

      setIsLoading(false);
    };

    if (auth) {
      const unsubscribe = onAuthStateChanged(auth, initializeApp);
      return () => {
        unsubscribe();
        stopSync();
      };
    } else {
      // Handle case where auth is not available (e.g., guest mode from start)
      initializeApp(null);
    }
    
    return () => {
      stopSync();
    };
  }, [isGuest, setUser, reconcileProjects, loadSessions, loadRunningSession, startSync, stopSync, setCurrentProject]);

  const handleLogin = () => {
    setIsGuest(true);
  };

  const handleLogout = async () => {
    if (auth) {
      await signOut(auth);
    }
    setUser(null);
    setIsGuest(false);
  };

  const loadingSpinner = (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="spinner w-8 h-8 mx-auto mb-4"></div>
        <p className="text-gray-600">Loading BuzTracker...</p>
      </div>
    </div>
  );

  if (isLoading) {
    return loadingSpinner;
  }

  if (!user && !isGuest) {
    return (
      <Suspense fallback={loadingSpinner}>
        <Auth onLogin={handleLogin} />
      </Suspense>
    );
  }

  const todaySessions = getTodaySessions(currentProjectId || undefined);
  const todayTotal = getTotalDuration(todaySessions);

  return (
    <div className="min-h-screen bg-gray-50">
      <a href="#main-content" className="skip-link">Skip to main content</a>
      
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-gray-900">BuzTracker</h1>
              {!isOnline && (
                <div className="ml-2" title="You are currently offline.">
                  <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 010 12.728m-12.728 0a9 9 0 010-12.728m12.728 0L5.636 18.364M5.636 5.636l12.728 12.728" />
                  </svg>
                </div>
              )}
              {activeTab === 'tracker' && (
                <div className="ml-4 text-sm text-gray-600">
                  Today: {formatDurationHHMM(todayTotal)}
                </div>
              )}
            </div>
            
            <div className="flex items-center space-x-4">
              <InstallButton />
              {(user || isGuest) && (
                <button
                  onClick={handleLogout}
                  className="px-3 py-1.5 text-sm font-medium text-gray-800 bg-gray-300 rounded-md hover:bg-gray-400"
                >
                  Logout
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      <nav className="bg-white border-b border-gray-200" role="navigation" aria-label="Main navigation">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            {[
              { id: 'tracker', label: 'Time Tracker', path: '/' },
              { id: 'history', label: 'History', path: '/history' },
              { id: 'settings', label: 'Settings', path: '/settings' }
            ].map((tab) => (
              <Link
                key={tab.id}
                to={tab.path}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === tab.id ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
              >
                {tab.label}
              </Link>
            ))}
          </div>
        </div>
      </nav>

      <main id="main-content" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Suspense fallback={
          <div className="flex justify-center items-center p-8">
            <div className="spinner w-8 h-8"></div>
          </div>
        }>
          <Routes>
            <Route path="/" element={
              <div className="space-y-8">
                <div className="max-w-md">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Current Project
                  </label>
                  <ProjectSelect />
                </div>
                <Stopwatch projectId={currentProjectId} />
                <div className="flex flex-wrap gap-4">
                  <button onClick={openAddEntryModal} className="btn-primary flex items-center" title="Add manual time entry (Ctrl+N)">
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                    Add Entry
                  </button>
                </div>
                <SessionsTable projectId={currentProjectId || undefined} />
              </div>
            } />
            <Route path="/history" element={<HistoryPanel />} />
            <Route path="/settings" element={
              <div className="space-y-8">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <UserProfile />
                  <div className="bg-white rounded-lg shadow-md p-6">
                    <h3 className="text-lg font-semibold mb-4">Keyboard Shortcuts</h3>
                    <div className="space-y-2 text-sm text-gray-600">
                      <div><kbd className="bg-gray-100 px-2 py-1 rounded">Ctrl+N</kbd> Add Entry</div>
                      <div><kbd className="bg-gray-100 px-2 py-1 rounded">Space</kbd> Start/Stop Timer (when stopwatch is focused)</div>
                      <div><kbd className="bg-gray-100 px-2 py-1 rounded">Enter</kbd> Submit forms</div>
                      <div><kbd className="bg-gray-100 px-2 py-1 rounded">Escape</kbd> Close modals</div>
                    </div>
                  </div>
                </div>
                <div className="bg-white rounded-lg shadow-md p-6">
                  <h3 className="text-lg font-semibold mb-4">About BuzTracker</h3>
                  <div className="text-gray-600 space-y-2">
                    <p>BuzTracker is a local-first time tracking application that works offline.</p>
                    <p>All your data is stored locally in your browser and never sent to any server.</p>
                    <p>You can export your data at any time and import it on another device.</p>
                    <div className="mt-4 text-xs text-gray-500">Version 1.0.0 • Built with React, TypeScript, and IndexedDB</div>
                  </div>
                </div>
              </div>
            } />
          </Routes>
        </Suspense>
      </main>

      <Suspense fallback={null}>
        <AddEntryModal />
        <ProjectManagerModal />
        <ConfirmDialog />
      </Suspense>
      <Toast />
    </div>
  );
}
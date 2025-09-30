// src/App.tsx
import { useEffect, useState, lazy, Suspense, useCallback, useRef } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import { useProjectsStore } from './store/projects';
import { useSessionsStore } from './store/sessions';
import { useUIStore } from './store/ui';
import { useAuthStore } from './store/auth';
import { db, clearDatabase } from './db/dexie';
import { auth } from './firebase';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { ProjectSelect } from './components/ProjectSelect';
import { Stopwatch } from './components/Stopwatch';
import { SessionsTable } from './components/SessionsTable';
import { Toast } from './components/Toast';
import { InstallButton } from './pwa/InstallButton';
import { getTotalDuration, formatDurationHHMM, formatDuration } from './utils/time';
import { audioManager } from './utils/audioManager';
import './styles.css';

// Lazy load all non-critical/route-specific components
const HistoryPanel = lazy(() => import('./components/HistoryPanel').then(module => ({ default: module.HistoryPanel })));
const SettingsPage = lazy(() => import('./pages/SettingsPage').then(module => ({ default: module.SettingsPage })));
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
  const { reconcileProjects, startProjectSync, stopProjectSync } = useProjectsStore();
  const { getTodaySessions, startSync, stopSync } = useSessionsStore();
  const { currentProjectId, setCurrentProject, openAddEntryModal } = useUIStore();
  const { user, setUserAndOrg, isLoading: isAuthLoading } = useAuthStore();
  const [isGuest, setIsGuest] = useState(false);
  const location = useLocation();

  const activeTab: Tab = location.pathname === '/history' ? 'history' : location.pathname === '/settings' ? 'settings' : 'tracker';

  const { runningSession, getCurrentElapsed, loadSessions, loadRunningSession } = useSessionsStore();

  const initializeApp = useCallback(async (currentUser: User | null) => {
    await setUserAndOrg(currentUser);

    if (currentUser) {
      setIsGuest(false);
      await reconcileProjects();
      startProjectSync();
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
  }, [isGuest, setUserAndOrg, reconcileProjects, loadSessions, loadRunningSession, startSync, setCurrentProject, startProjectSync]);

  useEffect(() => {
    // onAuthStateChanged returns an unsubscribe function that we can use for cleanup.
    const unsubscribe = onAuthStateChanged(auth, initializeApp);
    
    return () => {
      unsubscribe();
      stopProjectSync();
      stopSync();
    };
  }, [initializeApp, stopProjectSync, stopSync]);

  useEffect(() => {
    const defaultTitle = "BuzTracker - Time Tracker";
    if (runningSession?.running && !runningSession.isPaused) {
      const updateTitle = () => {
        document.title = `BuzTracker | ${formatDuration(getCurrentElapsed())}`;
      };

      const titleInterval = setInterval(updateTitle, 1000);
      updateTitle();

      return () => {
        clearInterval(titleInterval);
        document.title = defaultTitle;
      };
    } else {
      document.title = defaultTitle;
    }
  }, [runningSession, getCurrentElapsed]);
  
  const audioRef = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    if (audioRef.current) {
      audioManager.element = audioRef.current;
    }
  }, []);

  useEffect(() => {
    const unlockAudio = () => {
      audioManager.unlock();
      window.removeEventListener('click', unlockAudio);
      window.removeEventListener('touchstart', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
    };

    window.addEventListener('click', unlockAudio);
    window.addEventListener('touchstart', unlockAudio);
    window.addEventListener('keydown', unlockAudio);

    return () => {
      window.removeEventListener('click', unlockAudio);
      window.removeEventListener('touchstart', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
    };
  }, []);

  const handleLogin = () => {
    setIsGuest(true);
  };

  const handleLogout = async () => {
    stopProjectSync();
    stopSync();
    if (auth) {
      await signOut(auth);
    }
    await clearDatabase();
    useProjectsStore.setState({ projects: [], isLoading: false, error: null });
    useSessionsStore.setState({ sessions: [], runningSession: null, isLoading: true, error: null });
    useUIStore.setState({ currentProjectId: null });
    setIsGuest(false);
    await db.on.ready.fire(db);
  };

  const loadingSpinner = (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="spinner w-8 h-8 mx-auto mb-4"></div>
        <p className="text-gray-600">Loading BuzTracker...</p>
      </div>
    </div>
  );

  if (isAuthLoading) {
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
      
      <header className="sticky top-0 z-50 bg-white shadow-sm border-b border-gray-200">
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

      <nav className="sticky top-16 z-40 bg-white border-b border-gray-200" role="navigation" aria-label="Main navigation">
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
                    Add Session
                  </button>
                </div>
                <SessionsTable projectId={currentProjectId || undefined} />
              </div>
            } />
            <Route path="/history" element={<HistoryPanel />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </Suspense>
      </main>

      <audio ref={audioRef} src="/silent.mp3" loop hidden />

      <Suspense fallback={null}>
        <AddEntryModal />
        <ProjectManagerModal />
        <ConfirmDialog />
      </Suspense>
      <Toast />
    </div>
  );
}

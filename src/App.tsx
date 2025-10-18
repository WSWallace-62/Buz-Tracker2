// src/App.tsx
import { useEffect, useState, lazy, Suspense, useCallback, useRef } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import { useProjectsStore } from './store/projects';
import { useSessionsStore } from './store/sessions';
import { useUIStore } from './store/ui';
import { useAuthStore } from './store/auth';
import { usePredefinedNotesStore } from './store/predefinedNotes';
import { useCustomersStore } from './store/customers';
import { useOrganizationStore } from './store/organization';
import { useTravelEntriesStore } from './store/travelEntries';
import { db, clearDatabase } from './db/dexie';
import { auth } from './firebase';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { ProjectSelect } from './components/ProjectSelect';
import { Stopwatch } from './components/Stopwatch';
import { Toast } from './components/Toast';
import { InstallButton } from './pwa/InstallButton';
import { UserMenu } from './components/UserMenu';
import { formatDuration } from './utils/time';
import { audioManager } from './utils/audioManager';
import './styles.css';

 // Lazy load all non-critical/route-specific components
const HistoryPanel = lazy(() => import('./components/HistoryPanel').then(module => ({ default: module.HistoryPanel })));
const SettingsPage = lazy(() => import('./pages/SettingsPage').then(module => ({ default: module.SettingsPage })));
const ProfilePage = lazy(() => import('./pages/ProfilePage').then(module => ({ default: module.ProfilePage })));
const CustomersPage = lazy(() => import('./pages/CustomersPage'));
const CorporatePage = lazy(() => import('./pages/CorporatePage').then(module => ({ default: module.CorporatePage })));
const FAQPage = lazy(() => import('./pages/FAQPage').then(module => ({ default: module.FAQPage })));
const Auth = lazy(() => import('./components/Auth').then(module => ({ default: module.Auth })));
const AddEntryModal = lazy(() => import('./components/AddEntryModal').then(module => ({ default: module.AddEntryModal })));
const AddTravelDistanceModal = lazy(() => import('./components/AddTravelDistanceModal').then(module => ({ default: module.AddTravelDistanceModal })));
const ProjectManagerModal = lazy(() => import('./components/ProjectManagerModal').then(module => ({ default: module.ProjectManagerModal })));
const ConfirmDialog = lazy(() => import('./components/ConfirmDialog').then(module => ({ default: module.ConfirmDialog })));
const TodaysActivity = lazy(() => import('./components/TodaysActivity'));

type Tab = 'tracker' | 'history' | 'settings' | 'profile' | 'customers' | 'corporate' | 'faq';

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
  const { startSync, stopSync, reconcileSessions } = useSessionsStore();
  const { startPredefinedNotesSync, stopPredefinedNotesSync } = usePredefinedNotesStore();
  const { startCustomerSync, stopCustomerSync, loadCustomers } = useCustomersStore();
  const { startOrganizationSync, stopOrganizationSync, loadOrganization } = useOrganizationStore();
  const { startSync: startTravelEntriesSync, stopSync: stopTravelEntriesSync } = useTravelEntriesStore();
  const { currentProjectId, setCurrentProject, openAddEntryModal, openTravelDistanceModal, theme, setTheme } = useUIStore();
  const { user, setUserAndOrg, isLoading: isAuthLoading } = useAuthStore();
  const [isGuest, setIsGuest] = useState(false);
  const location = useLocation();

  const activeTab: Tab = location.pathname === '/history' ? 'history' : location.pathname === '/settings' ? 'settings' : location.pathname === '/profile' ? 'profile' : location.pathname === '/customers' ? 'customers' : location.pathname === '/corporate' ? 'corporate' : location.pathname === '/faq' ? 'faq' : 'tracker';

  const { runningSession, getCurrentElapsed, loadSessions, loadRunningSession } = useSessionsStore();

  // Apply theme to document root
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  // Load theme from localStorage first, then database
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
  const initializeApp = useCallback(async (currentUser: User | null) => {
    await setUserAndOrg(currentUser);

    if (currentUser) {
      setIsGuest(false);
      await reconcileProjects();
      await reconcileSessions();
      startProjectSync();
      startSync();
      startPredefinedNotesSync();
      startCustomerSync();
      startTravelEntriesSync();
      await startOrganizationSync();
    } else if (isGuest) {
      await loadSessions();
      await loadCustomers();
      await loadOrganization();
    }

    await loadRunningSession();
    const lastProject = await db.settings.toCollection().first();
    if (lastProject?.lastProjectId) {
      setCurrentProject(lastProject.lastProjectId);
    }
  }, [isGuest, setUserAndOrg, reconcileProjects, reconcileSessions, loadSessions, loadRunningSession, startSync, setCurrentProject, startProjectSync, startPredefinedNotesSync, startCustomerSync, startTravelEntriesSync, startOrganizationSync, loadCustomers, loadOrganization]);

  useEffect(() => {
    // onAuthStateChanged returns an unsubscribe function that we can use for cleanup.
    const unsubscribe = onAuthStateChanged(auth, initializeApp);

    return () => {
      unsubscribe();
      stopProjectSync();
      stopSync();
      stopPredefinedNotesSync();
      stopTravelEntriesSync();
    };
  }, [initializeApp, stopProjectSync, stopSync, stopPredefinedNotesSync, stopTravelEntriesSync]);

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
    stopPredefinedNotesSync();
    stopCustomerSync();
    stopOrganizationSync();
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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
      <div className="text-center">
        <div className="spinner w-8 h-8 mx-auto mb-4"></div>
        <p className="text-gray-600 dark:text-gray-400">Loading BuzTracker...</p>
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

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <a href="#main-content" className="skip-link">Skip to main content</a>

      <header className="sticky top-0 z-50 bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <img
                src="/company-logo.png.jpg"
                alt="Company Logo"
                className="h-10 mr-3"
                style={{ width: 'auto', aspectRatio: '856/1040' }}
              />
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">BuzTracker</h1>
              {!isOnline && (
                <div className="ml-2" title="You are currently offline.">
                  <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 010 12.728m-12.728 0a9 9 0 010-12.728m12.728 0L5.636 18.364M5.636 5.636l12.728 12.728" />
                  </svg>
                </div>
              )}
            </div>

            <div className="flex items-center space-x-4">
              <InstallButton />
              {(user || isGuest) && (
                <UserMenu onLogout={handleLogout} isGuest={isGuest} />
              )}
            </div>
          </div>
        </div>
      </header>

      <nav className="sticky top-16 z-40 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700" role="navigation" aria-label="Main navigation">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            <div className="flex space-x-8">
              {[
                { id: 'tracker', label: 'Time Tracker', path: '/' },
                { id: 'history', label: 'History', path: '/history' }
              ].map((tab) => {
                return (
                  <Link
                    key={tab.id}
                    to={tab.path}
                    className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === tab.id ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'}`}
                  >
                    {tab.label}
                  </Link>
                );
              })}
            </div>
            <div className="flex items-center py-4" aria-label="Application version">
              <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Rev</span>
              <span className="ml-1 text-sm font-semibold text-gray-500 dark:text-gray-300">3.3</span>
            </div>
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
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
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
                  <button onClick={openTravelDistanceModal} className="btn-secondary flex items-center" title="Add travel distance entry">
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg>
                    Add Travel Distance
                  </button>
                </div>
                <TodaysActivity />
              </div>
            } />
            <Route path="/customers" element={<CustomersPage />} />
            <Route path="/corporate" element={<CorporatePage />} />
            <Route path="/history" element={<HistoryPanel />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/faq" element={<FAQPage />} />
          </Routes>
        </Suspense>
      </main>

      <audio ref={audioRef} src="/silent.mp3" loop hidden />

      <Suspense fallback={null}>
        <AddEntryModal />
        <AddTravelDistanceModal />
        <ProjectManagerModal />
        <ConfirmDialog />
      </Suspense>
      <Toast />
    </div>
  );
}

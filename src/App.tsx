import { useEffect, useState } from 'react'
import { useProjectsStore } from './store/projects'
import { useSessionsStore } from './store/sessions'
import { useUIStore } from './store/ui'
import { db } from './db/dexie'
import { ProjectSelect } from './components/ProjectSelect'
import { Stopwatch } from './components/Stopwatch'
import { SessionsTable } from './components/SessionsTable'
import { AddEntryModal } from './components/AddEntryModal'
import { ProjectManagerModal } from './components/ProjectManagerModal'
import { HistoryPanel } from './components/HistoryPanel'
import { ConfirmDialog } from './components/ConfirmDialog'
import { Toast } from './components/Toast'
import { ImportExport } from './components/ImportExport'
import { InstallButton } from './pwa/InstallButton'
import { getTotalDuration, formatDurationHHMM } from './utils/time'
import './styles.css'

type Tab = 'tracker' | 'history' | 'settings'

export function App() {
  const { loadProjects } = useProjectsStore()
  const { loadSessions, loadRunningSession, getTodaySessions } = useSessionsStore()
  const { currentProjectId, setCurrentProject, openAddEntryModal } = useUIStore()
  const [activeTab, setActiveTab] = useState<Tab>('tracker')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Load initial data
        await Promise.all([
          loadProjects(),
          loadSessions(),
          loadRunningSession()
        ])

        // Load settings and set current project
        const settings = await db.settings.toCollection().first()
        if (settings?.lastProjectId) {
          setCurrentProject(settings.lastProjectId)
        }
      } catch (error) {
        console.error('Failed to initialize app:', error)
      } finally {
        setIsLoading(false)
      }
    }

    initializeApp()
  }, [loadProjects, loadSessions, loadRunningSession, setCurrentProject])

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Global shortcuts (when no input is focused)
      if (!['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) {
        if (e.key === 'n' && e.ctrlKey) {
          e.preventDefault()
          openAddEntryModal()
        } else if (e.key === '1' && e.ctrlKey) {
          e.preventDefault()
          setActiveTab('tracker')
        } else if (e.key === '2' && e.ctrlKey) {
          e.preventDefault()
          setActiveTab('history')
        } else if (e.key === '3' && e.ctrlKey) {
          e.preventDefault()
          setActiveTab('settings')
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [openAddEntryModal])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="spinner w-8 h-8 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading BuzTracker...</p>
        </div>
      </div>
    )
  }

  const todaySessions = getTodaySessions(currentProjectId || undefined)
  const todayTotal = getTotalDuration(todaySessions)

  return (
    <div className="min-h-screen bg-gray-50">
      <a href="#main-content" className="skip-link">Skip to main content</a>
      
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-gray-900">BuzTracker</h1>
              <div className="ml-4 text-sm text-gray-600">
                Today: {formatDurationHHMM(todayTotal)}
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <InstallButton />
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-white border-b border-gray-200" role="navigation" aria-label="Main navigation">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            {[
              { id: 'tracker' as const, label: 'Time Tracker', shortcut: '1' },
              { id: 'history' as const, label: 'History', shortcut: '2' },
              { id: 'settings' as const, label: 'Settings', shortcut: '3' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  py-4 px-1 border-b-2 font-medium text-sm transition-colors
                  ${activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }
                `}
                aria-pressed={activeTab === tab.id}
                title={`${tab.label} (Ctrl+${tab.shortcut})`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main id="main-content" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'tracker' && (
          <div className="space-y-8">
            {/* Project Selection */}
            <div className="max-w-md">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Current Project
              </label>
              <ProjectSelect />
            </div>

            {/* Stopwatch */}
            <Stopwatch projectId={currentProjectId} />

            {/* Quick Actions */}
            <div className="flex flex-wrap gap-4">
              <button
                onClick={openAddEntryModal}
                className="btn-primary flex items-center"
                title="Add manual time entry (Ctrl+N)"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Entry
              </button>
            </div>

            {/* Today's Sessions */}
            <SessionsTable projectId={currentProjectId || undefined} />
          </div>
        )}

        {activeTab === 'history' && <HistoryPanel />}

        {activeTab === 'settings' && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <ImportExport />
              
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-lg font-semibold mb-4">Keyboard Shortcuts</h3>
                <div className="space-y-2 text-sm text-gray-600">
                  <div><kbd className="bg-gray-100 px-2 py-1 rounded">Ctrl+1</kbd> Time Tracker</div>
                  <div><kbd className="bg-gray-100 px-2 py-1 rounded">Ctrl+2</kbd> History</div>
                  <div><kbd className="bg-gray-100 px-2 py-1 rounded">Ctrl+3</kbd> Settings</div>
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
                <div className="mt-4 text-xs text-gray-500">
                  Version 1.0.0 • Built with React, TypeScript, and IndexedDB
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Modals and Overlays */}
      <AddEntryModal />
      <ProjectManagerModal />
      <ConfirmDialog />
      <Toast />
    </div>
  )
}
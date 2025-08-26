import Dexie, { Table } from 'dexie'

export interface Project {
  id?: number
  name: string
  color: string
  createdAt: number
  archived: boolean
  firestoreId?: string;
}

export interface Session {
  id?: number
  projectId: number
  start: number
  stop: number | null
  durationMs: number
  note?: string
  createdAt: number
  firestoreId?: string;
}

export interface Settings {
  id?: number
  lastProjectId?: number
  theme: 'light' | 'dark'
  stopwatchPrecisionMs: number
}

// --- Updated RunningSession Interface ---
export interface RunningSession {
  id?: number
  running: boolean
  projectId: number
  startTs: number
  note?: string
  // New fields for pause functionality
  isPaused: boolean
  pauseStartTime: number | null
  totalPausedTime: number
}

export class BuzTrackerDB extends Dexie {
  projects!: Table<Project>
  sessions!: Table<Session>
  settings!: Table<Settings>
  runningSession!: Table<RunningSession>

  constructor() {
    super('BuzTrackerDB')
    
    // --- Bumped DB version from 4 to 5 ---
    this.version(5).stores({
      projects: '++id, firestoreId, name, createdAt, archived',
      sessions: '++id, projectId, firestoreId, start, stop, createdAt, *note',
      settings: '++id',
      // Added new fields to the runningSession table schema
      runningSession: '++id, isPaused' 
    })

    this.on('ready', async () => {
      // Initialize default settings
      const settingsCount = await this.settings.count()
      if (settingsCount === 0) {
        await this.settings.add({
          theme: 'light',
          stopwatchPrecisionMs: 100
        })
      }

      // Initialize default project
      const projectsCount = await this.projects.count()
      if (projectsCount === 0) {
        await this.projects.add({
          name: 'Default Project',
          color: '#3b82f6',
          createdAt: Date.now(),
          archived: false
        })
      }
    })
  }
}

export const db = new BuzTrackerDB()

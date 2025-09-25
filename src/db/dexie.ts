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
  // New fields for notification settings
  showLiveTimer: boolean
  enableSmartReminders: boolean
  reminderThresholdHours: number
}

export interface RunningSession {
  id?: number
  running: boolean
  projectId: number
  startTs: number
  note?: string
  isPaused: boolean
  pauseStartTime: number | null
  totalPausedTime: number
  baseDuration: number
  // This ID links the running timer back to the original session entry
  continuedFromSessionId: number | null 
}

export class BuzTrackerDB extends Dexie {
  projects!: Table<Project>
  sessions!: Table<Session>
  settings!: Table<Settings>
  runningSession!: Table<RunningSession>

  constructor() {
    super('BuzTrackerDB')
    
    // --- Bumped DB version from 5 to 6 ---
    this.version(6).stores({
      projects: '++id, firestoreId, name, createdAt, archived',
      sessions: '++id, projectId, firestoreId, start, stop, createdAt, *note',
      settings: '++id',
      runningSession: '++id, running, projectId, startTs, isPaused, continuedFromSessionId' 
    })

    this.on('ready', async () => {
      // Initialize default settings
      const settingsCount = await this.settings.count()
      if (settingsCount === 0) {
        await this.settings.add({
          theme: 'light',
          stopwatchPrecisionMs: 100,
          showLiveTimer: true,
          enableSmartReminders: false,
          reminderThresholdHours: 4
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

// --- Add this new function at the end of the file ---
export async function clearDatabase() {
  await db.transaction('rw', db.projects, db.sessions, db.settings, db.runningSession, async () => {
    await Promise.all([
      db.projects.clear(),
      db.sessions.clear(),
      db.settings.clear(),
      db.runningSession.clear(),
    ]);
  });
  console.log('Local database cleared.');
}
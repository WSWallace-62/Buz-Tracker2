import Dexie, { Table } from 'dexie'

export interface Contact {
  name: string
  email: string
}

export interface Customer {
  id?: number
  companyName: string
  address: string
  city: string
  province: string
  postalCode: string
  country: string
  contacts: Contact[]
  standardRate: number
  travelRate: number
  currency: string
  createdAt: number
  archived: boolean
  firestoreId?: string
}

export interface Project {
  id?: number
  name: string
  color: string
  createdAt: number
  archived: boolean
  customerId?: number  // Deprecated: kept for backward compatibility
  customerFirestoreId?: string  // New: stores the Firestore ID of the customer
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

export interface PredefinedNote {
  id?: number
  note: string
  createdAt: number
  firestoreId?: string
}

export class BuzTrackerDB extends Dexie {
  projects!: Table<Project>
  sessions!: Table<Session>
  settings!: Table<Settings>
  runningSession!: Table<RunningSession>
  predefinedNotes!: Table<PredefinedNote>
  customers!: Table<Customer>

  constructor() {
    super('BuzTrackerDB')

    // Bump DB version to 614 to add customerFirestoreId to projects
    this.version(614).stores({
      projects: '++id, firestoreId, name, createdAt, archived, customerId, customerFirestoreId',
      sessions: '++id, projectId, firestoreId, start, stop, createdAt, *note',
      settings: '++id',
      runningSession: '++id, running, projectId, startTs, isPaused, continuedFromSessionId',
      predefinedNotes: '++id, firestoreId, note, createdAt',
      customers: '++id, firestoreId, companyName, createdAt, archived'
    }).upgrade(async (trans) => {
      // Migration: For existing projects with customerId, populate customerFirestoreId
      const projects = await trans.table('projects').toArray();
      const customers = await trans.table('customers').toArray();

      for (const project of projects) {
        if (project.customerId && !project.customerFirestoreId) {
          const customer = customers.find(c => c.id === project.customerId);
          if (customer?.firestoreId) {
            await trans.table('projects').update(project.id, {
              customerFirestoreId: customer.firestoreId
            });
          }
        }
      }
    });

    // Keep version 613 for backward compatibility
    this.version(613).stores({
      projects: '++id, firestoreId, name, createdAt, archived, customerId',
      sessions: '++id, projectId, firestoreId, start, stop, createdAt, *note',
      settings: '++id',
      runningSession: '++id, running, projectId, startTs, isPaused, continuedFromSessionId',
      predefinedNotes: '++id, firestoreId, note, createdAt',
      customers: '++id, firestoreId, companyName, createdAt, archived'
    })

    this.on('ready', () => this.initializeDatabase());
  }

  async initializeDatabase() {
    await this.transaction('rw', this.projects, this.settings, this.predefinedNotes, this.customers, async () => {
      // Initialize default settings
      const settingsCount = await this.settings.count();
      if (settingsCount === 0) {
        await this.settings.add({
          theme: 'light',
          stopwatchPrecisionMs: 100,
          showLiveTimer: true,
          enableSmartReminders: false,
          reminderThresholdHours: 4
        });
      }

      // Initialize default customer (KJ Controls)
      const customersCount = await this.customers.count();
      if (customersCount === 0) {
        await this.customers.add({
          companyName: 'KJ Controls',
          address: '1983 Main Road',
          city: 'Nanaimo',
          province: 'BC',
          postalCode: 'V9X-1T6',
          country: 'Canada',
          contacts: [
            { name: 'James Boileau', email: '' },
            { name: 'Burke Bridges', email: '' }
          ],
          standardRate: 90,
          travelRate: 55,
          currency: 'CAD',
          createdAt: Date.now(),
          archived: false
        });
      }

      // Initialize default project
      const projectsCount = await this.projects.count();
      if (projectsCount === 0) {
        // Get the KJ Controls customer ID
        const kjControls = await this.customers.where('companyName').equals('KJ Controls').first();

        await this.projects.add({
          name: 'Default Project',
          color: '#3b82f6',
          createdAt: Date.now(),
          archived: false,
          customerId: kjControls?.id,
          customerFirestoreId: kjControls?.firestoreId
        });
      } else {
        // Migration: Link "Parksville Water System" to KJ Controls if it exists
        const parksvilleProject = await this.projects.where('name').equals('Parksville Water System').first();
        const kjControls = await this.customers.where('companyName').equals('KJ Controls').first();

        if (parksvilleProject && kjControls && !parksvilleProject.customerId) {
          await this.projects.update(parksvilleProject.id!, {
            customerId: kjControls.id,
            customerFirestoreId: kjControls.firestoreId
          });
          console.log('Linked Parksville Water System to KJ Controls');
        }
      }

      // Initialize default predefined notes
      const predefinedNotesCount = await this.predefinedNotes.count();
      if (predefinedNotesCount === 0) {
        const defaultNotes = [
          'Programming and configuration',
          'Meeting',
          'Travel',
          'Admin'
        ];
        for (const note of defaultNotes) {
          await this.predefinedNotes.add({
            note,
            createdAt: Date.now()
          });
        }
      }
    });
    console.log("Database initialized with default data.");
  }
}

export const db = new BuzTrackerDB()

export async function clearDatabase() {
  await Promise.all([
    db.projects.clear(),
    db.sessions.clear(),
    db.settings.clear(),
    db.runningSession.clear(),
    db.predefinedNotes.clear(),
    db.customers.clear()
  ]);
}

// FIX: Export a standalone function to be called from App.tsx
export async function initializeDatabase() {
  await db.initializeDatabase();
}

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
  travelRate?: number;
  travelDistanceUnit?: 'km' | 'miles';
  distanceRate?: number;
  perDiemRate?: number
  currency?: string
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

export interface TravelEntry {
  id?: number
  projectId: number | string
  customerId: number | string
  customerFirestoreId?: string
  date: number
  distance: number
  unit: 'km' | 'miles'
  note?: string
  createdAt: number
  firestoreId?: string
  userId?: string
  organizationId?: string
}

// New: Organization and CorporateInfo types
export interface CorporateInfo {
  companyName: string
  streetAddress: string
  city: string
  province: string
  postalCode: string
  areaCode: string
  phone: string
  email: string
  gstNumber: string
  logoUrl?: string
}

export interface Organization {
  id?: number
  firestoreId?: string
  corporateInfo: CorporateInfo
  createdBy: string  // userId
  createdAt: number
  updatedAt: number
}

export interface User {
  id?: number
  userId: string  // Firebase Auth UID
  organizationId?: string  // Firestore organization ID
  role?: 'owner' | 'admin' | 'user'
  updatedAt: number
}

export class BuzTrackerDB extends Dexie {
  projects!: Table<Project>
  sessions!: Table<Session>
  settings!: Table<Settings>
  runningSession!: Table<RunningSession>
  predefinedNotes!: Table<PredefinedNote>
  customers!: Table<Customer>
  organizations!: Table<Organization>
  users!: Table<User>
  travelEntries!: Table<TravelEntry>

  constructor() {
    super('BuzTrackerDB')

    // Bump DB version to 616 to add travelEntries table
    this.version(616).stores({
      projects: '++id, firestoreId, name, createdAt, archived, customerId, customerFirestoreId',
      sessions: '++id, projectId, firestoreId, start, stop, createdAt, *note',
      settings: '++id',
      runningSession: '++id, running, projectId, startTs, isPaused, continuedFromSessionId',
      predefinedNotes: '++id, firestoreId, note, createdAt',
      customers: '++id, firestoreId, companyName, createdAt, archived',
      organizations: '++id, firestoreId, createdBy, createdAt, updatedAt',
      users: '++id, userId, organizationId, role, updatedAt',
      travelEntries: '++id, firestoreId, projectId, customerId, customerFirestoreId, date, createdAt'
    })

    // Bump DB version to 615 to add organizations and users tables
    this.version(615).stores({
      projects: '++id, firestoreId, name, createdAt, archived, customerId, customerFirestoreId',
      sessions: '++id, projectId, firestoreId, start, stop, createdAt, *note',
      settings: '++id',
      runningSession: '++id, running, projectId, startTs, isPaused, continuedFromSessionId',
      predefinedNotes: '++id, firestoreId, note, createdAt',
      customers: '++id, firestoreId, companyName, createdAt, archived',
      organizations: '++id, firestoreId, createdBy, createdAt, updatedAt',
      users: '++id, userId, organizationId, role, updatedAt'
    })

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
    await this.transaction('rw', this.settings, async () => {
      // Initialize default settings if they don't exist
      const settingsCount = await this.settings.count();
      if (settingsCount === 0) {
        await this.settings.add({
          theme: 'light',
          stopwatchPrecisionMs: 100,
          showLiveTimer: true,
          enableSmartReminders: false,
          reminderThresholdHours: 4
        });
        console.log("Default settings initialized.");
      }
    });
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
    db.customers.clear(),
    db.organizations.clear(),
    db.users.clear(),
    db.travelEntries.clear()
  ]);
}

// FIX: Export a standalone function to be called from App.tsx
export async function initializeDatabase() {
  await db.initializeDatabase();
}

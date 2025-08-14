import 'fake-indexeddb/auto'
import { vi } from 'vitest'

vi.mock('src/firebase.ts', () => ({
  auth: {},
  db: {},
  storage: {},
}));
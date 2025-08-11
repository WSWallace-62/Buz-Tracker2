import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { BuzTrackerDB } from '../db/dexie'

describe('Dexie Database', () => {
  let db: BuzTrackerDB

  beforeEach(async () => {
    db = new BuzTrackerDB()
    await db.open()
  })

  afterEach(async () => {
    await db.delete()
  })

  describe('Projects', () => {
    it('creates and retrieves projects', async () => {
      const projectId = await db.projects.add({
        name: 'Test Project',
        color: '#ff0000',
        createdAt: Date.now(),
        archived: false
      }) as number

      const project = await db.projects.get(projectId)
      expect(project).toBeDefined()
      expect(project?.name).toBe('Test Project')
      expect(project?.archived).toBe(false)
    })

    it('updates project properties', async () => {
      const projectId = await db.projects.add({
        name: 'Test Project',
        color: '#ff0000',
        createdAt: Date.now(),
        archived: false
      }) as number

      await db.projects.update(projectId, { name: 'Updated Project' })
      
      const project = await db.projects.get(projectId)
      expect(project?.name).toBe('Updated Project')
    })
  })

  describe('Sessions', () => {
    it('creates and retrieves sessions', async () => {
      const projectId = await db.projects.add({
        name: 'Test Project',
        color: '#ff0000',
        createdAt: Date.now(),
        archived: false
      }) as number

      const start = Date.now()
      const stop = start + 3600000 // 1 hour
      const sessionId = await db.sessions.add({
        projectId,
        start,
        stop,
        durationMs: stop - start,
        createdAt: Date.now()
      }) as number

      const session = await db.sessions.get(sessionId)
      expect(session).toBeDefined()
      expect(session?.projectId).toBe(projectId)
      expect(session?.durationMs).toBe(3600000)
    })

    it('queries sessions by project', async () => {
      const projectId = await db.projects.add({
        name: 'Test Project',
        color: '#ff0000',
        createdAt: Date.now(),
        archived: false
      }) as number

      const start = Date.now()
      await db.sessions.add({
        projectId,
        start,
        stop: start + 1000,
        durationMs: 1000,
        createdAt: Date.now()
      })

      await db.sessions.add({
        projectId,
        start: start + 2000,
        stop: start + 3000,
        durationMs: 1000,
        createdAt: Date.now()
      })

      const sessions = await db.sessions
        .where('projectId')
        .equals(projectId)
        .toArray()

      expect(sessions).toHaveLength(2)
    })
  })

  describe('Settings', () => {
    it('initializes default settings', async () => {
      const settings = await db.settings.toCollection().first()
      expect(settings).toBeDefined()
      expect(settings?.theme).toBe('light')
      expect(settings?.stopwatchPrecisionMs).toBe(100)
    })
  })

  describe('Running Session', () => {
    it('stores and retrieves running session', async () => {
      const projectId = await db.projects.add({
        name: 'Test Project',
        color: '#ff0000',
        createdAt: Date.now(),
        archived: false
      }) as number

      await db.runningSession.add({
        running: true,
        projectId,
        startTs: Date.now()
      })

      const runningSession = await db.runningSession.toCollection().first()
      expect(runningSession).toBeDefined()
      expect(runningSession?.running).toBe(true)
      expect(runningSession?.projectId).toBe(projectId)
    })
  })
})
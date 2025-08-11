import { describe, it, expect } from 'vitest'
import { formatDuration, formatDurationHours, formatDurationHHMM, parseTimeInput, createTimeRange } from '../utils/time'

describe('Time utilities', () => {
  describe('formatDuration', () => {
    it('formats seconds only', () => {
      expect(formatDuration(30000)).toBe('0:30')
    })

    it('formats minutes and seconds', () => {
      expect(formatDuration(125000)).toBe('2:05')
    })

    it('formats hours, minutes, and seconds', () => {
      expect(formatDuration(3725000)).toBe('1:02:05')
    })

    it('handles zero duration', () => {
      expect(formatDuration(0)).toBe('0:00')
    })
  })

  describe('formatDurationHours', () => {
    it('formats duration as decimal hours', () => {
      expect(formatDurationHours(3600000)).toBe('1.00')
      expect(formatDurationHours(1800000)).toBe('0.50')
      expect(formatDurationHours(5400000)).toBe('1.50')
    })
  })

  describe('formatDurationHHMM', () => {
    it('formats duration as HH:MM', () => {
      expect(formatDurationHHMM(3600000)).toBe('1:00')
      expect(formatDurationHHMM(5400000)).toBe('1:30')
      expect(formatDurationHHMM(60000)).toBe('0:01')
    })
  })

  describe('parseTimeInput', () => {
    const baseDate = new Date('2023-01-01T00:00:00').getTime()

    it('parses HH:MM format', () => {
      const result = parseTimeInput('14:30', baseDate)
      const expected = new Date('2023-01-01T14:30:00').getTime()
      expect(result).toBe(expected)
    })

    it('parses H:MM format', () => {
      const result = parseTimeInput('9:15', baseDate)
      const expected = new Date('2023-01-01T09:15:00').getTime()
      expect(result).toBe(expected)
    })

    it('throws error for invalid format', () => {
      expect(() => parseTimeInput('invalid', baseDate)).toThrow('Invalid time format')
    })
  })

  describe('createTimeRange', () => {
    it('creates valid time range', () => {
      const result = createTimeRange('2023-01-01', '09:00', '17:00')
      expect(result.duration).toBe(8 * 60 * 60 * 1000) // 8 hours
      expect(result.end).toBeGreaterThan(result.start)
    })

    it('throws error when end time is before start time', () => {
      expect(() => createTimeRange('2023-01-01', '17:00', '09:00'))
        .toThrow('End time must be after start time')
    })
  })
})
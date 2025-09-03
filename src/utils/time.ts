import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'
import isoWeek from 'dayjs/plugin/isoWeek'
import customParseFormat from 'dayjs/plugin/customParseFormat'

dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.extend(isoWeek)
dayjs.extend(customParseFormat)

// --- Add this new function ---
export function parseDurationToMs(durationStr: string): number {
  const parts = durationStr.split(':').map(Number)
  if (parts.some(isNaN)) {
    return 0
  }

  let hours = 0, minutes = 0, seconds = 0

  if (parts.length === 2) {
    [hours, minutes] = parts
  } else if (parts.length === 3) {
    [hours, minutes, seconds] = parts
  } else if (parts.length === 1) {
    [minutes] = parts
  } else {
    return 0
  }

  return (hours * 3600 + minutes * 60 + seconds) * 1000
}

export function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

export function formatDurationHours(ms: number): string {
  const hours = ms / (1000 * 60 * 60)
  return hours.toFixed(2)
}

export function formatDurationHHMM(ms: number): string {
  if (ms < 0) return '0:00'
  const totalMinutes = Math.floor(ms / (1000 * 60))
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return `${hours}:${minutes.toString().padStart(2, '0')}`
}

export function formatTime(timestamp: number): string {
  // Use a 12-hour clock with AM/PM
  return dayjs(timestamp).format('h:mm A')
}

export function formatDate(timestamp: number): string {
  return dayjs(timestamp).format('YYYY-MM-DD')
}

export function formatDateTime(timestamp: number): string {
  return dayjs(timestamp).format('YYYY-MM-DD HH:mm')
}

export function startOfDay(timestamp: number): number {
  return dayjs(timestamp).startOf('day').valueOf()
}

export function endOfDay(timestamp: number): number {
  return dayjs(timestamp).endOf('day').valueOf()
}

export function isToday(timestamp: number): boolean {
  return dayjs(timestamp).isSame(dayjs(), 'day')
}

export function isSameDay(timestamp1: number, timestamp2: number): boolean {
  return dayjs(timestamp1).isSame(dayjs(timestamp2), 'day')
}

export function getDateRanges() {
  const now = dayjs()
  
  return {
    today: {
      start: now.startOf('day').valueOf(),
      end: now.endOf('day').valueOf()
    },
    thisWeek: {
      start: now.startOf('isoWeek').valueOf(),
      end: now.endOf('isoWeek').valueOf()
    },
    lastWeek: {
      start: now.subtract(1, 'week').startOf('isoWeek').valueOf(),
      end: now.subtract(1, 'week').endOf('isoWeek').valueOf()
    },
    thisMonth: {
      start: now.startOf('month').valueOf(),
      end: now.endOf('month').valueOf()
    },
    lastMonth: {
      start: now.subtract(1, 'month').startOf('month').valueOf(),
      end: now.subtract(1, 'month').endOf('month').valueOf()
    },
    thisYear: {
      start: now.startOf('year').valueOf(),
      end: now.endOf('year').valueOf()
    },
    lastYear: {
      start: now.subtract(1, 'year').startOf('year').valueOf(),
      end: now.subtract(1, 'year').endOf('year').valueOf()
    }
  }
}

export function parseTimeInput(timeStr: string, baseDate: number = Date.now()): number {
  const formats = ['HH:mm', 'H:mm', 'HH:mm:ss', 'H:mm:ss']
  const base = dayjs(baseDate)
  
  for (const format of formats) {
    const parsed = dayjs(timeStr, format, true)
    if (parsed.isValid()) {
      return base
        .hour(parsed.hour())
        .minute(parsed.minute())
        .second(parsed.second() || 0)
        .millisecond(0)
        .valueOf()
    }
  }
  
  throw new Error('Invalid time format')
}

export function roundToMinute(timestamp: number): number {
  return dayjs(timestamp).startOf('minute').valueOf()
}

export function getTotalDuration(sessions: Array<{ durationMs: number }>): number {
  return sessions.reduce((total, session) => total + session.durationMs, 0)
}

export function createTimeRange(date: string, startTime: string, endTime: string) {
  if (!startTime || !endTime) {
    throw new Error("Start and end times are required");
  }
  
  const baseDate = dayjs(date).valueOf()
  const start = parseTimeInput(startTime, baseDate)
  const end = parseTimeInput(endTime, baseDate)
  
  if (end <= start) {
    throw new Error('End time must be after start time')
  }
  
  return { start, end, duration: end - start }
}
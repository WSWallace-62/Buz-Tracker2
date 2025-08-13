import { useState, useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/dexie'
import { useSessionsStore } from '../store/sessions'
import { useProjectsStore } from '../store/projects'
import { useUIStore } from '../store/ui'
import { getDateRanges, formatDurationHours, formatDate } from '../utils/time'
import { SessionsTable } from './SessionsTable'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js'
import { Bar } from 'react-chartjs-2'
import Papa from 'papaparse'

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
)

type DateFilter = 'today' | 'thisWeek' | 'lastWeek' | 'thisMonth' | 'lastMonth' | 'custom'
type GroupBy = 'day' | 'project'

export function HistoryPanel() {
  const { getTotalDuration } = useSessionsStore()
  const { projects } = useProjectsStore()
  const { showToast } = useUIStore()
  
  const [dateFilter, setDateFilter] = useState<DateFilter>('today')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [selectedProjectIds, setSelectedProjectIds] = useState<number[]>([])
  const [groupBy, setGroupBy] = useState<GroupBy>('day')
  const [showChart, setShowChart] = useState(true)
  const [sortOrder, setSortOrder] = useState<'date-desc' | 'date-asc' | 'start-desc' | 'start-asc'>('date-desc')
  const [noteFilter, setNoteFilter] = useState('')

  const dateRanges = useMemo(() => getDateRanges(), [])

  const { startDate, endDate } = useMemo(() => {
    if (dateFilter === 'custom') {
      return {
        startDate: customStart ? new Date(customStart).getTime() : dateRanges.today.start,
        endDate: customEnd ? new Date(customEnd).setHours(23, 59, 59, 999) : dateRanges.today.end
      }
    }
    
    const range = dateRanges[dateFilter]
    return { startDate: range.start, endDate: range.end }
  }, [dateFilter, customStart, customEnd, dateRanges])

  const sessions = useLiveQuery(() => {
    const query = db.sessions
      .where('start')
      .between(startDate, endDate)

    return query.toArray()
  }, [startDate, endDate])

  const filteredSessions = useMemo(() => {
    if (!sessions) return []

    let filtered = sessions;

    if (selectedProjectIds.length > 0) {
      filtered = filtered.filter(s => selectedProjectIds.includes(s.projectId))
    }

    if (noteFilter) {
      filtered = filtered.filter(s => s.note?.toLowerCase().includes(noteFilter.toLowerCase()))
    }

    const [sortKey, sortDir] = sortOrder.split('-')

    filtered.sort((a, b) => {
      let valA, valB;
      if (sortKey === 'date') {
        valA = new Date(formatDate(a.start)).getTime()
        valB = new Date(formatDate(b.start)).getTime()
      } else { // start time
        valA = a.start
        valB = b.start
      }

      return sortDir === 'asc' ? valA - valB : valB - valA
    })

    return filtered
  }, [sessions, selectedProjectIds, noteFilter, sortOrder])

  const summaryData = useMemo(() => {
    const totalMs = getTotalDuration(filteredSessions)
    return {
      totalHours: parseFloat(formatDurationHours(totalMs)),
      sessionsCount: filteredSessions.length
    }
  }, [filteredSessions, getTotalDuration])

  const chartData = useMemo(() => {
    if (groupBy === 'project') {
      const projectTotals = new Map<number, number>()
      
      filteredSessions.forEach(session => {
        const current = projectTotals.get(session.projectId) || 0
        projectTotals.set(session.projectId, current + session.durationMs)
      })

      const labels = Array.from(projectTotals.keys()).map(id => {
        const project = projects.find(p => p.id === id)
        return project?.name || 'Unknown'
      })

      const data = Array.from(projectTotals.values()).map(ms => 
        parseFloat(formatDurationHours(ms))
      )

      const colors = Array.from(projectTotals.keys()).map(id => {
        const project = projects.find(p => p.id === id)
        return project?.color || '#6b7280'
      })

      return {
        labels,
        datasets: [{
          label: 'Hours by Project',
          data,
          backgroundColor: colors,
          borderColor: colors,
          borderWidth: 1
        }]
      }
    } else {
      // Group by day
      const dayTotals = new Map<string, number>()
      
      filteredSessions.forEach(session => {
        const day = formatDate(session.start)
        const current = dayTotals.get(day) || 0
        dayTotals.set(day, current + session.durationMs)
      })

      // Fill in missing days in range
      const currentDate = new Date(startDate)
      const endDateObj = new Date(endDate)
      
      while (currentDate <= endDateObj) {
        const day = formatDate(currentDate.getTime())
        if (!dayTotals.has(day)) {
          dayTotals.set(day, 0)
        }
        currentDate.setDate(currentDate.getDate() + 1)
      }

      const sortedEntries = Array.from(dayTotals.entries()).sort((a, b) => 
        new Date(a[0]).getTime() - new Date(b[0]).getTime()
      )

      const labels = sortedEntries.map(([date]) => date)
      const data = sortedEntries.map(([, ms]) => parseFloat(formatDurationHours(ms)))

      return {
        labels,
        datasets: [{
          label: 'Hours per Day',
          data,
          backgroundColor: '#3b82f6',
          borderColor: '#3b82f6',
          borderWidth: 1
        }]
      }
    }
  }, [filteredSessions, groupBy, projects, startDate, endDate])

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: groupBy === 'project' ? 'Hours by Project' : 'Hours per Day'
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: 'Hours'
        }
      }
    }
  }

  const handleProjectToggle = (projectId: number) => {
    setSelectedProjectIds(prev => 
      prev.includes(projectId)
        ? prev.filter(id => id !== projectId)
        : [...prev, projectId]
    )
  }

  const handleSelectAllProjects = () => {
    setSelectedProjectIds([])
  }

  const exportCSV = () => {
    if (filteredSessions.length === 0) {
      showToast('No sessions to export', 'info')
      return
    }

    const headers = ['Date', 'Start', 'Stop', 'Duration (hours)', 'Project', 'Note']
    const rows = filteredSessions.map(session => {
      const project = projects.find(p => p.id === session.projectId)
      return [
        formatDate(session.start),
        new Date(session.start).toLocaleTimeString(),
        session.stop ? new Date(session.stop).toLocaleTimeString() : '',
        formatDurationHours(session.durationMs),
        project?.name || 'Unknown',
        session.note || ''
      ]
    })

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `buztracker-sessions-${formatDate(Date.now())}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    showToast('Sessions exported to CSV', 'success')
  }

  const importCSV = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) {
      showToast('No file selected', 'error')
      return
    }

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const requiredHeaders = ['Date', 'Start', 'Stop', 'Project']
        const headers = results.meta.fields || []
        const missingHeaders = requiredHeaders.filter(h => !headers.includes(h))

        if (missingHeaders.length > 0) {
          showToast(`Missing required columns: ${missingHeaders.join(', ')}`, 'error')
          return
        }

        const importedSessions: any[] = results.data.map((row: any) => {
          const date = row['Date']
          const startStr = row['Start']
          const stopStr = row['Stop']

          if (!date || !startStr || !stopStr) return null

          const start = new Date(`${date} ${startStr}`).getTime()
          const stop = new Date(`${date} ${stopStr}`).getTime()
          const durationMs = stop - start

          if (isNaN(start) || isNaN(stop) || durationMs < 0) return null

          return {
            // Find project by name, or create a new one
            projectName: row['Project'],
            start,
            stop,
            durationMs,
            note: row['Note'] || '',
          }
        }).filter(Boolean)

        if (importedSessions.length === 0) {
          showToast('No valid sessions found in CSV', 'info')
          return
        }

        try {
          await db.transaction('rw', db.projects, db.sessions, async () => {
            for (const session of importedSessions) {
              const project = projects.find(p => p.name === session.projectName)
              let projectId
              if (!project) {
                // Create new project with a random color
                const newProject = {
                  name: session.projectName,
                  color: `#${Math.floor(Math.random()*16777215).toString(16)}`,
                  archived: false,
                  createdAt: Date.now()
                }
                projectId = await db.projects.add(newProject)
              } else {
                projectId = project.id
              }

              await db.sessions.add({
                projectId: projectId as number,
                start: session.start,
                stop: session.stop,
                durationMs: session.durationMs,
                note: session.note,
                createdAt: Date.now()
              })
            }
          })
          showToast(`Successfully imported ${importedSessions.length} sessions.`, 'success')
        } catch(error) {
          console.error("Failed to import sessions", error)
          showToast('Failed to import sessions', 'error')
        }
      },
      error: (error) => {
        showToast(`CSV parsing error: ${error.message}`, 'error')
      }
    })
  }

  const getDynamicTitle = () => {
    switch (dateFilter) {
      case 'today': return "Today's Sessions"
      case 'thisWeek': return "This Week's Sessions"
      case 'lastWeek': return "Last Week's Sessions"
      case 'thisMonth': return "This Month's Sessions"
      case 'lastMonth': return "Last Month's Sessions"
      default: return 'Sessions'
    }
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold mb-4">History & Analytics</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Date Range
            </label>
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value as DateFilter)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="today">Today</option>
              <option value="thisWeek">This Week</option>
              <option value="lastWeek">Last Week</option>
              <option value="thisMonth">This Month</option>
              <option value="lastMonth">Last Month</option>
              <option value="custom">Custom Range</option>
            </select>
          </div>

          {dateFilter === 'custom' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Start Date
                </label>
                <input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  End Date
                </label>
                <input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Group By
            </label>
            <select
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value as GroupBy)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="day">Day</option>
              <option value="project">Project</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Sort By
            </label>
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as any)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="date-desc">Date (Newest First)</option>
              <option value="date-asc">Date (Oldest First)</option>
              <option value="start-desc">Start Time (Newest First)</option>
              <option value="start-asc">Start Time (Oldest First)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Filter by Note
            </label>
            <input
              type="text"
              value={noteFilter}
              onChange={(e) => setNoteFilter(e.target.value)}
              placeholder="Enter note text..."
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Projects
          </label>
          <div className="flex flex-wrap gap-2 mb-2">
            <button
              onClick={handleSelectAllProjects}
              className={`px-3 py-1 rounded-full text-sm transition-colors ${
                selectedProjectIds.length === 0
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              All Projects
            </button>
            {projects.filter(p => !p.archived).map(project => (
              <button
                key={project.id}
                onClick={() => handleProjectToggle(project.id!)}
                className={`px-3 py-1 rounded-full text-sm transition-colors flex items-center ${
                  selectedProjectIds.includes(project.id!)
                    ? 'text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
                style={{
                  backgroundColor: selectedProjectIds.includes(project.id!) 
                    ? project.color 
                    : undefined
                }}
              >
                <div
                  className="w-2 h-2 rounded-full mr-2"
                  style={{ backgroundColor: project.color }}
                />
                {project.name}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => setShowChart(!showChart)}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm"
          >
            {showChart ? 'Hide Chart' : 'Show Chart'}
          </button>
          
          <button
            onClick={exportCSV}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-sm"
          >
            Export CSV
          </button>

          <label className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors text-sm cursor-pointer">
            Import CSV
            <input
              type="file"
              className="hidden"
              accept=".csv"
              onChange={importCSV}
            />
          </label>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold mb-2">Total Hours</h3>
          <p className="text-3xl font-bold text-blue-600">
            {summaryData.totalHours.toFixed(1)}
          </p>
        </div>
        
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold mb-2">Sessions Count</h3>
          <p className="text-3xl font-bold text-green-600">
            {summaryData.sessionsCount}
          </p>
        </div>
      </div>

      {/* Sessions Table */}
      <SessionsTable sessions={filteredSessions} showAllProjects={true} title={getDynamicTitle()} />

      {/* Chart */}
      {showChart && chartData.datasets[0].data.some(val => val > 0) && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <div style={{ height: '400px' }}>
            <Bar data={chartData} options={chartOptions} />
          </div>
        </div>
      )}
    </div>
  )
}
import React, { useState, useEffect } from 'react'
import { useSessionsStore } from '../store/sessions'
import { useProjectsStore } from '../store/projects'
import { useUIStore } from '../store/ui'
// --- Import the new parseDurationToMs function ---
import { formatTime, formatDurationHHMM, isToday, formatDate, parseDurationToMs } from '../utils/time'
import { Session } from '../db/dexie'

interface SessionsTableProps {
  projectId?: number
  showAllProjects?: boolean
  sessions?: Session[]
  title?: string
}

export function SessionsTable({ projectId, showAllProjects = false, sessions: externalSessions, title }: SessionsTableProps) {
  const { sessions, getTodaySessions, deleteSession, loadSessions } = useSessionsStore()
  const { projects } = useProjectsStore()
  const { showConfirm, showToast } = useUIStore()
  const [editingSession, setEditingSession] = useState<Session | null>(null)

  useEffect(() => {
    if (!externalSessions) {
      loadSessions()
    }
  }, [loadSessions, externalSessions])

  const displaySessions = externalSessions || (
    showAllProjects 
      ? sessions.filter(s => isToday(s.start))
      : getTodaySessions(projectId)
  )

  const handleEdit = (session: Session) => {
    setEditingSession(session)
  }

  const handleDelete = (session: Session) => {
    showConfirm(
      'Delete Session',
      `Are you sure you want to delete this ${formatDurationHHMM(session.durationMs)} session?`,
      async () => {
        await deleteSession(session.id!)
        
        showToast(
          'Session deleted',
          'success',
          {
            label: 'Undo',
            onClick: async () => {
              await useSessionsStore.getState().createSession({
                projectId: session.projectId,
                start: session.start,
                stop: session.stop,
                durationMs: session.durationMs,
                note: session.note
              })
              showToast('Session restored', 'success')
            }
          }
        )
      }
    )
  }

  const getProjectName = (projectId: number) => {
    const project = projects.find(p => p.id === projectId)
    return project?.name || 'Unknown Project'
  }

  const getProjectColor = (projectId: number) => {
    const project = projects.find(p => p.id === projectId)
    return project?.color || '#6b7280'
  }

  if (displaySessions.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold mb-4">
          {title || (showAllProjects ? "Today's Sessions" : "Sessions Today")}
        </h3>
        <div className="text-center py-8 text-gray-500">
          <svg
            className="w-12 h-12 mx-auto mb-4 text-gray-300"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p>No sessions recorded yet</p>
          <p className="text-sm">Start the timer to track your time</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-semibold">
          {title || (showAllProjects ? "Today's Sessions" : "Sessions Today")}
        </h3>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              {showAllProjects && (
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
              )}
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Start
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                End
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Duration
              </th>
              {showAllProjects && (
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Project
                </th>
              )}
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Note
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {displaySessions.map((session) => (
              <tr key={session.id} className="hover:bg-gray-50">
                {showAllProjects && (
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatDate(session.start)}
                  </td>
                )}
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {formatTime(session.start)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {session.stop ? formatTime(session.stop) : '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {formatDurationHHMM(session.durationMs)}
                </td>
                {showAllProjects && (
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <div className="flex items-center">
                      <div
                        className="w-3 h-3 rounded-full mr-2 flex-shrink-0"
                        style={{ backgroundColor: getProjectColor(session.projectId) }}
                      />
                      {getProjectName(session.projectId)}
                    </div>
                  </td>
                )}
                <td className="px-6 py-4 text-sm text-gray-900 max-w-xs">
                  <div className="truncate" title={session.note}>
                    {session.note || '-'}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleEdit(session)}
                      className="text-blue-600 hover:text-blue-800 transition-colors"
                      aria-label="Edit session"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDelete(session)}
                      className="text-red-600 hover:text-red-800 transition-colors"
                      aria-label="Delete session"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editingSession && (
        <EditSessionModal
          session={editingSession}
          onClose={() => setEditingSession(null)}
        />
      )}
    </div>
  )
}

interface EditSessionModalProps {
  session: Session
  onClose: () => void
}

function EditSessionModal({ session, onClose }: EditSessionModalProps) {
  const { updateSession } = useSessionsStore()
  const { projects } = useProjectsStore()
  const { showToast } = useUIStore()

  const [projectId, setProjectId] = useState(session.projectId)
  const [duration, setDuration] = useState(formatDurationHHMM(session.durationMs))
  const [note, setNote] = useState(session.note || '')

  const handleDurationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDuration(e.target.value)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      const durationMs = parseDurationToMs(duration)
      if (durationMs < 0) {
        showToast('Duration must be a positive value', 'error')
        return
      }

      const newStop = session.start + durationMs

      await updateSession(session.id!, {
        projectId,
        start: session.start,
        stop: newStop,
        durationMs,
        note: note || undefined
      })

      showToast('Session updated', 'success')
      onClose()
    } catch (error) {
      showToast((error as Error).message, 'error')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose()
    } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      handleSubmit(e as any)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md" onKeyDown={handleKeyDown}>
        <h3 className="text-lg font-semibold mb-4">Edit Session</h3>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Project
            </label>
            <select
              value={projectId}
              onChange={(e) => setProjectId(Number(e.target.value))}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              {projects.filter(p => !p.archived).map(project => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Duration (HH:MM or minutes)
            </label>
            <input
              type="text"
              value={duration}
              onChange={handleDurationChange}
              placeholder="e.g., 1:30 or 90"
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Note
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
              placeholder="Optional note..."
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
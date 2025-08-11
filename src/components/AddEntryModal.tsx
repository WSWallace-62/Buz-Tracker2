import React, { useState, useEffect } from 'react'
import { useSessionsStore } from '../store/sessions'
import { useProjectsStore } from '../store/projects'
import { useUIStore } from '../store/ui'
import { createTimeRange, formatDate } from '../utils/time'

export function AddEntryModal() {
  const { createSession } = useSessionsStore()
  const { projects } = useProjectsStore()
  const { isAddEntryModalOpen, closeAddEntryModal, currentProjectId, showToast } = useUIStore()
  
  const [formData, setFormData] = useState({
    projectId: 0,
    date: formatDate(Date.now()),
    startTime: '',
    endTime: '',
    note: ''
  })

  useEffect(() => {
    if (isAddEntryModalOpen) {
      // Set default values when modal opens
      setFormData({
        projectId: currentProjectId || (projects.find(p => !p.archived)?.id || 0),
        date: formatDate(Date.now()),
        startTime: '',
        endTime: '',
        note: ''
      })
    }
  }, [isAddEntryModalOpen, currentProjectId, projects])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.projectId) {
      showToast('Please select a project', 'error')
      return
    }

    if (!formData.startTime || !formData.endTime) {
      showToast('Please enter both start and end times', 'error')
      return
    }

    try {
      const { start, end, duration } = createTimeRange(
        formData.date,
        formData.startTime,
        formData.endTime
      )

      await createSession({
        projectId: formData.projectId,
        start,
        stop: end,
        durationMs: duration,
        note: formData.note.trim() || undefined
      })

      showToast('Session added successfully', 'success')
      closeAddEntryModal()
    } catch (error) {
      showToast((error as Error).message, 'error')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      closeAddEntryModal()
    } else if (e.key === 'Enter' && e.ctrlKey) {
      handleSubmit(e as any)
    }
  }

  if (!isAddEntryModalOpen) {
    return null
  }

  const activeProjects = projects.filter(p => !p.archived)

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div 
        className="bg-white rounded-lg p-6 w-full max-w-md"
        onKeyDown={handleKeyDown}
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-entry-title"
      >
        <div className="flex justify-between items-center mb-6">
          <h2 id="add-entry-title" className="text-xl font-semibold">
            Add Time Entry
          </h2>
          <button
            onClick={closeAddEntryModal}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Project *
            </label>
            <select
              value={formData.projectId}
              onChange={(e) => setFormData({ ...formData, projectId: Number(e.target.value) })}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value={0}>Select a project...</option>
              {activeProjects.map(project => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Date *
            </label>
            <input
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Start Time *
              </label>
              <input
                type="time"
                value={formData.startTime}
                onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                End Time *
              </label>
              <input
                type="time"
                value={formData.endTime}
                onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Note
            </label>
            <textarea
              value={formData.note}
              onChange={(e) => setFormData({ ...formData, note: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
              placeholder="Optional note about this session..."
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={closeAddEntryModal}
              className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Add Entry
            </button>
          </div>
        </form>

        <p className="mt-4 text-xs text-gray-500">
          Press Ctrl+Enter to quickly submit the form
        </p>
      </div>
    </div>
  )
}
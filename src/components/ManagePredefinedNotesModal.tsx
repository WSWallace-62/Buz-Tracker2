import React, { useState, useEffect } from 'react'
import { usePredefinedNotesStore } from '../store/predefinedNotes'
import { useUIStore } from '../store/ui'
import { PredefinedNote } from '../db/dexie'

interface ManagePredefinedNotesModalProps {
  isOpen: boolean
  onClose: () => void
}

export function ManagePredefinedNotesModal({ isOpen, onClose }: ManagePredefinedNotesModalProps) {
  const { predefinedNotes, addPredefinedNote, updatePredefinedNote, deletePredefinedNote } = usePredefinedNotesStore()
  const { showConfirm, showToast } = useUIStore()
  const [editingNote, setEditingNote] = useState<PredefinedNote | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [noteText, setNoteText] = useState('')

  useEffect(() => {
    if (!isOpen) {
      setEditingNote(null)
      setIsCreating(false)
      setNoteText('')
    }
  }, [isOpen])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!noteText.trim()) {
      showToast('Note text is required', 'error')
      return
    }

    // Check for duplicates
    const isDuplicate = predefinedNotes.some(
      note => note.note.toLowerCase() === noteText.trim().toLowerCase() && note.id !== editingNote?.id
    )
    
    if (isDuplicate) {
      showToast('This note already exists', 'error')
      return
    }

    try {
      if (editingNote) {
        await updatePredefinedNote(editingNote.id!, noteText.trim())
        showToast('Note updated', 'success')
      } else {
        await addPredefinedNote(noteText.trim())
        showToast('Note added', 'success')
      }
      
      setEditingNote(null)
      setIsCreating(false)
      setNoteText('')
    } catch (error) {
      showToast('Failed to save note', 'error')
    }
  }

  const handleEdit = (note: PredefinedNote) => {
    setEditingNote(note)
    setNoteText(note.note)
    setIsCreating(false)
  }

  const handleCreate = () => {
    setIsCreating(true)
    setEditingNote(null)
    setNoteText('')
  }

  const handleDelete = (note: PredefinedNote) => {
    showConfirm(
      'Delete Note',
      `Are you sure you want to delete "${note.note}"?`,
      async () => {
        await deletePredefinedNote(note.id!)
        showToast('Note deleted', 'success')
      }
    )
  }

  const handleCancel = () => {
    setEditingNote(null)
    setIsCreating(false)
    setNoteText('')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && !editingNote && !isCreating) {
      onClose()
    }
  }

  if (!isOpen) {
    return null
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div
        className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onKeyDown={handleKeyDown}
        role="dialog"
        aria-modal="true"
        aria-labelledby="manage-notes-title"
      >
        <div className="flex justify-between items-center mb-6">
          <h2 id="manage-notes-title" className="text-xl font-semibold text-gray-900 dark:text-white">
            Manage Session Notes
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            aria-label="Close"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {(isCreating || editingNote) && (
          <form onSubmit={handleSubmit} className="mb-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <h3 className="font-medium text-gray-900 dark:text-white mb-4">
              {editingNote ? 'Edit Note' : 'Add New Note'}
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Note Text
                </label>
                <input
                  type="text"
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter note text..."
                  autoFocus
                />
              </div>

              <div className="flex space-x-2">
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {editingNote ? 'Update' : 'Add'}
                </button>
                <button
                  type="button"
                  onClick={handleCancel}
                  className="px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-md hover:bg-gray-400 dark:hover:bg-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-500"
                >
                  Cancel
                </button>
              </div>
            </div>
          </form>
        )}

        {!isCreating && !editingNote && (
          <button
            onClick={handleCreate}
            className="w-full mb-4 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            + Add New Note
          </button>
        )}

        <div className="space-y-2">
          <h3 className="font-medium text-gray-900 dark:text-white mb-2">
            Predefined Notes ({predefinedNotes.length})
          </h3>
          
          {predefinedNotes.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400 text-center py-8">
              No predefined notes yet. Add one to get started!
            </p>
          ) : (
            <div className="space-y-2">
              {predefinedNotes.map((note) => (
                <div
                  key={note.id}
                  className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                >
                  <span className="text-gray-900 dark:text-white flex-1">
                    {note.note}
                  </span>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleEdit(note)}
                      className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      aria-label={`Edit ${note.note}`}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(note)}
                      className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
                      aria-label={`Delete ${note.note}`}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

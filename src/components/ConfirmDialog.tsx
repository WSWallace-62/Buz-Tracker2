import React, { useEffect, useRef } from 'react'
import { useUIStore } from '../store/ui'

export function ConfirmDialog() {
  const { confirmDialog, hideConfirm } = useUIStore()
  const confirmButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (confirmDialog?.isOpen && confirmButtonRef.current) {
      confirmButtonRef.current.focus()
    }
  }, [confirmDialog?.isOpen])

  const handleConfirm = () => {
    confirmDialog?.onConfirm()
    hideConfirm()
  }

  const handleCancel = () => {
    confirmDialog?.onCancel?.()
    hideConfirm()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleCancel()
    } else if (e.key === 'Enter') {
      handleConfirm()
    }
  }

  if (!confirmDialog?.isOpen) {
    return null
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div
        className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md shadow-xl"
        onKeyDown={handleKeyDown}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-message"
      >
        <div className="flex items-center mb-4">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mr-3">
            <svg
              className="w-6 h-6 text-red-600 dark:text-red-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
          </div>
          <h3 id="confirm-title" className="text-lg font-semibold text-gray-900 dark:text-white">
            {confirmDialog.title}
          </h3>
        </div>

        <p id="confirm-message" className="text-gray-600 dark:text-gray-300 mb-6">
          {confirmDialog.message}
        </p>

        <div className="flex justify-end space-x-3">
          <button
            onClick={handleCancel}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
          >
            Cancel
          </button>
          <button
            ref={confirmButtonRef}
            onClick={handleConfirm}
            className="px-4 py-2 bg-red-600 dark:bg-red-600 text-white rounded-md hover:bg-red-700 dark:hover:bg-red-500 focus:outline-none focus:ring-2 focus:ring-red-500 dark:focus:ring-red-400 transition-colors"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  )
}
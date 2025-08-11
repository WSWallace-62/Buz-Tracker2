import React, { useEffect, useState, useRef } from 'react'
import { useSessionsStore } from '../store/sessions'
import { useUIStore } from '../store/ui'
import { formatDuration } from '../utils/time'

interface StopwatchProps {
  projectId: number | null
}

export function Stopwatch({ projectId }: StopwatchProps) {
  const {
    runningSession,
    loadRunningSession,
    startSession,
    stopSession,
    getCurrentElapsed
  } = useSessionsStore()
  
  const { showConfirm, showToast } = useUIStore()
  const [elapsed, setElapsed] = useState(0)
  const intervalRef = useRef<NodeJS.Timeout>()
  const stopwatchRef = useRef<HTMLDivElement>(null)

  const isRunning = runningSession?.running === true
  const isCurrentProject = runningSession?.projectId === projectId

  useEffect(() => {
    loadRunningSession()
  }, [loadRunningSession])

  useEffect(() => {
    if (isRunning) {
      const updateElapsed = () => {
        setElapsed(getCurrentElapsed())
      }

      updateElapsed()
      intervalRef.current = setInterval(updateElapsed, 100)

      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current)
        }
      }
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
      setElapsed(0)
    }
  }, [isRunning, getCurrentElapsed])

  // Handle visibility change to recompute elapsed time
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && isRunning) {
        setElapsed(getCurrentElapsed())
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [isRunning, getCurrentElapsed])

  const handleStart = async () => {
    if (!projectId) {
      showToast('Please select a project first', 'error')
      return
    }

    try {
      if (isRunning && !isCurrentProject) {
        // Confirm switching projects
        showConfirm(
          'Switch Project?',
          'A session is already running for another project. Do you want to stop it and start a new session for this project?',
          async () => {
            await stopSession()
            await startSession(projectId)
            showToast('Session started for new project', 'success')
          }
        )
      } else {
        await startSession(projectId)
        showToast('Session started', 'success')
      }
    } catch (error) {
      showToast((error as Error).message, 'error')
    }
  }

  const handleStop = async () => {
    try {
      await stopSession()
      showToast('Session stopped and saved', 'success')
    } catch (error) {
      showToast((error as Error).message, 'error')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.code === 'Space' && e.target === stopwatchRef.current) {
      e.preventDefault()
      if (isRunning && isCurrentProject) {
        handleStop()
      } else {
        handleStart()
      }
    }
  }

  const canStart = projectId && (!isRunning || !isCurrentProject)
  const canStop = isRunning && isCurrentProject

  return (
    <div 
      ref={stopwatchRef}
      className={`
        p-6 bg-white rounded-lg shadow-md border-2 transition-colors duration-200 focus:outline-none
        ${isRunning && isCurrentProject ? 'border-green-500 bg-green-50' : 'border-gray-200'}
      `}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      role="timer"
      aria-label="Stopwatch"
      aria-live="polite"
    >
      <div className="text-center">
        <div className={`text-4xl font-mono font-bold mb-4 ${
          isRunning && isCurrentProject ? 'text-green-700' : 'text-gray-700'
        }`}>
          {formatDuration(isRunning && isCurrentProject ? elapsed : 0)}
        </div>
        
        <div className="flex justify-center space-x-3">
          <button
            onClick={handleStart}
            disabled={!canStart}
            className={`
              px-6 py-2 rounded-md font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2
              ${canStart
                ? 'bg-green-600 text-white hover:bg-green-700 focus:ring-green-500'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }
            `}
            aria-label="Start timer"
          >
            {isRunning && !isCurrentProject ? 'Switch & Start' : 'Start'}
          </button>
          
          <button
            onClick={handleStop}
            disabled={!canStop}
            className={`
              px-6 py-2 rounded-md font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2
              ${canStop
                ? 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }
            `}
            aria-label="Stop timer"
          >
            Stop
          </button>
        </div>

        {isRunning && !isCurrentProject && (
          <p className="mt-3 text-sm text-orange-600">
            Another project session is running. Click "Switch & Start" to stop it and start this one.
          </p>
        )}

        <p className="mt-2 text-xs text-gray-500">
          Press Space to {canStop ? 'stop' : 'start'}
        </p>
      </div>
    </div>
  )
}
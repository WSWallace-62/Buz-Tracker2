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
    getCurrentElapsed,
    discardRunningSession
  } = useSessionsStore()
  
  const { showConfirm, showToast } = useUIStore()
  const [elapsed, setElapsed] = useState(0)
  const [note, setNote] = useState('')
  const [isPaused, setIsPaused] = useState(false) // New state for pause
  const intervalRef = useRef<NodeJS.Timeout>()
  const stopwatchRef = useRef<HTMLDivElement>(null)

  const isRunning = runningSession?.running === true
  const isCurrentProject = runningSession?.projectId === projectId

  useEffect(() => {
    loadRunningSession()
  }, [loadRunningSession])

  useEffect(() => {
    if (runningSession?.note) {
      setNote(runningSession.note)
    }
  }, [runningSession])

  useEffect(() => {
    if (isRunning && !isPaused) { // Only run interval if not paused
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
      if (!isRunning) {
        setElapsed(0)
      }
    }
  }, [isRunning, isPaused, getCurrentElapsed])

  // Handle visibility change to recompute elapsed time
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && isRunning && !isPaused) {
        setElapsed(getCurrentElapsed())
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [isRunning, isPaused, getCurrentElapsed])

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
            await startSession(projectId, note)
            showToast('Session started for new project', 'success')
          }
        )
      } else {
        await startSession(projectId, note)
        setIsPaused(false) // Reset pause state on new start
        showToast('Session started', 'success')
      }
    } catch (error) {
      showToast((error as Error).message, 'error')
    }
  }

  const handleEnd = async () => {
    try {
      await stopSession()
      setNote('')
      setIsPaused(false) // Reset pause state on stop
      showToast('Session ended and saved', 'success')
    } catch (error) {
      showToast((error as Error).message, 'error')
    }
  }

  // --- New Pause Handler ---
  const handlePause = () => {
    setIsPaused(!isPaused)
    showToast(`Timer ${!isPaused ? 'resumed' : 'paused'}`, 'info')
  }

  const handleReset = () => {
    if (isRunning) {
      showConfirm(
        'Discard Session?',
        'Are you sure you want to discard this running session? This action cannot be undone.',
        async () => {
          try {
            await discardRunningSession()
            setNote('')
            setIsPaused(false) // Reset pause state
            showToast('Session discarded', 'info')
          } catch (error) {
            showToast((error as Error).message, 'error')
          }
        }
      )
    } else {
      setElapsed(0)
      setNote('')
    }
  }


  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.code === 'Space' && e.target === stopwatchRef.current) {
      e.preventDefault()
      if (isRunning && isCurrentProject) {
        handleEnd()
      } else {
        handleStart()
      }
    }
  }

  const canStart = projectId && (!isRunning || !isCurrentProject)
  const canEnd = isRunning && isCurrentProject
  const canPause = isRunning && isCurrentProject

  return (
    <div 
      ref={stopwatchRef}
      className={`
        p-6 bg-white rounded-lg shadow-md border-2 transition-colors duration-200 focus:outline-none
        ${isRunning && isCurrentProject ? (isPaused ? 'border-yellow-500 bg-yellow-50' : 'border-green-500 bg-green-50') : 'border-gray-200'}
      `}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      role="timer"
      aria-label="Stopwatch"
      aria-live="polite"
    >
      <div className="text-center">
        <div className={`text-4xl font-mono font-bold mb-4 ${
          isRunning && isCurrentProject ? (isPaused ? 'text-yellow-700' : 'text-green-700') : 'text-gray-700'
        }`}>
          {formatDuration(isRunning && isCurrentProject ? elapsed : 0)}
        </div>
        
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Add a note for this session..."
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
          rows={2}
          disabled={isRunning}
        />
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
            onClick={handlePause}
            disabled={!canPause}
            className={`
              px-6 py-2 rounded-md font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2
              ${canPause
                ? isPaused 
                  ? 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500' 
                  : 'bg-yellow-500 text-white hover:bg-yellow-600 focus:ring-yellow-500'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }
            `}
            aria-label={isPaused ? "Continue timer" : "Pause timer"}
          >
            {isPaused ? 'Continue' : 'Pause'}
          </button>

          <button
            onClick={handleReset}
            className={`
              px-6 py-2 rounded-md font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2
              bg-gray-600 text-white hover:bg-gray-700 focus:ring-gray-500
            `}
            aria-label="Reset timer"
          >
            Reset
          </button>
          
          <button
            onClick={handleEnd}
            disabled={!canEnd}
            className={`
              px-6 py-2 rounded-md font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2
              ${canEnd
                ? 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }
            `}
            aria-label="End timer"
          >
            End
          </button>
        </div>

        {isRunning && !isCurrentProject && (
          <p className="mt-3 text-sm text-orange-600">
            Another project session is running. Click "Switch & Start" to stop it and start this one.
          </p>
        )}

        <p className="mt-2 text-xs text-gray-500">
          Press Space to {canEnd ? 'end' : 'start'}
        </p>
      </div>
    </div>
  )
}
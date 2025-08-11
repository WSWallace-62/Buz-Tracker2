import React, { useRef, useState } from 'react'
import { useSessionsStore } from '../store/sessions'
import { useProjectsStore } from '../store/projects'
import { useUIStore } from '../store/ui'
import { Session, Project } from '../db/dexie'
import dayjs from 'dayjs'

interface ExportData {
  projects: Project[]
  sessions: Session[]
  exported: string
  version: string
}

export function ImportExport() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { sessions, createSession } = useSessionsStore()
  const { projects, createProject } = useProjectsStore()
  const { showToast } = useUIStore()
  const [isImporting, setIsImporting] = useState(false)

  const exportData = () => {
    const data: ExportData = {
      projects,
      sessions,
      exported: dayjs().toISOString(),
      version: '1.0.0'
    }

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `buztracker-backup-${dayjs().format('YYYY-MM-DD-HHmm')}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    showToast('Data exported successfully', 'success')
  }

  const importData = async (file: File) => {
    setIsImporting(true)
    try {
      const text = await file.text()
      const data: ExportData = JSON.parse(text)

      // Validate data structure
      if (!data.projects || !data.sessions || !Array.isArray(data.projects) || !Array.isArray(data.sessions)) {
        throw new Error('Invalid backup file format')
      }

      // Create project ID mapping for new projects
      const projectIdMap = new Map<number, number>()
      
      for (const project of data.projects) {
        const existingProject = projects.find(p => p.name === project.name)
        if (existingProject) {
          projectIdMap.set(project.id!, existingProject.id!)
        } else {
          await createProject({
            name: project.name,
            color: project.color,
            archived: project.archived
          })
          // Get the newly created project ID
          const newProjects = useProjectsStore.getState().projects
          const newProject = newProjects.find(p => p.name === project.name)
          if (newProject) {
            projectIdMap.set(project.id!, newProject.id!)
          }
        }
      }

      // Import sessions with mapped project IDs
      let importedCount = 0
      for (const session of data.sessions) {
        const existingSession = sessions.find(s => 
          s.start === session.start && s.projectId === projectIdMap.get(session.projectId)
        )
        
        if (!existingSession) {
          await createSession({
            projectId: projectIdMap.get(session.projectId) || session.projectId,
            start: session.start,
            stop: session.stop,
            durationMs: session.durationMs,
            note: session.note
          })
          importedCount++
        }
      }

      showToast(`Imported ${importedCount} sessions successfully`, 'success')
    } catch (error) {
      showToast(`Import failed: ${(error as Error).message}`, 'error')
    } finally {
      setIsImporting(false)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      importData(file)
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const triggerImport = () => {
    fileInputRef.current?.click()
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="text-lg font-semibold mb-4">Import & Export</h3>
      
      <div className="flex flex-wrap gap-4">
        <button
          onClick={exportData}
          className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors focus:outline-none focus:ring-2 focus:ring-green-500"
        >
          Export All Data
        </button>
        
        <button
          onClick={triggerImport}
          disabled={isImporting}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
        >
          {isImporting ? 'Importing...' : 'Import Data'}
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={handleFileChange}
        className="hidden"
      />

      <div className="mt-4 text-sm text-gray-600">
        <p><strong>Export:</strong> Downloads a JSON backup of all your projects and time sessions.</p>
        <p><strong>Import:</strong> Merges data from a backup file. Duplicate sessions are skipped.</p>
      </div>
    </div>
  )
}
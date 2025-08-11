import React, { useEffect, useState } from 'react'
import { useProjectsStore } from '../store/projects'
import { useUIStore } from '../store/ui'

interface ProjectSelectProps {
  onProjectChange?: (projectId: number) => void
  disabled?: boolean
}

export function ProjectSelect({ onProjectChange, disabled = false }: ProjectSelectProps) {
  const { projects, loadProjects } = useProjectsStore()
  const { currentProjectId, setCurrentProject, openProjectManager } = useUIStore()
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    loadProjects()
  }, [loadProjects])

  useEffect(() => {
    // Set first project as default if none selected
    if (!currentProjectId && projects.length > 0) {
      const firstActiveProject = projects.find(p => !p.archived)
      if (firstActiveProject) {
        setCurrentProject(firstActiveProject.id!)
      }
    }
  }, [projects, currentProjectId, setCurrentProject])

  const activeProjects = projects.filter(p => !p.archived)
  const currentProject = projects.find(p => p.id === currentProjectId)

  const handleProjectSelect = (projectId: number) => {
    setCurrentProject(projectId)
    onProjectChange?.(projectId)
    setIsOpen(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return
    
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      setIsOpen(!isOpen)
    } else if (e.key === 'Escape') {
      setIsOpen(false)
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
        className={`
          w-full flex items-center justify-between px-3 py-2 border border-gray-300 
          rounded-md shadow-sm bg-white text-left focus:outline-none focus:ring-2 
          focus:ring-blue-500 focus:border-blue-500
          ${disabled ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : 'hover:bg-gray-50'}
        `}
        aria-label="Select project"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <div className="flex items-center">
          {currentProject && (
            <div
              className="w-3 h-3 rounded-full mr-2 flex-shrink-0"
              style={{ backgroundColor: currentProject.color }}
            />
          )}
          <span className="truncate">
            {currentProject?.name || 'Select project...'}
          </span>
        </div>
        <svg
          className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute z-10 mt-1 w-full bg-white border border-gray-300 rounded-md shadow-lg">
          <ul className="py-1 max-h-60 overflow-auto" role="listbox">
            {activeProjects.map((project) => (
              <li key={project.id} role="option" aria-selected={project.id === currentProjectId}>
                <button
                  type="button"
                  onClick={() => handleProjectSelect(project.id!)}
                  className={`
                    w-full text-left px-3 py-2 flex items-center hover:bg-gray-50
                    ${project.id === currentProjectId ? 'bg-blue-50 text-blue-900' : 'text-gray-900'}
                  `}
                >
                  <div
                    className="w-3 h-3 rounded-full mr-2 flex-shrink-0"
                    style={{ backgroundColor: project.color }}
                  />
                  <span className="truncate">{project.name}</span>
                </button>
              </li>
            ))}
            
            <li className="border-t border-gray-100">
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false)
                  openProjectManager()
                }}
                className="w-full text-left px-3 py-2 flex items-center hover:bg-gray-50 text-blue-600"
              >
                <svg
                  className="w-4 h-4 mr-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Manage Projects
              </button>
            </li>
          </ul>
        </div>
      )}

      {isOpen && (
        <div
          className="fixed inset-0 z-0"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  )
}
import React, { useState, useEffect } from 'react'
import { useProjectsStore } from '../store/projects'
import { useCustomersStore } from '../store/customers'
import { useUIStore } from '../store/ui'
import { Project } from '../db/dexie'

const COLORS = [
  '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6',
  '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1',
  '#14b8a6', '#f43f5e', '#22c55e', '#a855f7', '#0ea5e9'
]

export function ProjectManagerModal() {
  const { projects, createProject, updateProject, deleteProject, archiveProject } = useProjectsStore()
  const { customers, loadCustomers } = useCustomersStore()
  const { isProjectManagerOpen, closeProjectManager, showConfirm, showToast } = useUIStore()
  const [editingProject, setEditingProject] = useState<Project | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [formData, setFormData] = useState({ name: '', color: COLORS[0], customerId: undefined as number | undefined })

  useEffect(() => {
    if (isProjectManagerOpen) {
      loadCustomers();
    }
  }, [isProjectManagerOpen, loadCustomers]);

  useEffect(() => {
    if (!isProjectManagerOpen) {
      setEditingProject(null)
      setIsCreating(false)
      setFormData({ name: '', color: COLORS[0], customerId: undefined })
    }
  }, [isProjectManagerOpen])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.name.trim()) {
      showToast('Project name is required', 'error')
      return
    }

    try {
      if (editingProject) {
        await updateProject(editingProject.id!, {
          name: formData.name.trim(),
          color: formData.color,
          customerId: formData.customerId
        })
        showToast('Project updated', 'success')
      } else {
        await createProject({
          name: formData.name.trim(),
          color: formData.color,
          customerId: formData.customerId,
          archived: false
        })
        showToast('Project created', 'success')
      }

      setEditingProject(null)
      setIsCreating(false)
      setFormData({ name: '', color: COLORS[0], customerId: undefined })
    } catch (error) {
      showToast('Failed to save project', 'error')
    }
  }

  const handleEdit = (project: Project) => {
    setEditingProject(project)
    setFormData({ name: project.name, color: project.color, customerId: project.customerId })
    setIsCreating(false)
  }

  const handleCreate = () => {
    setIsCreating(true)
    setEditingProject(null)
    setFormData({ name: '', color: COLORS[0], customerId: undefined })
  }

  const handleDelete = (project: Project) => {
    showConfirm(
      'Delete Project',
      `Are you sure you want to delete "${project.name}"? This will also delete all associated time sessions.`,
      async () => {
        await deleteProject(project.id!)
        showToast('Project deleted', 'success')
      }
    )
  }

  const handleArchive = (project: Project) => {
    const action = project.archived ? 'unarchive' : 'archive'
    showConfirm(
      `${action.charAt(0).toUpperCase() + action.slice(1)} Project`,
      `Are you sure you want to ${action} "${project.name}"?`,
      async () => {
        await archiveProject(project.id!, !project.archived)
        showToast(`Project ${action}d`, 'success')
      }
    )
  }

  const handleCancel = () => {
    setEditingProject(null)
    setIsCreating(false)
    setFormData({ name: '', color: COLORS[0], customerId: undefined })
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && !editingProject && !isCreating) {
      closeProjectManager()
    }
  }

  if (!isProjectManagerOpen) {
    return null
  }

  const activeProjects = projects.filter(p => !p.archived)
  const archivedProjects = projects.filter(p => p.archived)

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div
        className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onKeyDown={handleKeyDown}
        role="dialog"
        aria-modal="true"
        aria-labelledby="project-manager-title"
      >
        <div className="flex justify-between items-center mb-6">
          <h2 id="project-manager-title" className="text-xl font-semibold text-gray-900 dark:text-white">
            Manage Projects
          </h2>
          <button
            onClick={closeProjectManager}
            className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            aria-label="Close"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {(isCreating || editingProject) && (
          <form onSubmit={handleSubmit} className="mb-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <h3 className="font-medium text-gray-900 dark:text-white mb-4">
              {editingProject ? 'Edit Project' : 'Create New Project'}
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Project Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter project name..."
                  autoFocus
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Customer (Optional)
                </label>
                <select
                  value={formData.customerId || ''}
                  onChange={(e) => setFormData({ ...formData, customerId: e.target.value ? Number(e.target.value) : undefined })}
                  className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">No customer</option>
                  {customers.filter(c => !c.archived).map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.companyName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Color
                </label>
                <div className="flex flex-wrap gap-2">
                  {COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setFormData({ ...formData, color })}
                      className={`
                        w-8 h-8 rounded-full border-2 transition-all
                        ${formData.color === color ? 'border-gray-400 dark:border-gray-500 scale-110' : 'border-gray-200 dark:border-gray-600'}
                      `}
                      style={{ backgroundColor: color }}
                      aria-label={`Select color ${color}`}
                    />
                  ))}
                </div>
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {editingProject ? 'Update' : 'Create'}
                </button>
              </div>
            </div>
          </form>
        )}

        <div className="space-y-6">
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-medium text-gray-900 dark:text-white">Active Projects</h3>
              <button
                onClick={handleCreate}
                className="px-3 py-1 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
              >
                + Add Project
              </button>
            </div>

            {activeProjects.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400 text-center py-4">No active projects</p>
            ) : (
              <div className="space-y-2">
                {activeProjects.map((project) => (
                  <ProjectItem
                    key={project.id}
                    project={project}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onArchive={handleArchive}
                  />
                ))}
              </div>
            )}
          </div>

          {archivedProjects.length > 0 && (
            <div>
              <h3 className="font-medium text-gray-900 dark:text-white mb-4">Archived Projects</h3>
              <div className="space-y-2">
                {archivedProjects.map((project) => (
                  <ProjectItem
                    key={project.id}
                    project={project}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onArchive={handleArchive}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

interface ProjectItemProps {
  project: Project
  onEdit: (project: Project) => void
  onDelete: (project: Project) => void
  onArchive: (project: Project) => void
}


function ProjectItem({ project, onEdit, onDelete, onArchive }: ProjectItemProps) {
  return (
    <div className={`
      flex items-center justify-between p-3 border border-gray-200 dark:border-gray-700 rounded-lg
      ${project.archived ? 'bg-gray-50 dark:bg-gray-700 opacity-75' : 'bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700'}
    `}>
      <div className="flex items-center">
        <div
          className="w-4 h-4 rounded-full mr-3 flex-shrink-0"
          style={{ backgroundColor: project.color }}
        />
        <span className={`font-medium ${project.archived ? 'text-gray-500 dark:text-gray-400' : 'text-gray-900 dark:text-white'}`}>
          {project.name}
        </span>
        {project.archived && (
          <span className="ml-2 px-2 py-1 bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 text-xs rounded-full">
            Archived
          </span>
        )}
      </div>

      <div className="flex space-x-2">
        <button
          onClick={() => onEdit(project)}
          className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors p-1"
          aria-label="Edit project"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </button>

        <button
          onClick={() => onArchive(project)}
          className="text-orange-600 dark:text-orange-400 hover:text-orange-800 dark:hover:text-orange-300 transition-colors p-1"
          aria-label={project.archived ? 'Unarchive project' : 'Archive project'}
        >
          {project.archived ? (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16l-4-4m0 0l4-4m-4 4h18" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
            </svg>
          )}
        </button>

        <button
          onClick={() => onDelete(project)}
          className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 transition-colors p-1"
          aria-label="Delete project"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    </div>
  )
}
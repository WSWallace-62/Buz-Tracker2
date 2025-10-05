import React, { useState } from 'react';
import { useProjectsStore } from '../store/projects';
import { useUIStore } from '../store/ui';
import { Project } from '../db/dexie';

const COLORS = [
  '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6',
  '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1',
  '#14b8a6', '#f43f5e', '#22c55e', '#a855f7', '#0ea5e9'
];

interface CustomerProjectManagerProps {
  customerFirestoreId: string;
  customerId: number;
  customerName: string;  // Add customer name for better context in dialogs
  projects: Project[];
}

export function CustomerProjectManager({ customerFirestoreId, customerId, customerName, projects }: CustomerProjectManagerProps) {
  const { createProject, updateProject, deleteProject, archiveProject } = useProjectsStore();
  const { showConfirm, showToast } = useUIStore();
  const [isCreating, setIsCreating] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [formData, setFormData] = useState({ name: '', color: COLORS[0] });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      showToast('Project name is required', 'error');
      return;
    }

    try {
      if (editingProject) {
        await updateProject(editingProject.id!, {
          name: formData.name.trim(),
          color: formData.color,
          customerId: customerId,
          customerFirestoreId: customerFirestoreId
        });
        showToast('Project updated', 'success');
      } else {
        await createProject({
          name: formData.name.trim(),
          color: formData.color,
          customerId: customerId,
          customerFirestoreId: customerFirestoreId,
          archived: false
        });
        showToast('Project created', 'success');
      }

      setEditingProject(null);
      setIsCreating(false);
      setFormData({ name: '', color: COLORS[0] });
    } catch (error) {
      showToast('Failed to save project', 'error');
    }
  };

  const handleEdit = (project: Project) => {
    setEditingProject(project);
    setFormData({ name: project.name, color: project.color });
    setIsCreating(false);
  };

  const handleCreate = () => {
    setIsCreating(true);
    setEditingProject(null);
    setFormData({ name: '', color: COLORS[0] });
  };

  const handleDelete = (project: Project) => {
    const confirmText = `Delete-${project.name}`;
    showConfirm(
      'Delete Project',
      `Are you sure you want to delete "${project.name}" from ${customerName}?\n\nThis will also delete all associated time sessions.\n\nThis action cannot be undone.`,
      async () => {
        await deleteProject(project.id!);
        showToast('Project deleted', 'success');
      },
      undefined,
      confirmText
    );
  };

  const handleArchive = (project: Project) => {
    const action = project.archived ? 'unarchive' : 'archive';
    showConfirm(
      `${action.charAt(0).toUpperCase() + action.slice(1)} Project`,
      `Are you sure you want to ${action} "${project.name}"?`,
      async () => {
        await archiveProject(project.id!, !project.archived);
        showToast(`Project ${action}d`, 'success');
      }
    );
  };

  const handleCancel = () => {
    setEditingProject(null);
    setIsCreating(false);
    setFormData({ name: '', color: COLORS[0] });
  };

  const activeProjects = projects.filter(p => !p.archived);
  const archivedProjects = projects.filter(p => p.archived);

  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Projects</h4>
        {!isCreating && !editingProject && (
          <button
            onClick={handleCreate}
            className="px-3 py-1 bg-blue-600 text-white text-xs rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
          >
            + Add Project
          </button>
        )}
      </div>

      {/* Create/Edit Form */}
      {(isCreating || editingProject) && (
        <form onSubmit={handleSubmit} className="mb-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
          <h5 className="font-medium text-gray-900 dark:text-white mb-3 text-sm">
            {editingProject ? 'Edit Project' : 'Create New Project'}
          </h5>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Project Name
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter project name..."
                autoFocus
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                Color
              </label>
              <div className="flex flex-wrap gap-2">
                {COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setFormData({ ...formData, color })}
                    className={`
                      w-6 h-6 rounded-full border-2 transition-all
                      ${formData.color === color ? 'border-gray-400 dark:border-gray-500 scale-110' : 'border-gray-200 dark:border-gray-600'}
                    `}
                    style={{ backgroundColor: color }}
                    aria-label={`Select color ${color}`}
                  />
                ))}
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={handleCancel}
                className="px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {editingProject ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Active Projects List */}
      {activeProjects.length > 0 && (
        <div className="space-y-2 mb-3">
          {activeProjects.map((project) => (
            <div
              key={project.id}
              className="flex items-center justify-between p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <div className="flex items-center">
                <div
                  className="w-3 h-3 rounded-full mr-2 flex-shrink-0"
                  style={{ backgroundColor: project.color }}
                />
                <span className="text-sm text-gray-900 dark:text-white">{project.name}</span>
              </div>

              <div className="flex space-x-1">
                <button
                  onClick={() => handleEdit(project)}
                  className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors p-1"
                  aria-label="Edit project"
                  title="Edit project"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>

                <button
                  onClick={() => handleArchive(project)}
                  className="text-orange-600 dark:text-orange-400 hover:text-orange-800 dark:hover:text-orange-300 transition-colors p-1"
                  aria-label="Archive project"
                  title="Archive project"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                  </svg>
                </button>

                <button
                  onClick={() => handleDelete(project)}
                  className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 transition-colors p-1"
                  aria-label="Delete project"
                  title="Delete project"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Archived Projects List */}
      {archivedProjects.length > 0 && (
        <div className="mt-4">
          <h5 className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">Archived Projects</h5>
          <div className="space-y-2">
            {archivedProjects.map((project) => (
              <div
                key={project.id}
                className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-700 rounded-md opacity-75"
              >
                <div className="flex items-center">
                  <div
                    className="w-3 h-3 rounded-full mr-2 flex-shrink-0"
                    style={{ backgroundColor: project.color }}
                  />
                  <span className="text-sm text-gray-600 dark:text-gray-400">{project.name}</span>
                  <span className="ml-2 px-2 py-0.5 bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 text-xs rounded-full">
                    Archived
                  </span>
                </div>

                <div className="flex space-x-1">
                  <button
                    onClick={() => handleEdit(project)}
                    className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors p-1"
                    aria-label="Edit project"
                    title="Edit project"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>

                  <button
                    onClick={() => handleArchive(project)}
                    className="text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-300 transition-colors p-1"
                    aria-label="Unarchive project"
                    title="Unarchive project"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16l-4-4m0 0l4-4m-4 4h18" />
                    </svg>
                  </button>

                  <button
                    onClick={() => handleDelete(project)}
                    className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 transition-colors p-1"
                    aria-label="Delete project"
                    title="Delete project"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {activeProjects.length === 0 && archivedProjects.length === 0 && !isCreating && !editingProject && (
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
          No projects yet. Click "Add Project" to create one.
        </p>
      )}
    </div>
  );
}

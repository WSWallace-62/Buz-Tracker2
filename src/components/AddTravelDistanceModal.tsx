import { useState, useEffect, useMemo } from 'react';
import { useCustomersStore } from '../store/customers';
import { useProjectsStore } from '../store/projects';
import { useTravelEntriesStore } from '../store/travelEntries';
import { useUIStore } from '../store/ui';
import dayjs from 'dayjs';

export function AddTravelDistanceModal() {
  const { customers } = useCustomersStore();
  const { projects } = useProjectsStore();
  const { createTravelEntry } = useTravelEntriesStore();
  const { isTravelDistanceModalOpen, closeTravelDistanceModal, showToast, currentProjectId } = useUIStore();

  const [formData, setFormData] = useState({
    customerId: '',
    projectId: '',
    date: dayjs().format('YYYY-MM-DD'),
    distance: '',
    note: '',
  });

  const [unit, setUnit] = useState<'km' | 'miles'>('km');

  // Get the current project
  const currentProject = useMemo(
    () => projects.find(p => p.id === currentProjectId),
    [projects, currentProjectId]
  );

  // Get the customer for the current project (used for displaying customer info)
  const selectedCustomer = useMemo(() => {
    if (!currentProject) return null;

    // First try to find by customerFirestoreId
    if (currentProject.customerFirestoreId) {
      const customer = customers.find(c => c.firestoreId === currentProject.customerFirestoreId);
      if (customer) return customer;
    }

    // Fallback to customerId
    if (currentProject.customerId) {
      return customers.find(c => c.id === currentProject.customerId);
    }

    return null;
  }, [currentProject, customers]);

  // Update unit when customer changes

  // Reset form when modal opens - auto-populate from current project
  useEffect(() => {
    if (isTravelDistanceModalOpen) {
      // If there's a current project, use it and its customer
      if (currentProject) {
        // Find the customer for this project
        let projectCustomer = null;

        // First try to find by customerFirestoreId
        if (currentProject.customerFirestoreId) {
          projectCustomer = customers.find(c => c.firestoreId === currentProject.customerFirestoreId);
        }

        // Fallback to customerId if customerFirestoreId didn't work
        if (!projectCustomer && currentProject.customerId) {
          projectCustomer = customers.find(c => c.id === currentProject.customerId);
        }

        setFormData({
          customerId: projectCustomer?.firestoreId?.toString() || projectCustomer?.id?.toString() || '',
          projectId: currentProject.firestoreId?.toString() || currentProject.id?.toString() || '',
          date: dayjs().format('YYYY-MM-DD'),
          distance: '',
          note: '',
        });

        // Set unit from customer if available
        if (projectCustomer) {
          setUnit(projectCustomer.travelDistanceUnit || 'km');
        }
      } else {
        // No current project, reset to empty
        setFormData({
          customerId: '',
          projectId: '',
          date: dayjs().format('YYYY-MM-DD'),
          distance: '',
          note: '',
        });
        setUnit('km');
      }
    }
  }, [isTravelDistanceModalOpen, currentProject, customers]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation - only check for project since customer is derived from project
    if (!formData.projectId) {
      showToast('Please select a project', 'error');
      return;
    }

    if (!formData.distance || parseFloat(formData.distance) <= 0) {
      showToast('Please enter a valid distance', 'error');
      return;
    }

    if (!formData.date) {
      showToast('Please select a date', 'error');
      return;
    }

    try {
      const dateTimestamp = dayjs(formData.date).startOf('day').valueOf();

      // Get the selected project to derive customer information
      const selectedProject = projects.find(p => p.id?.toString() === formData.projectId || p.firestoreId === formData.projectId);
      if (!selectedProject) {
        showToast('Selected project not found', 'error');
        return;
      }

      // Derive customer ID from project
      const customerFirestoreId = selectedProject.customerFirestoreId;
      const customerId = selectedCustomer?.firestoreId || selectedCustomer?.id;

      if (!customerId) {
        showToast('Could not determine customer for this project', 'error');
        return;
      }

      await createTravelEntry({
        projectId: selectedProject.firestoreId || selectedProject.id!,
        customerId: customerId,
        customerFirestoreId: customerFirestoreId,
        date: dateTimestamp,
        distance: parseFloat(formData.distance),
        unit,
        note: formData.note.trim() || undefined,
      });

      showToast('Travel distance added successfully', 'success');
      closeTravelDistanceModal();
    } catch (error) {
      console.error('Failed to add travel entry:', error);
      showToast('Failed to add travel distance', 'error');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      closeTravelDistanceModal();
    } else if (e.key === 'Enter' && e.ctrlKey) {
      handleSubmit(e as any);
    }
  };

  if (!isTravelDistanceModalOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full"
        onKeyDown={handleKeyDown}
      >
        <div className="p-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
            Add Travel Distance
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Customer Display (Read-only) */}
            {currentProject && selectedCustomer && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Customer
                </label>
                <div className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white">
                  {selectedCustomer.companyName}
                </div>
              </div>
            )}

            {/* Project Display (Read-only) */}
            {currentProject && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Project
                </label>
                <div className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white">
                  {currentProject.name}
                </div>
              </div>
            )}

            {/* Show warning if no project is selected */}
            {!currentProject && (
              <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md">
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  Please select a project from the dropdown at the top of the page before adding travel distance.
                </p>
              </div>
            )}

            {/* Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>

            {/* Distance */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Distance ({unit}) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={formData.distance}
                onChange={(e) => setFormData({ ...formData, distance: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder={`Enter distance in ${unit}`}
                required
              />
              {selectedCustomer && (
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Rate: {selectedCustomer.currency} {selectedCustomer.distanceRate?.toFixed(2)}/{unit}
                </p>
              )}
            </div>

            {/* Note */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Note
              </label>
              <textarea
                value={formData.note}
                onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                rows={3}
                placeholder="Optional note about this travel"
              />
            </div>

            {/* Buttons */}
            <div className="flex justify-end gap-3 pt-4">
              <button
                type="button"
                onClick={closeTravelDistanceModal}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!currentProject}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                Add Travel Distance
              </button>
            </div>

            <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
              Press Ctrl+Enter to submit, Esc to cancel
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}

import React, { useState, useEffect, useMemo } from 'react';
import { useTravelEntriesStore } from '../store/travelEntries';
import { useCustomersStore } from '../store/customers';
import { useProjectsStore } from '../store/projects';
import { useUIStore } from '../store/ui';
import { TravelEntry } from '../db/dexie';
import dayjs from 'dayjs';

interface EditTravelEntryModalProps {
  entry: TravelEntry;
  onClose: () => void;
}

const EditTravelEntryModal: React.FC<EditTravelEntryModalProps> = ({ entry, onClose }) => {
  const { updateTravelEntry } = useTravelEntriesStore();
  const { customers } = useCustomersStore();
  const { projects } = useProjectsStore();
  const { showToast } = useUIStore();

  const [formData, setFormData] = useState({
    date: dayjs(entry.date).format('YYYY-MM-DD'),
    projectId: entry.projectId,
    distance: entry.distance,
    unit: entry.unit,
    note: entry.note || '',
  });

  const [selectedCustomerFirestoreId, setSelectedCustomerFirestoreId] = useState<string | undefined>(entry.customerFirestoreId);

  const availableProjects = useMemo(() => {
    if (!selectedCustomerFirestoreId) {
      // Show all non-archived projects if no customer is selected
      return projects.filter(p => !p.archived);
    }
    // Filter projects by the selected customer
    return projects.filter(p => !p.archived && p.customerFirestoreId === selectedCustomerFirestoreId);
  }, [projects, selectedCustomerFirestoreId]);

  useEffect(() => {
    // Handle outside click to close
    const handleOutsideClick = (e: MouseEvent) => {
      if ((e.target as HTMLElement).classList.contains('modal-backdrop')) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [onClose]);

  const handleCustomerChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newCustomerFirestoreId = e.target.value;
    setSelectedCustomerFirestoreId(newCustomerFirestoreId);

    // Find the first project for the newly selected customer and set it
    const firstProject = projects.find(p => p.customerFirestoreId === newCustomerFirestoreId && !p.archived);
    setFormData(prev => ({
      ...prev,
      projectId: firstProject?.firestoreId || '',
    }));
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!entry.id || !formData.projectId) {
      showToast('A project must be selected.', 'error');
      return;
    }

    try {
      const project = projects.find(p => p.firestoreId === formData.projectId);

      await updateTravelEntry(entry.id, {
        date: dayjs(formData.date).startOf('day').valueOf(),
        projectId: formData.projectId,
        customerFirestoreId: project?.customerFirestoreId,
        distance: Number(formData.distance),
        unit: formData.unit as 'km' | 'miles',
        note: formData.note,
      });
      showToast('Travel entry updated successfully', 'success');
      onClose();
    } catch (error) {
      showToast('Failed to update travel entry', 'error');
      console.error(error);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      handleSubmit(e as any);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-25 dark:bg-opacity-50 flex items-center justify-center z-50 modal-backdrop" onKeyDown={handleKeyDown}>
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Edit Travel Entry</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Date</label>
            <input type="date" name="date" value={formData.date} onChange={handleChange} required className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Customer</label>
            <select
              name="customerFirestoreId"
              value={selectedCustomerFirestoreId || ''}
              onChange={handleCustomerChange}
              required
              className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="" disabled>Select a customer</option>
              {customers.filter(c => !c.archived).map(c => <option key={c.firestoreId} value={c.firestoreId}>{c.companyName}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Project</label>
            <select
              name="projectId"
              value={formData.projectId}
              onChange={handleChange}
              required
              disabled={!selectedCustomerFirestoreId}
              className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-200 dark:disabled:bg-gray-600"
            >
              <option value="" disabled>Select a project</option>
              {availableProjects.map(p => <option key={p.firestoreId} value={p.firestoreId}>{p.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Distance</label>
                <input type="number" name="distance" value={formData.distance} onChange={handleChange} required className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Unit</label>
                <select name="unit" value={formData.unit} onChange={handleChange} required className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="km">km</option>
                    <option value="miles">miles</option>
                </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Note</label>
            <textarea name="note" value={formData.note} onChange={handleChange} rows={3} className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="flex justify-end space-x-3 pt-4">
            <button type="button" onClick={onClose} className="px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500">Cancel</button>
            <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500">Save Changes</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditTravelEntryModal;

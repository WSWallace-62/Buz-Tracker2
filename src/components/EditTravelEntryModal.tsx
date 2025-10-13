import React, { useState, useEffect } from 'react';
import { useTravelEntriesStore } from '../store/travelEntries';
import { useCustomersStore } from '../store/customers';
import { useProjectsStore } from '../store/projects';
import { useUIStore } from '../store/ui';
import { TravelEntry } from '../db/dexie';
import { formatDate } from '../utils/time';

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
    date: formatDate(entry.date),
    customerId: entry.customerId,
    customerFirestoreId: entry.customerFirestoreId,
    projectId: entry.projectId,
    distance: entry.distance,
    unit: entry.unit,
    note: entry.note || '',
  });

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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));

    if (name === 'customerId') {
        const selectedCustomer = customers.find(c => c.id === Number(value));
        if (selectedCustomer) {
            setFormData(prev => ({
                ...prev,
                customerFirestoreId: selectedCustomer.firestoreId,
                // Automatically select the first project associated with the customer
                projectId: projects.find(p => p.customerId === selectedCustomer.id || p.customerFirestoreId === selectedCustomer.firestoreId)?.id || 0
            }));
        }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!entry.id) return;

    try {
      await updateTravelEntry(entry.id, {
        ...formData,
        date: new Date(formData.date).getTime(),
        distance: Number(formData.distance),
        customerId: Number(formData.customerId),
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

  const availableProjects = projects.filter(p => !p.archived && (p.customerId === formData.customerId || p.customerFirestoreId === formData.customerFirestoreId));

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
            <select name="customerId" value={formData.customerId} onChange={handleChange} required className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
              {customers.filter(c => !c.archived).map(c => <option key={c.id} value={c.id}>{c.companyName}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Project</label>
            <select name="projectId" value={formData.projectId} onChange={handleChange} required className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
              {availableProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
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
                    <option value="mile">mile</option>
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

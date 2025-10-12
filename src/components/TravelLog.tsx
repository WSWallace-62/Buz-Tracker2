import React, { useEffect, useState } from 'react';
import { useTravelEntriesStore, TravelEntry } from '../store/travelEntries';
import { useCustomersStore } from '../store/customers';
import { useProjectsStore } from '../store/projects';
import { useUIStore } from '../store/ui';
import EditTravelEntryModal from './EditTravelEntryModal';

const TravelLog: React.FC = () => {
  const { travelEntries, deleteTravelEntry, loadTravelEntries } = useTravelEntriesStore();
  const { customers, loadCustomers } = useCustomersStore();
  const { projects, loadProjects } = useProjectsStore();
  const { showConfirm, showToast } = useUIStore();
  const [editingEntry, setEditingEntry] = useState<TravelEntry | null>(null);

  useEffect(() => {
    loadTravelEntries();
    loadCustomers();
    loadProjects();
  }, [loadTravelEntries, loadCustomers, loadProjects]);

  const handleEdit = (entry: TravelEntry) => {
    setEditingEntry(entry);
  };

  const handleDelete = (entry: TravelEntry) => {
    showConfirm(
      'Delete Travel Entry',
      `Are you sure you want to delete this entry of ${entry.distance} ${entry.unit}?`,
      async () => {
        if (entry.id) {
          await deleteTravelEntry(entry.id);
          showToast('Travel entry deleted', 'success');
        }
      }
    );
  };

  const handleCloseModal = () => {
    setEditingEntry(null);
  };

  return (
    <>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm text-left text-gray-500 dark:text-gray-400">
          <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
            <tr>
              <th scope="col" className="px-6 py-3">Date</th>
              <th scope="col" className="px-6 py-3">Customer</th>
              <th scope="col" className="px-6 py-3">Project</th>
              <th scope="col" className="px-6 py-3">Distance</th>
              <th scope="col" className="px-6 py-3">Note</th>
              <th scope="col" className="px-6 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {travelEntries.map(entry => {
              const customer = customers.find(c => c.id === entry.customerId || c.firestoreId === entry.customerFirestoreId);
              const project = projects.find(p => p.id === entry.projectId);
              return (
                <tr key={entry.id} className="bg-white border-b dark:bg-gray-800 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
                  <td className="px-6 py-4">{new Date(entry.date).toLocaleDateString()}</td>
                  <td className="px-6 py-4">{customer?.companyName || 'N/A'}</td>
                  <td className="px-6 py-4">{project?.name || 'N/A'}</td>
                  <td className="px-6 py-4">{entry.distance} {entry.unit}</td>
                  <td className="px-6 py-4">{entry.note}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-2">
                      <button onClick={() => handleEdit(entry)} className="text-blue-600 hover:text-blue-900 dark:text-blue-500 dark:hover:text-blue-300">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" />
                          <path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" />
                        </svg>
                      </button>
                      <button onClick={() => handleDelete(entry)} className="text-red-600 hover:text-red-900 dark:text-red-500 dark:hover:text-red-300">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {editingEntry && <EditTravelEntryModal entry={editingEntry} onClose={handleCloseModal} />}
    </>
  );
};

export default TravelLog;

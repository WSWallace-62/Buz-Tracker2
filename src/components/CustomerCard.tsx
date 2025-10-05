import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Customer } from '../db/dexie';
import { db } from '../db/dexie';
import { useCustomersStore } from '../store/customers';
import { useUIStore } from '../store/ui';
import { formatAddressMultiline } from '../utils/customer';
import { formatRate } from '../utils/currency';
import { CustomerProjectManager } from './CustomerProjectManager';

interface CustomerCardProps {
  customer: Customer;
  onEdit: (customer: Customer) => void;
}

export function CustomerCard({ customer, onEdit }: CustomerCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { archiveCustomer, deleteCustomer } = useCustomersStore();
  const { showConfirm, showToast } = useUIStore();

  // Get projects linked to this customer
  const projects = useLiveQuery(
    () => {
      if (!customer.firestoreId) {
        // Fallback to customerId for backward compatibility
        return db.projects.where('customerId').equals(customer.id!).toArray();
      }
      return db.projects.where('customerFirestoreId').equals(customer.firestoreId).toArray();
    },
    [customer.id, customer.firestoreId]
  );

  const projectCount = projects?.length || 0;
  const addressLines = formatAddressMultiline(customer);

  const handleArchive = () => {
    const action = customer.archived ? 'unarchive' : 'archive';
    showConfirm(
      `${action.charAt(0).toUpperCase() + action.slice(1)} Customer`,
      `Are you sure you want to ${action} ${customer.companyName}?`,
      async () => {
        await archiveCustomer(customer.id!, !customer.archived);
        showToast(`Customer ${action}d successfully`, 'success');
      }
    );
  };

  const handleDelete = () => {
    if (projectCount > 0) {
      showToast('Cannot delete customer with linked projects', 'error');
      return;
    }

    showConfirm(
      'Delete Customer',
      `Are you sure you want to delete ${customer.companyName}? This action cannot be undone.`,
      async () => {
        await deleteCustomer(customer.id!);
        showToast('Customer deleted successfully', 'success');
      }
    );
  };

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-md border-l-4 transition-all hover:shadow-lg ${
      customer.archived ? 'border-gray-400 opacity-60' : 'border-blue-500'
    }`}>
      <div className="p-6">
        {/* Header */}
        <div className="flex justify-between items-start mb-4">
          <div className="flex-1">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-1">
              {customer.companyName}
              {customer.archived && (
                <span className="ml-2 text-xs px-2 py-1 bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded">
                  Archived
                </span>
              )}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {addressLines[0] || 'No address'}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <button
              onClick={() => onEdit(customer)}
              className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-md transition-colors"
              title="Edit customer"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>

            <button
              onClick={handleArchive}
              className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-md transition-colors"
              title={customer.archived ? 'Unarchive customer' : 'Archive customer'}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
              </svg>
            </button>

            <button
              onClick={handleDelete}
              className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
              title="Delete customer"
              disabled={projectCount > 0}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>

        {/* Info Badges */}
        <div className="flex flex-wrap gap-2 mb-4">
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300">
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            {customer.contacts.length} {customer.contacts.length === 1 ? 'Contact' : 'Contacts'}
          </span>

          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300">
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
            {projectCount} {projectCount === 1 ? 'Project' : 'Projects'}
          </span>

          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300">
            {formatRate(customer.standardRate, customer.currency)} standard
          </span>

          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300">
            {formatRate(customer.travelRate, customer.currency)} travel
          </span>
        </div>

        {/* Expand/Collapse Button */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-center py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
        >
          {isExpanded ? (
            <>
              <span>Show Less</span>
              <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
              </svg>
            </>
          ) : (
            <>
              <span>Show More</span>
              <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </>
          )}
        </button>

        {/* Expanded Content */}
        {isExpanded && (
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 space-y-4">
            {/* Full Address */}
            <div>
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Address</h4>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                {addressLines.map((line, index) => (
                  <div key={index}>{line}</div>
                ))}
              </div>
            </div>

            {/* Contacts */}
            <div>
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Contacts</h4>
              <div className="space-y-2">
                {customer.contacts.map((contact, index) => (
                  <div key={index} className="text-sm text-gray-600 dark:text-gray-400">
                    <div className="font-medium">{contact.name}</div>
                    {contact.email && (
                      <a 
                        href={`mailto:${contact.email}`}
                        className="text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        {contact.email}
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
            {/* Linked Projects */}
            {customer.firestoreId && (
              <div>
                <CustomerProjectManager
                  customerFirestoreId={customer.firestoreId}
                  customerId={customer.id!}
                  projects={projects || []}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}


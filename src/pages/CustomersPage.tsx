import { useState, useEffect } from 'react';
import { Customer } from '../db/dexie';
import { useCustomersStore } from '../store/customers';
import { CustomerCard } from '../components/CustomerCard';
import { CustomerFormModal } from '../components/CustomerFormModal';

export function CustomersPage() {
  const { customers, isLoading, loadCustomers } = useCustomersStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);

  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  // Split customers by archived status
  const activeCustomers = customers.filter(customer => !customer.archived);
  const archivedCustomers = customers.filter(customer => customer.archived);

  // Apply search filter to active customers
  const filteredActiveCustomers = activeCustomers.filter(customer => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        customer.companyName.toLowerCase().includes(query) ||
        customer.city.toLowerCase().includes(query) ||
        customer.province.toLowerCase().includes(query) ||
        customer.contacts.some(c => c.name.toLowerCase().includes(query))
      );
    }
    return true;
  });

  // Apply search filter to archived customers
  const filteredArchivedCustomers = archivedCustomers.filter(customer => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        customer.companyName.toLowerCase().includes(query) ||
        customer.city.toLowerCase().includes(query) ||
        customer.province.toLowerCase().includes(query) ||
        customer.contacts.some(c => c.name.toLowerCase().includes(query))
      );
    }
    return true;
  });

  const handleAddCustomer = () => {
    setEditingCustomer(null);
    setIsModalOpen(true);
  };

  const handleEditCustomer = (customer: Customer) => {
    setEditingCustomer(customer);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingCustomer(null);
  };

  const activeCustomersCount = customers.filter(c => !c.archived).length;
  const archivedCustomersCount = customers.filter(c => c.archived).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Customers</h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Manage your customer information and rates
          </p>
        </div>
        <button
          onClick={handleAddCustomer}
          className="btn-primary flex items-center justify-center"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Customer
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg className="w-8 h-8 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Active Customers</p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-white">{activeCustomersCount}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="w-8 h-8 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Archived Customers</p>
                <p className="text-2xl font-semibold text-gray-900 dark:text-white">{archivedCustomersCount}</p>
              </div>
            </div>
            {archivedCustomersCount > 0 && (
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showArchived}
                  onChange={(e) => setShowArchived(e.target.checked)}
                  className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600 cursor-pointer"
                />
                <span className="text-sm font-medium text-gray-900 dark:text-white">Show Archived</span>
              </label>
            )}
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <div className="relative">
            <input
              type="text"
              placeholder="Search customers by name, location, or contact..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <svg
              className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex justify-center items-center py-12">
          <div className="spinner w-8 h-8"></div>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && activeCustomers.length === 0 && archivedCustomers.length === 0 && (
        <div className="text-center py-12">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No customers</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Get started by adding your first customer.
          </p>
          <div className="mt-6">
            <button
              onClick={handleAddCustomer}
              className="btn-primary inline-flex items-center"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Customer
            </button>
          </div>
        </div>
      )}

      {/* No Search Results */}
      {!isLoading && filteredActiveCustomers.length === 0 && filteredArchivedCustomers.length === 0 && searchQuery && (
        <div className="text-center py-12">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No results found</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Try adjusting your search query.
          </p>
        </div>
      )}

      {/* Active Customers Section */}
      {!isLoading && filteredActiveCustomers.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Active Customers</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {filteredActiveCustomers.map((customer) => (
              <CustomerCard
                key={customer.id}
                customer={customer}
                onEdit={handleEditCustomer}
              />
            ))}
          </div>
        </div>
      )}

      {/* Archived Customers Section */}
      {!isLoading && archivedCustomers.length > 0 && showArchived && (
        <div className="space-y-4 mt-8">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Archived Customers</h2>

          {filteredArchivedCustomers.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {filteredArchivedCustomers.map((customer) => (
                <CustomerCard
                  key={customer.id}
                  customer={customer}
                  onEdit={handleEditCustomer}
                />
              ))}
            </div>
          )}

          {filteredArchivedCustomers.length === 0 && searchQuery && (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              No archived customers match your search.
            </div>
          )}
        </div>
      )}

      {/* Customer Form Modal */}
      <CustomerFormModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        customer={editingCustomer}
      />
    </div>
  );
}

export default CustomersPage;

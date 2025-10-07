// src/pages/CorporatePage.tsx

import { useState, useEffect } from 'react';
import { useOrganizationStore } from '../store/organization';
import { useAuthStore } from '../store/auth';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { CorporateInfo } from '../db/dexie';

const CANADIAN_PROVINCES = [
  { code: 'AB', name: 'Alberta' },
  { code: 'BC', name: 'British Columbia' },
  { code: 'MB', name: 'Manitoba' },
  { code: 'NB', name: 'New Brunswick' },
  { code: 'NL', name: 'Newfoundland and Labrador' },
  { code: 'NS', name: 'Nova Scotia' },
  { code: 'NT', name: 'Northwest Territories' },
  { code: 'NU', name: 'Nunavut' },
  { code: 'ON', name: 'Ontario' },
  { code: 'PE', name: 'Prince Edward Island' },
  { code: 'QC', name: 'Quebec' },
  { code: 'SK', name: 'Saskatchewan' },
  { code: 'YT', name: 'Yukon' }
];

export function CorporatePage() {
  const { organization, isLoading, error, createOrganization, updateOrganization, loadOrganization } = useOrganizationStore();
  const { user } = useAuthStore();
  const isOnline = useOnlineStatus();
  
  const [formData, setFormData] = useState<CorporateInfo>({
    companyName: '',
    streetAddress: '',
    city: '',
    province: 'BC',
    postalCode: '',
    areaCode: '',
    phone: '',
    email: '',
    gstNumber: '',
    logoUrl: ''
  });

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    loadOrganization();
  }, [loadOrganization]);

  useEffect(() => {
    if (organization?.corporateInfo) {
      setFormData(organization.corporateInfo);
    }
  }, [organization]);

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.companyName.trim()) {
      errors.companyName = 'Company name is required';
    }

    // GST number validation (optional, but if provided, must be valid format)
    if (formData.gstNumber && !/^\d{9}RT\d{4}$/.test(formData.gstNumber)) {
      errors.gstNumber = 'GST number must be in format: 123456789RT0001';
    }

    // Email validation (optional, but if provided, must be valid)
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = 'Please enter a valid email address';
    }

    // Postal code validation (optional, but if provided, must be valid Canadian format)
    if (formData.postalCode && !/^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/.test(formData.postalCode)) {
      errors.postalCode = 'Please enter a valid Canadian postal code (e.g., V9X 1T6)';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleInputChange = (field: keyof CorporateInfo, value: string) => {
    if (!isEditing) return; // ignore changes when not editing
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear validation error for this field when user starts typing
    if (validationErrors[field]) {
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate form
    const isValid = validateForm();
    if (!isValid) {
      return;
    }

    if (!user) {
      alert('You must be logged in to save corporate information');
      return;
    }

    // Check if user is a guest
    if (user.isAnonymous) {
      alert('Guest users cannot save corporate information. Please sign in with a real account.');
      return;
    }

    // Check if online
    if (!isOnline) {
      alert('You must be online to save corporate information to the cloud. Please check your internet connection.');
      return;
    }

    setIsSaving(true);
    setSaveSuccess(false);

    try {
      if (organization) {
        // Update existing organization
        await updateOrganization(formData);
      } else {
        // Create new organization
        await createOrganization(formData);
      }
      
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      setIsEditing(false);
    } catch (error) {
      console.error('Error saving corporate info:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to save corporate information. Please try again.';
      alert(`Failed to save: ${errorMessage}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    if (organization?.corporateInfo) {
      setFormData(organization.corporateInfo);
    } else {
      setFormData({
        companyName: '',
        streetAddress: '',
        city: '',
        province: 'BC',
        postalCode: '',
        areaCode: '',
        phone: '',
        email: '',
        gstNumber: '',
        logoUrl: ''
      });
    }
    setValidationErrors({});
    setIsEditing(false);
  };

  if (isLoading) {
    return (
      <div className="space-y-8">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Corporate Information</h2>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Corporate Information</h2>
        {organization && (
          <span className="text-sm text-gray-500 dark:text-gray-400">
            Last updated: {new Date(organization.updatedAt).toLocaleDateString()}
          </span>
        )}
      </div>

      {!isOnline && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <div className="flex items-center">
            <svg className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <p className="text-yellow-800 dark:text-yellow-200">You are currently offline. You must be online to save corporate information.</p>
          </div>
        </div>
      )}

      {user?.isAnonymous && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="flex items-center">
            <svg className="w-5 h-5 text-blue-600 dark:text-blue-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-blue-800 dark:text-blue-200">Guest users cannot save corporate information. Please sign in with a real account.</p>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      {saveSuccess && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
          <p className="text-green-800 dark:text-green-200">Corporate information saved successfully!</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <div className="space-y-6">
          {/* Company Name */}
          <div>
            <label htmlFor="companyName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Company Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="companyName"
              value={formData.companyName}
              onChange={(e) => handleInputChange('companyName', e.target.value)}
              disabled={!isEditing}
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
                validationErrors.companyName ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="Your Company Inc."
            />
            {validationErrors.companyName && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{validationErrors.companyName}</p>
            )}
          </div>

          {/* Street Address */}
          <div>
            <label htmlFor="streetAddress" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Street Address
            </label>
            <input
              type="text"
              id="streetAddress"
              value={formData.streetAddress}
              onChange={(e) => handleInputChange('streetAddress', e.target.value)}
              disabled={!isEditing}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              placeholder="123 Main Street"
            />
          </div>

          {/* City, Province, Postal Code Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label htmlFor="city" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                City
              </label>
              <input
                type="text"
                id="city"
                value={formData.city}
                onChange={(e) => handleInputChange('city', e.target.value)}
                disabled={!isEditing}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                placeholder="Vancouver"
              />
            </div>

            <div>
              <label htmlFor="province" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Province
              </label>
              <select
                id="province"
                value={formData.province}
                onChange={(e) => handleInputChange('province', e.target.value)}
                disabled={!isEditing}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              >
                {CANADIAN_PROVINCES.map(prov => (
                  <option key={prov.code} value={prov.code}>{prov.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="postalCode" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Postal Code
              </label>
              <input
                type="text"
                id="postalCode"
                value={formData.postalCode}
                onChange={(e) => handleInputChange('postalCode', e.target.value.toUpperCase())}
                disabled={!isEditing}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
                  validationErrors.postalCode ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="V9X 1T6"
                maxLength={7}
              />
              {validationErrors.postalCode && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{validationErrors.postalCode}</p>
              )}
            </div>
          </div>

          {/* Phone Number Row */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label htmlFor="areaCode" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Area Code
              </label>
              <input
                type="text"
                id="areaCode"
                value={formData.areaCode}
                onChange={(e) => handleInputChange('areaCode', e.target.value.replace(/\D/g, ''))}
                disabled={!isEditing}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                placeholder="250"
                maxLength={3}
              />
            </div>

            <div className="md:col-span-3">
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Phone Number
              </label>
              <input
                type="text"
                id="phone"
                value={formData.phone}
                onChange={(e) => handleInputChange('phone', e.target.value.replace(/\D/g, ''))}
                disabled={!isEditing}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                placeholder="5551234"
                maxLength={7}
              />
            </div>
          </div>

          {/* Email */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Email
            </label>
            <input
              type="email"
              id="email"
              value={formData.email}
              onChange={(e) => handleInputChange('email', e.target.value)}
              disabled={!isEditing}
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
                validationErrors.email ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="contact@yourcompany.com"
            />
            {validationErrors.email && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{validationErrors.email}</p>
            )}
          </div>

          {/* GST Number */}
          <div>
            <label htmlFor="gstNumber" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              GST Number
            </label>
            <input
              type="text"
              id="gstNumber"
              value={formData.gstNumber}
              onChange={(e) => handleInputChange('gstNumber', e.target.value.toUpperCase())}
              disabled={!isEditing}
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
                validationErrors.gstNumber ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="123456789RT0001"
              maxLength={15}
            />
            {validationErrors.gstNumber && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{validationErrors.gstNumber}</p>
            )}
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Format: 9 digits + RT + 4 digits</p>
          </div>

          {/* Logo URL */}
          <div>
            <label htmlFor="logoUrl" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Logo URL
            </label>
            <input
              type="url"
              id="logoUrl"
              value={formData.logoUrl}
              onChange={(e) => handleInputChange('logoUrl', e.target.value)}
              disabled={!isEditing}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              placeholder="https://example.com/logo.png"
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Enter a URL to your company logo</p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end space-x-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            {!isEditing ? (
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                disabled={user?.isAnonymous || !isOnline}
                title={user?.isAnonymous ? 'Guest users cannot edit corporate info' : (!isOnline ? 'You must be online to edit corporate info' : undefined)}
              >
                Enable Editing
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={isSaving}
                  className="px-6 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                >
                  {isSaving ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>{organization ? 'Update' : 'Create'} Corporate Info</span>
                  )}
                </button>
              </>
            )}
          </div>
        </div>
      </form>

      {/* Info Card */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-2">About Corporate Information</h3>
        <div className="text-blue-800 dark:text-blue-200 space-y-2 text-sm">
          <p>This information will be used for generating invoices and official documents.</p>
          <p>All data is stored securely both locally and in the cloud, and syncs automatically when you're online.</p>
          <p>Only the company name is required - you can fill in other details as needed.</p>
        </div>
      </div>
    </div>
  );
}

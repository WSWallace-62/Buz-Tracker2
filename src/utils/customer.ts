// src/utils/customer.ts

import { Customer } from '../db/dexie';

// Format customer address as a single line
export function formatAddress(customer: Customer): string {
  const parts = [
    customer.address,
    customer.city,
    customer.province,
    customer.postalCode,
    customer.country
  ].filter(Boolean);
  
  return parts.join(', ');
}

// Format customer address as multiple lines (for display)
export function formatAddressMultiline(customer: Customer): string[] {
  const lines: string[] = [];
  
  if (customer.address) {
    lines.push(customer.address);
  }
  
  const cityLine = [customer.city, customer.province, customer.postalCode]
    .filter(Boolean)
    .join(', ');
  
  if (cityLine) {
    lines.push(cityLine);
  }
  
  if (customer.country) {
    lines.push(customer.country);
  }
  
  return lines;
}

// Get customer display name (company name)
export function getCustomerDisplayName(customer: Customer | null | undefined): string {
  return customer?.companyName || 'Unknown Customer';
}

// Get primary contact name
export function getPrimaryContact(customer: Customer): string {
  if (customer.contacts && customer.contacts.length > 0) {
    return customer.contacts[0].name;
  }
  return 'No contact';
}

// Get all contact names as comma-separated string
export function getContactNames(customer: Customer): string {
  if (!customer.contacts || customer.contacts.length === 0) {
    return 'No contacts';
  }
  return customer.contacts.map(c => c.name).join(', ');
}

// Validate email format
export function isValidEmail(email: string): boolean {
  if (!email) return true; // Empty email is valid (optional)
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Validate postal code (basic validation for common formats)
export function isValidPostalCode(postalCode: string, country: string): boolean {
  if (!postalCode) return true; // Optional field
  
  // Canadian postal code: A1A 1A1
  if (country === 'Canada') {
    const canadaRegex = /^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/;
    return canadaRegex.test(postalCode);
  }
  
  // US ZIP code: 12345 or 12345-6789
  if (country === 'United States' || country === 'USA') {
    const usRegex = /^\d{5}(-\d{4})?$/;
    return usRegex.test(postalCode);
  }
  
  // For other countries, just check it's not empty if provided
  return postalCode.length > 0;
}

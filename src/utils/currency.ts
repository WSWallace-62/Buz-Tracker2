// src/utils/currency.ts

export interface CurrencyOption {
  code: string;
  name: string;
  symbol: string;
}

// G7 currencies plus commonly used ones
export const CURRENCIES: CurrencyOption[] = [
  { code: 'CAD', name: 'Canadian Dollar', symbol: '$' },
  { code: 'USD', name: 'US Dollar', symbol: '$' },
  { code: 'EUR', name: 'Euro', symbol: '€' },
  { code: 'GBP', name: 'British Pound', symbol: '£' },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥' },
  { code: 'CHF', name: 'Swiss Franc', symbol: 'CHF' },
  { code: 'AUD', name: 'Australian Dollar', symbol: '$' },
];

// Get currency symbol by code
export function getCurrencySymbol(code: string): string {
  const currency = CURRENCIES.find(c => c.code === code);
  return currency?.symbol || '$';
}

// Format amount with currency
export function formatCurrency(amount: number, currencyCode: string): string {
  const symbol = getCurrencySymbol(currencyCode);
  
  // Special handling for JPY (no decimals)
  if (currencyCode === 'JPY') {
    return `${symbol}${Math.round(amount).toLocaleString()}`;
  }
  
  // For currencies with $ symbol, show which one if not CAD
  if (symbol === '$' && currencyCode !== 'CAD') {
    return `${amount.toFixed(2)} ${currencyCode}`;
  }
  
  return `${symbol}${amount.toFixed(2)}`;
}

// Format rate for display (e.g., "$90/hr")
export function formatRate(rate: number, currencyCode: string): string {
  return `${formatCurrency(rate, currencyCode)}/hr`;
}

 // src/pages/FAQPage.tsx

import { useState } from 'react';

interface FAQItem {
  id: string;
  question: string;
  answer: string | JSX.Element;
}

const faqData: FAQItem[] = [
  {
    id: 'archive-customer',
    question: 'How does archiving customers and projects work?',
    answer: (
      <div className="space-y-4">
        <p>
          Archiving allows you to hide customers and projects from your active lists without permanently deleting them.
          This is useful for completed projects or inactive customers that you may need to reference later.
        </p>

        <div className="mt-4">
          <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Archiving a Customer:</h4>
          <ul className="list-disc list-inside space-y-2 ml-4 text-gray-600 dark:text-gray-400">
            <li>Click the archive icon on the customer card</li>
            <li>If the customer has linked projects, you'll be warned that all projects will become inactive</li>
            <li>Archived customers become read-only - you can only unarchive them</li>
            <li>All linked projects are automatically removed from active project lists</li>
          </ul>
        </div>

        <div className="mt-4">
          <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Archiving a Project:</h4>
          <ul className="list-disc list-inside space-y-2 ml-4 text-gray-600 dark:text-gray-400">
            <li>Click the archive icon on the project (in customer card or project manager)</li>
            <li>Archived projects are removed from the project dropdown selector</li>
            <li>Time sessions for archived projects are hidden from the History page</li>
            <li>You can still view archived projects in the customer card</li>
          </ul>
        </div>

        <div className="mt-4">
          <h4 className="font-semibold text-gray-900 dark:text-white mb-2">What happens to time sessions?</h4>
          <p className="text-gray-600 dark:text-gray-400">
            Time sessions for archived projects are completely hidden from:
          </p>
          <ul className="list-disc list-inside space-y-2 ml-4 text-gray-600 dark:text-gray-400">
            <li>Today's sessions list</li>
            <li>History page and charts</li>
            <li>Project dropdown selector</li>
          </ul>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Sessions are not deleted - they become accessible again when you unarchive the project or customer.
          </p>
        </div>

        <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/20 border-l-4 border-green-400 dark:border-green-600">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-green-400 dark:text-green-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-green-700 dark:text-green-300">
                <strong>Tip:</strong> Archiving is reversible! You can unarchive customers and projects at any time
                to restore full access to them and their time sessions.
              </p>
            </div>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: 'delete-customer',
    question: 'How do I delete a customer?',
    answer: (
      <div className="space-y-4">
        <p>To delete a customer from BuzTracker, follow these steps:</p>
        <ol className="list-decimal list-inside space-y-3 ml-4">
          <li>
            <strong>Navigate to the Customers page</strong>
            <p className="ml-6 mt-1 text-gray-600 dark:text-gray-400">
              Click on the "Customers" tab in the main navigation menu.
            </p>
          </li>
          <li>
            <strong>Ensure the customer has no active projects</strong>
            <p className="ml-6 mt-1 text-gray-600 dark:text-gray-400">
              The delete button will only appear if the customer has no projects associated with them.
              If you see projects listed under the customer, you must first delete all projects before
              you can delete the customer.
            </p>
          </li>
          <li>
            <strong>Click the delete button</strong>
            <p className="ml-6 mt-1 text-gray-600 dark:text-gray-400">
              Once all projects are removed, a red trash icon will appear in the customer card's action buttons.
              Click this icon to initiate the deletion process.
            </p>
          </li>
          <li>
            <strong>Confirm the deletion</strong>
            <p className="ml-6 mt-1 text-gray-600 dark:text-gray-400">
              A confirmation dialog will appear asking you to confirm the deletion.
              Click "Confirm" to permanently delete the customer.
            </p>
          </li>
        </ol>
        <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-400 dark:border-yellow-600">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400 dark:text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-yellow-700 dark:text-yellow-300">
                <strong>Important:</strong> Deleting a customer is permanent and cannot be undone.
                Make sure you have exported any data you need before deleting.
              </p>
            </div>
          </div>
        </div>
        <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-400 dark:border-blue-600">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-blue-400 dark:text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-blue-700 dark:text-blue-300">
                <strong>Tip:</strong> If you want to keep the customer data but hide them from your active list,
                consider using the "Archive" feature instead of deleting. Archived customers can be restored later.
              </p>
            </div>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: 'delete-project',
    question: 'How do I delete a project?',
    answer: (
      <div className="space-y-4">
        <p>To delete a project from BuzTracker, follow these steps:</p>
        <ol className="list-decimal list-inside space-y-3 ml-4">
          <li>
            <strong>Navigate to the project location</strong>
            <p className="ml-6 mt-1 text-gray-600 dark:text-gray-400">
              You can delete a project from either the Customers page (if the project is linked to a customer)
              or from the Project Manager modal.
            </p>
          </li>
          <li>
            <strong>Click the delete button</strong>
            <p className="ml-6 mt-1 text-gray-600 dark:text-gray-400">
              Find the project you want to delete and click the red trash icon.
            </p>
          </li>
          <li>
            <strong>Type the confirmation text</strong>
            <p className="ml-6 mt-1 text-gray-600 dark:text-gray-400">
              A confirmation dialog will appear. You must type <code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-sm">Delete-ProjectName</code>
              {' '}(replacing "ProjectName" with the actual project name) to enable the confirm button.
            </p>
          </li>
          <li>
            <strong>Confirm the deletion</strong>
            <p className="ml-6 mt-1 text-gray-600 dark:text-gray-400">
              Once you've typed the correct confirmation text, click "Confirm" to permanently delete the project
              and all associated time sessions.
            </p>
          </li>
        </ol>
        <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border-l-4 border-red-400 dark:border-red-600">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400 dark:text-red-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700 dark:text-red-300">
                <strong>Warning:</strong> Deleting a project will also delete all time sessions associated with it.
                This action cannot be undone. Make sure to export your data before deleting if you need to keep records.
              </p>
            </div>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: 'offline-mode',
    question: 'Does BuzTracker work offline?',
    answer: (
      <div className="space-y-4">
        <p>
          Yes! BuzTracker is designed as a local-first Progressive Web App (PWA) that works completely offline.
          All your data is stored locally in your browser using IndexedDB.
        </p>
        <p className="text-gray-600 dark:text-gray-400">
          You can track time, create projects, add sessions, and manage customers even without an internet connection.
          Your data will be automatically synced when you reconnect to the internet (if you're logged in with a Firebase account).
        </p>
      </div>
    ),
  },
  {
    id: 'export-data',
    question: 'How do I export my data?',
    answer: (
      <div className="space-y-4">
        <p>To export your data from BuzTracker:</p>
        <ol className="list-decimal list-inside space-y-2 ml-4">
          <li>Navigate to the <strong>Settings</strong> page</li>
          <li>Find the <strong>Import/Export Data</strong> section</li>
          <li>Click the <strong>Export Data</strong> button</li>
          <li>Your data will be downloaded as a CSV file that you can open in Excel or other spreadsheet applications</li>
        </ol>
        <p className="text-gray-600 dark:text-gray-400 mt-4">
          The exported file includes all your time sessions with project information, dates, durations, and notes.
        </p>
      </div>
    ),
  },
];

export function FAQPage() {
  const [expandedId, setExpandedId] = useState<string | null>('archive-customer');

  const toggleFAQ = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Frequently Asked Questions
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Find answers to common questions about using BuzTracker
        </p>
      </div>

      <div className="space-y-4">
        {faqData.map((faq) => (
          <div
            key={faq.id}
            className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden transition-all"
          >
            <button
              onClick={() => toggleFAQ(faq.id)}
              className="w-full px-6 py-4 text-left flex justify-between items-center hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              aria-expanded={expandedId === faq.id}
              aria-controls={`faq-answer-${faq.id}`}
            >
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white pr-4">
                {faq.question}
              </h3>
              <svg
                className={`w-6 h-6 text-gray-500 dark:text-gray-400 flex-shrink-0 transition-transform ${
                  expandedId === faq.id ? 'transform rotate-180' : ''
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>
            {expandedId === faq.id && (
              <div
                id={`faq-answer-${faq.id}`}
                className="px-6 pb-6 text-gray-700 dark:text-gray-300"
              >
                {typeof faq.answer === 'string' ? (
                  <p>{faq.answer}</p>
                ) : (
                  faq.answer
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-6 border border-blue-200 dark:border-blue-800">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          Still have questions?
        </h3>
        <p className="text-gray-600 dark:text-gray-400">
          If you couldn't find the answer you're looking for, please check the Settings page for more
          information about BuzTracker, or refer to the keyboard shortcuts section for productivity tips.
        </p>
      </div>
    </div>
  );
}

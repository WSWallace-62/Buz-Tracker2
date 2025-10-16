import React, { useState, useEffect } from 'react';
import { SessionsTable } from './SessionsTable';
import TravelLog from './TravelLog';
import { useUIStore } from '../store/ui';
import { useSessionsStore } from '../store/sessions';
import { useTravelEntriesStore } from '../store/travelEntries';
import { startOfDay, endOfDay } from '../utils/time';

const TodaysActivity: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'time' | 'travel'>('time');
  const { currentProjectId } = useUIStore();
  const { sessions, loadSessions } = useSessionsStore();
  const { travelEntries, loadTravelEntries } = useTravelEntriesStore();

  useEffect(() => {
    if (currentProjectId !== null) {
      const todayStart = startOfDay(Date.now());
      const todayEnd = endOfDay(Date.now());
      loadSessions({ startDate: todayStart, endDate: todayEnd, projectIds: [currentProjectId] });
      loadTravelEntries({ startDate: todayStart, endDate: todayEnd, projectIds: [currentProjectId] });
    }
  }, [currentProjectId, loadSessions, loadTravelEntries]);

  if (currentProjectId === null) {
    return (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mt-4 text-center text-gray-500 dark:text-gray-400">
            <p>Please select a project to see today's activity.</p>
        </div>
    );
  }

  const todayStart = startOfDay(Date.now());
  const todayEnd = endOfDay(Date.now());
  const todaysSessions = sessions.filter(s => s.start >= todayStart && s.start <= todayEnd);
  const todaysTravel = travelEntries.filter(t => t.date >= todayStart && t.date <= todayEnd);

  return (
    <div className="mt-4">
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          <button
            onClick={() => setActiveTab('time')}
            className={`${
              activeTab === 'time'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
          >
            Time Log
          </button>
          <button
            onClick={() => setActiveTab('travel')}
            className={`${
              activeTab === 'travel'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
          >
            Travel Log
          </button>
        </nav>
      </div>
      <div className="mt-4">
        {activeTab === 'time' && (
          <SessionsTable
            sessions={todaysSessions}
            showAllProjects={false}
            title="Today's Time Entries"
          />
        )}
        {activeTab === 'travel' && (
          <TravelLog sessions={todaysTravel} />
        )}
      </div>
    </div>
  );
};

export default TodaysActivity;

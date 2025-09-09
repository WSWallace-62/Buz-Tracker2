// src/components/SessionsReport.tsx

import { Session, Project } from '../db/dexie';
import { formatDurationHours, formatDate, getTotalDuration } from '../utils/time';

interface SessionsReportProps {
  project: Project | null;
  sessions: Session[];
  dateRange: { start: string; end: string };
  logoUrl?: string; // Optional: For your business logo
}

export function SessionsReport({ project, sessions, dateRange, logoUrl }: SessionsReportProps) {
  // Calculate total duration in milliseconds
  const totalMs = getTotalDuration(sessions);
  // Convert total duration to hours for display
  const totalHours = parseFloat(formatDurationHours(totalMs)).toFixed(2);

  return (
    <div className="bg-white p-8 font-sans text-gray-800">
      {/* Report Header */}
      <header className="flex justify-between items-start mb-8 border-b pb-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Time Log Report
          </h1>
          <p className="text-gray-600">
            {project ? project.name : 'All Projects'}
          </p>
          <p className="text-sm text-gray-500 mt-1">
            {formatDate(new Date(dateRange.start).getTime())} to {formatDate(new Date(dateRange.end).getTime())}
          </p>
        </div>
        {logoUrl && (
          <div className="w-32 h-auto">
            <img src={logoUrl} alt="Company Logo" />
          </div>
        )}
      </header>

      {/* Sessions Table */}
      <main>
        <table className="w-full text-left border-collapse">
          <thead>
            <tr>
              <th className="border-b-2 border-gray-300 py-2 px-3 bg-gray-100 font-bold uppercase text-sm text-gray-600">
                Date
              </th>
              <th className="border-b-2 border-gray-300 py-2 px-3 bg-gray-100 font-bold uppercase text-sm text-gray-600 text-right">
                Duration (Hours)
              </th>
              <th className="border-b-2 border-gray-300 py-2 px-3 bg-gray-100 font-bold uppercase text-sm text-gray-600">
                Project
              </th>
              <th className="border-b-2 border-gray-300 py-2 px-3 bg-gray-100 font-bold uppercase text-sm text-gray-600">
                Note
              </th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((session) => (
              <tr key={session.id} className="hover:bg-gray-50">
                <td className="border-b border-gray-200 py-2 px-3">
                  {formatDate(session.start)}
                </td>
                <td className="border-b border-gray-200 py-2 px-3 text-right">
                  {formatDurationHours(session.durationMs)}
                </td>
                <td className="border-b border-gray-200 py-2 px-3">
                   {project ? project.name : 'Project Name'}
                </td>
                <td className="border-b border-gray-200 py-2 px-3">
                  {session.note || '-'}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={1} className="py-3 px-3 text-right font-bold uppercase text-gray-700">
                Total
              </td>
              <td className="py-3 px-3 text-right font-bold text-gray-900 border-t-2 border-gray-300">
                {totalHours}
              </td>
              <td colSpan={2} className="border-t-2 border-gray-300"></td>
            </tr>
          </tfoot>
        </table>
      </main>
    </div>
  );
}

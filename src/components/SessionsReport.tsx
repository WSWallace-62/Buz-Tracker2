
import { Session, Project } from '../db/dexie';
import { formatDurationHours, formatDate, getTotalDuration } from '../utils/time';

interface SessionsReportProps {
  project: Project | null;
  sessions: Session[];
  dateRange: { start: string; end: string };
  logoUrl?: string; // Optional: For your business logo
  projects: Project[];
}

export function SessionsReport({ project, sessions, dateRange, logoUrl, projects }: SessionsReportProps) {
  // Separate sessions into regular and travel sessions
  const regularSessions = sessions.filter(session => 
    !session.note?.toLowerCase().includes('travel')
  );
  
  const travelSessions = sessions.filter(session => 
    session.note?.toLowerCase().includes('travel')
  );

  // Calculate total duration for regular sessions
  const regularTotalMs = getTotalDuration(regularSessions);
  const regularTotalHours = parseFloat(formatDurationHours(regularTotalMs)).toFixed(2);

  // Calculate total duration for travel sessions
  const travelTotalMs = getTotalDuration(travelSessions);
  const travelTotalHours = parseFloat(formatDurationHours(travelTotalMs)).toFixed(2);

  const getProjectName = (projectId: number) => {
    const project = projects.find(p => p.id === projectId);
    return project?.name || 'Unknown Project';
  };

  return (
    <div className="bg-white p-6 font-sans text-gray-800 text-xs">
      {/* Report Header */}
      <header className="flex justify-between items-start mb-6 border-b pb-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Time Log Report
          </h1>
          <p className="text-sm text-gray-600">
            {project ? project.name : 'All Projects'}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {formatDate(new Date(dateRange.start).getTime())} to {formatDate(new Date(dateRange.end).getTime())}
          </p>
        </div>
        {logoUrl && (
          <div className="w-24 h-auto">
            <img src={logoUrl} alt="Company Logo" />
          </div>
        )}
      </header>

      {/* Regular Sessions Table */}
      <main>
        <table className="w-full text-left border-collapse">
          <thead>
            <tr>
              <th className="min-w-32 border-b-2 border-gray-300 py-2 px-3 bg-gray-100 font-bold uppercase text-xs text-gray-600">
                Date
              </th>
              <th className="border-b-2 border-gray-300 py-2 px-3 bg-gray-100 font-bold uppercase text-xs text-gray-600 text-center">
                Hrs
              </th>
              <th className="border-b-2 border-gray-300 py-2 px-3 bg-gray-100 font-bold uppercase text-xs text-gray-600">
                Project
              </th>
              <th className="border-b-2 border-gray-300 py-2 px-3 bg-gray-100 font-bold uppercase text-xs text-gray-600">
                Note
              </th>
            </tr>
          </thead>
          <tbody>
            {regularSessions.map((session) => (
              <tr key={session.id} className="hover:bg-gray-50 whitespace-nowrap">
                <td className="border-b border-gray-200 py-2 px-3">
                  {formatDate(session.start)}
                </td>
                <td className="border-b border-gray-200 py-2 px-3 text-center">
                  {formatDurationHours(session.durationMs)}
                </td>
                <td className="border-b border-gray-200 py-2 px-3">
                   {getProjectName(session.projectId)}
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
              <td className="py-3 px-3 text-center font-bold text-gray-900 border-t-2 border-gray-300">
                {regularTotalHours}
              </td>
              <td colSpan={2} className="border-t-2 border-gray-300"></td>
            </tr>
          </tfoot>
        </table>

        {/* Travel Sessions Table - Only show if there are travel sessions */}
        {travelSessions.length > 0 && (
          <div className="mt-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              Travel Sessions
            </h2>
            <table className="w-full text-left border-collapse">
              <thead>
                <tr>
                  <th className="min-w-32 border-b-2 border-gray-300 py-2 px-3 bg-gray-100 font-bold uppercase text-xs text-gray-600">
                    Date
                  </th>
                  <th className="border-b-2 border-gray-300 py-2 px-3 bg-gray-100 font-bold uppercase text-xs text-gray-600 text-center">
                    Hrs
                  </th>
                  <th className="border-b-2 border-gray-300 py-2 px-3 bg-gray-100 font-bold uppercase text-xs text-gray-600">
                    Project
                  </th>
                  <th className="border-b-2 border-gray-300 py-2 px-3 bg-gray-100 font-bold uppercase text-xs text-gray-600">
                    Note
                  </th>
                </tr>
              </thead>
              <tbody>
                {travelSessions.map((session) => (
                  <tr key={session.id} className="hover:bg-gray-50 whitespace-nowrap">
                    <td className="border-b border-gray-200 py-2 px-3">
                      {formatDate(session.start)}
                    </td>
                    <td className="border-b border-gray-200 py-2 px-3 text-center">
                      {formatDurationHours(session.durationMs)}
                    </td>
                    <td className="border-b border-gray-200 py-2 px-3">
                       {getProjectName(session.projectId)}
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
                    Travel Total
                  </td>
                  <td className="py-3 px-3 text-center font-bold text-gray-900 border-t-2 border-gray-300">
                    {travelTotalHours}
                  </td>
                  <td colSpan={2} className="border-t-2 border-gray-300"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
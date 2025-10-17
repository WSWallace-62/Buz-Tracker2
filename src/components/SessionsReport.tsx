import { useEffect, useMemo, useState } from 'react';
import { Session, Project, TravelEntry } from '../db/dexie';
import { formatDurationHours, formatDate, getTotalDuration } from '../utils/time';
import { useCustomersStore } from '../store/customers';
import { useOrganizationStore } from '../store/organization';
import { auth, db as firestoreDB } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';

interface SessionsReportProps {
  project: Project | null;
  sessions: Session[];
  travelEntries?: TravelEntry[];
  dateRange: { start: string; end: string };
  logoUrl?: string; // Optional: For your business logo
  projects: Project[];
  theme?: 'light' | 'dark'; // Add theme prop
}

export function SessionsReport({ project, sessions, travelEntries = [], dateRange, logoUrl, projects, theme = 'light' }: SessionsReportProps) {
  // Stores
  const { customers } = useCustomersStore();
  const { organization } = useOrganizationStore();

  // Resolve organization/company name
  const organizationName = organization?.corporateInfo?.companyName || '';

  // Resolve user name from Firestore users doc; fallback to auth displayName/email
  const [userName, setUserName] = useState<string>('');
  useEffect(() => {
    let didCancel = false;
    const loadName = async () => {
      const user = auth?.currentUser;
      if (!user) {
        setUserName('');
        return;
      }

      // Try Firestore first (firstName + lastName)
      try {
        if (firestoreDB) {
          const snap = await getDoc(doc(firestoreDB, 'users', user.uid));
          const data = snap.exists() ? snap.data() as any : null;
          const first = data?.firstName?.toString().trim();
          const last = data?.lastName?.toString().trim();
          const composed = [first, last].filter(Boolean).join(' ');
          if (!didCancel && composed) {
            setUserName(composed);
            return;
          }
        }
      } catch {
        // ignore and fall back
      }

      // Fallbacks
      const byDisplay = user.displayName?.trim();
      if (!didCancel && byDisplay) {
        setUserName(byDisplay);
        return;
      }
      const byEmail = user.email ? user.email.split('@')[0] : '';
      if (!didCancel) setUserName(byEmail);
    };
    loadName();
    return () => { didCancel = true; };
  }, []);

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

  // Group travel entries by unit and calculate totals
  const distanceTotals = useMemo(() => {
    console.log('📊 Calculating distanceTotals from travelEntries:', travelEntries);
    const totals = travelEntries.reduce((acc, entry) => {
      const unit = entry.unit || 'km';
      if (!acc[unit]) {
        acc[unit] = 0;
      }
      acc[unit] += entry.distance;
      return acc;
    }, {} as Record<string, number>);
    console.log('📊 Distance totals:', totals);
    return totals;
  }, [travelEntries]);

  const getProjectName = (projectId: number | string) => {
    const project = projects.find(p => p.id === projectId || p.firestoreId === projectId);
    return project?.name || 'Unknown Project';
  };

  // Resolve the customer for the provided project (handles both firestoreId and local id links)
  const customerNameForSelectedProject = useMemo(() => {
    if (!project) return '';
    if (project.customerFirestoreId) {
      const c = customers.find(cu => cu.firestoreId === project.customerFirestoreId);
      return c?.companyName || '';
    }
    if (project.customerId) {
      const c = customers.find(cu => cu.id === project.customerId);
      return c?.companyName || '';
    }
    return '';
  }, [project, customers]);

  // Build a robust list of potential logo sources and fallback if one fails
  const candidateLogoUrls = useMemo(() => {
    const list: string[] = [];
    if (organization?.corporateInfo?.logoUrl) list.push(organization.corporateInfo.logoUrl);
    if (logoUrl) list.push(logoUrl);
    // Common public paths fallbacks
    list.push('/company-logo.png', '/company-logo.jpg', '/company-logo.webp', '/company-logo.png.jpg');
    // Deduplicate while preserving order
    return Array.from(new Set(list.filter(Boolean)));
  }, [organization?.corporateInfo?.logoUrl, logoUrl]);

  const [logoSrc, setLogoSrc] = useState<string | null>(null);
  useEffect(() => {
    setLogoSrc(candidateLogoUrls.length > 0 ? candidateLogoUrls[0] : null);
  }, [candidateLogoUrls]);

  const handleLogoError = () => {
    if (!logoSrc) return;
    const idx = candidateLogoUrls.indexOf(logoSrc);
    if (idx >= 0 && idx < candidateLogoUrls.length - 1) {
      setLogoSrc(candidateLogoUrls[idx + 1]);
    } else {
      setLogoSrc(null);
    }
  };

  // Define theme-based classes
  const isDark = theme === 'dark';
  const bgClass = isDark ? 'bg-gray-900' : 'bg-white';
  const textClass = isDark ? 'text-gray-100' : 'text-gray-800';
  const headerTextClass = isDark ? 'text-gray-50' : 'text-gray-900';
  const subTextClass = isDark ? 'text-gray-300' : 'text-gray-600';
  const mutedTextClass = isDark ? 'text-gray-400' : 'text-gray-500';
  const borderClass = isDark ? 'border-gray-700' : 'border-gray-300';
  const borderLightClass = isDark ? 'border-gray-800' : 'border-gray-200';
  const tableHeaderBgClass = isDark ? 'bg-gray-800' : 'bg-gray-100';
  const tableHeaderTextClass = isDark ? 'text-gray-300' : 'text-gray-600';
  const hoverBgClass = isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-50';
  const footerTextClass = isDark ? 'text-gray-200' : 'text-gray-700';
  const totalTextClass = isDark ? 'text-gray-50' : 'text-gray-900';
  const placeholderBorderClass = isDark ? 'border-gray-400' : 'border-gray-500';

  return (
    <div className={`${bgClass} p-6 font-sans ${textClass} text-xs print:bg-white print:text-gray-800`}>
      {/* Report Header */}
      <header className={`mb-6 border-b ${borderClass} pb-3 print:border-gray-300`}>
        <div>
          {/* Logo above organization name */}
          <div className="w-32 h-32 mb-2 flex items-center justify-start">
            { logoSrc ? (
              <img
                src={logoSrc}
                onError={handleLogoError}
                alt=""
                role="presentation"
                className="max-w-full max-h-full object-contain"
              />
            ) : (
              <div
                className={`w-full h-full border-2 border-dashed ${placeholderBorderClass} rounded-sm print:border-gray-300`}
                aria-hidden="true"
              />
            )}
          </div>
          {/* Organization and User lines */}
          {organizationName && (
            <p className={`text-sm ${subTextClass} print:text-gray-600`}>{organizationName}</p>
          )}
          {userName && (
            <p className={`text-xs ${mutedTextClass} print:text-gray-500`}>{userName}</p>
          )}
          <h1 className={`text-2xl font-bold ${headerTextClass} print:text-gray-900 mt-6`}>
            Time Log Report
          </h1>
          <p className={`text-sm ${subTextClass} print:text-gray-600`}>
            {project ? (
              customerNameForSelectedProject
                ? `${project.name} • for ${customerNameForSelectedProject}`
                : project.name
            ) : 'All Projects'}
          </p>
          <p className={`text-xs ${mutedTextClass} mt-1 print:text-gray-500`}>
            {formatDate(new Date(dateRange.start).getTime())} to {formatDate(new Date(dateRange.end).getTime())}
          </p>
        </div>
      </header>

      {/* Summary Section */}
      <div className={`mb-6 p-4 ${bgClass} border ${borderClass} rounded-lg print:border-gray-300`}>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className={`text-sm font-semibold ${subTextClass} print:text-gray-600`}>Regular Hours</p>
            <p className={`text-2xl font-bold ${headerTextClass} print:text-gray-900`}>{regularTotalHours}</p>
          </div>
          {travelSessions.length > 0 && (
            <div>
              <p className={`text-sm font-semibold ${subTextClass} print:text-gray-600`}>Travel Hours</p>
              <p className={`text-2xl font-bold ${headerTextClass} print:text-gray-900`}>{travelTotalHours}</p>
            </div>
          )}
        </div>
        {Object.keys(distanceTotals).length > 0 && (
          <div className={`mt-3 pt-3 border-t ${borderLightClass} print:border-gray-200`}>
            <p className={`text-sm font-semibold ${subTextClass} mb-2 print:text-gray-600`}>Travel Distance</p>
            <div className="flex gap-4 flex-wrap">
              {Object.entries(distanceTotals).map(([unit, total]) => (
                <div key={unit}>
                  <span className={`text-xl font-bold ${headerTextClass} print:text-gray-900`}>
                    {total.toFixed(1)} {unit}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Regular Sessions Table */}
      <main>
        <table className="w-full text-left border-collapse">
          <thead>
            <tr>
              <th className={`min-w-32 border-b-2 ${borderClass} py-2 px-3 ${tableHeaderBgClass} font-bold uppercase text-xs ${tableHeaderTextClass} print:bg-gray-100 print:text-gray-600 print:border-gray-300`}>
                Date
              </th>
              <th className={`border-b-2 ${borderClass} py-2 px-3 ${tableHeaderBgClass} font-bold uppercase text-xs ${tableHeaderTextClass} text-center print:bg-gray-100 print:text-gray-600 print:border-gray-300`}>
                Hrs
              </th>
              <th className={`border-b-2 ${borderClass} py-2 px-3 ${tableHeaderBgClass} font-bold uppercase text-xs ${tableHeaderTextClass} print:bg-gray-100 print:text-gray-600 print:border-gray-300`}>
                Project
              </th>
              <th className={`border-b-2 ${borderClass} py-2 px-3 ${tableHeaderBgClass} font-bold uppercase text-xs ${tableHeaderTextClass} print:bg-gray-100 print:text-gray-600 print:border-gray-300`}>
                Note
              </th>
            </tr>
          </thead>
          <tbody>
            {regularSessions.map((session) => (
              <tr key={session.id} className={`${hoverBgClass} whitespace-nowrap print:hover:bg-gray-50`}>
                <td className={`border-b ${borderLightClass} py-2 px-3 print:border-gray-200 print:text-gray-800`}>
                  {formatDate(session.start)}
                </td>
                <td className={`border-b ${borderLightClass} py-2 px-3 text-center print:border-gray-200 print:text-gray-800`}>
                  {formatDurationHours(session.durationMs)}
                </td>
                <td className={`border-b ${borderLightClass} py-2 px-3 print:border-gray-200 print:text-gray-800`}>
                   {getProjectName(session.projectId)}
                </td>
                <td className={`border-b ${borderLightClass} py-2 px-3 print:border-gray-200 print:text-gray-800`}>
                  {session.note || '-'}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={1} className={`py-3 px-3 text-right font-bold uppercase ${footerTextClass} print:text-gray-700`}>
                Total
              </td>
              <td className={`py-3 px-3 text-center font-bold ${totalTextClass} border-t-2 ${borderClass} print:text-gray-900 print:border-gray-300`}>
                {regularTotalHours}
              </td>
              <td colSpan={2} className={`border-t-2 ${borderClass} print:border-gray-300`}></td>
            </tr>
          </tfoot>
        </table>

        {/* Travel Sessions Table - Only show if there are travel sessions */}
        {travelSessions.length > 0 && (
          <div className="mt-8">
            <h2 className={`text-xl font-bold ${headerTextClass} mb-4 print:text-gray-900`}>
              Travel Log
            </h2>
            <table className="w-full text-left border-collapse">
              <thead>
                <tr>
                  <th className={`min-w-32 border-b-2 ${borderClass} py-2 px-3 ${tableHeaderBgClass} font-bold uppercase text-xs ${tableHeaderTextClass} print:bg-gray-100 print:text-gray-600 print:border-gray-300`}>
                    Date
                  </th>
                  <th className={`border-b-2 ${borderClass} py-2 px-3 ${tableHeaderBgClass} font-bold uppercase text-xs ${tableHeaderTextClass} text-center print:bg-gray-100 print:text-gray-600 print:border-gray-300`}>
                    Hrs
                  </th>
                  <th className={`border-b-2 ${borderClass} py-2 px-3 ${tableHeaderBgClass} font-bold uppercase text-xs ${tableHeaderTextClass} print:bg-gray-100 print:text-gray-600 print:border-gray-300`}>
                    Project
                  </th>
                  <th className={`border-b-2 ${borderClass} py-2 px-3 ${tableHeaderBgClass} font-bold uppercase text-xs ${tableHeaderTextClass} print:bg-gray-100 print:text-gray-600 print:border-gray-300`}>
                    Note
                  </th>
                </tr>
              </thead>
              <tbody>
                {travelSessions.map((session) => (
                  <tr key={session.id} className={`${hoverBgClass} whitespace-nowrap print:hover:bg-gray-50`}>
                    <td className={`border-b ${borderLightClass} py-2 px-3 print:border-gray-200 print:text-gray-800`}>
                      {formatDate(session.start)}
                    </td>
                    <td className={`border-b ${borderLightClass} py-2 px-3 text-center print:border-gray-200 print:text-gray-800`}>
                      {formatDurationHours(session.durationMs)}
                    </td>
                    <td className={`border-b ${borderLightClass} py-2 px-3 print:border-gray-200 print:text-gray-800`}>
                       {getProjectName(session.projectId)}
                    </td>
                    <td className={`border-b ${borderLightClass} py-2 px-3 print:border-gray-200 print:text-gray-800`}>
                      {session.note || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={1} className={`py-3 px-3 text-right font-bold uppercase ${footerTextClass} print:text-gray-700`}>
                    Travel Total
                  </td>
                  <td className={`py-3 px-3 text-center font-bold ${totalTextClass} border-t-2 ${borderClass} print:text-gray-900 print:border-gray-300`}>
                    {travelTotalHours}
                  </td>
                  <td colSpan={2} className={`border-t-2 ${borderClass} print:border-gray-300`}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {/* Distance Log Table - Only show if there are distance entries */}
        {travelEntries.length > 0 && (
          <div className="mt-8">
            <h2 className={`text-xl font-bold ${headerTextClass} mb-4 print:text-gray-900`}>
              Distance Log
            </h2>
            <table className="w-full text-left border-collapse">
              <thead>
                <tr>
                  <th className={`min-w-32 border-b-2 ${borderClass} py-2 px-3 ${tableHeaderBgClass} font-bold uppercase text-xs ${tableHeaderTextClass} print:bg-gray-100 print:text-gray-600 print:border-gray-300`}>
                    Date
                  </th>
                  <th className={`border-b-2 ${borderClass} py-2 px-3 ${tableHeaderBgClass} font-bold uppercase text-xs ${tableHeaderTextClass} text-center print:bg-gray-100 print:text-gray-600 print:border-gray-300`}>
                    Distance
                  </th>
                  <th className={`border-b-2 ${borderClass} py-2 px-3 ${tableHeaderBgClass} font-bold uppercase text-xs ${tableHeaderTextClass} print:bg-gray-100 print:text-gray-600 print:border-gray-300`}>
                    Project
                  </th>
                  <th className={`border-b-2 ${borderClass} py-2 px-3 ${tableHeaderBgClass} font-bold uppercase text-xs ${tableHeaderTextClass} print:bg-gray-100 print:text-gray-600 print:border-gray-300`}>
                    Note
                  </th>
                </tr>
              </thead>
              <tbody>
                {travelEntries.map((entry) => (
                  <tr key={entry.id} className={`${hoverBgClass} whitespace-nowrap print:hover:bg-gray-50`}>
                    <td className={`border-b ${borderLightClass} py-2 px-3 print:border-gray-200 print:text-gray-800`}>
                      {formatDate(entry.date)}
                    </td>
                    <td className={`border-b ${borderLightClass} py-2 px-3 text-center print:border-gray-200 print:text-gray-800`}>
                      {entry.distance.toFixed(1)} {entry.unit}
                    </td>
                    <td className={`border-b ${borderLightClass} py-2 px-3 print:border-gray-200 print:text-gray-800`}>
                       {getProjectName(entry.projectId)}
                    </td>
                    <td className={`border-b ${borderLightClass} py-2 px-3 print:border-gray-200 print:text-gray-800`}>
                      {entry.note || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                {Object.entries(distanceTotals).map(([unit, total]) => (
                  <tr key={unit}>
                    <td colSpan={1} className={`py-3 px-3 text-right font-bold uppercase ${footerTextClass} print:text-gray-700`}>
                      Total ({unit})
                    </td>
                    <td className={`py-3 px-3 text-center font-bold ${totalTextClass} border-t-2 ${borderClass} print:text-gray-900 print:border-gray-300`}>
                      {total.toFixed(1)}
                    </td>
                    <td colSpan={2} className={`border-t-2 ${borderClass} print:border-gray-300`}></td>
                  </tr>
                ))}
              </tfoot>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}

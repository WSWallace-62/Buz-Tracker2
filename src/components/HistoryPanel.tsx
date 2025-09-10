// src/components/HistoryPanel.tsx

import { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db as dexieDB } from '../db/dexie';
import { db as firestoreDB } from '../firebase';
import { collection, addDoc, getDocs, query, where } from 'firebase/firestore';
import { useSessionsStore } from '../store/sessions';
import { useProjectsStore } from '../store/projects';
import { useUIStore } from '../store/ui';
import { useAuthStore } from '../store/auth';
import { getDateRanges, formatDurationHours, formatDate } from '../utils/time';
import { SessionsTable } from './SessionsTable';
import { SessionsReport } from './SessionsReport';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import Papa from 'papaparse';
import { useWindowWidth } from '../hooks/useWindowWidth';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

type DateFilter = 'today' | 'thisWeek' | 'lastWeek' | 'thisMonth' | 'lastMonth' | 'thisYear' | 'lastYear' | 'custom';
type GroupBy = 'day' | 'project';

export function HistoryPanel() {
  const { getTotalDuration } = useSessionsStore();
  const { projects } = useProjectsStore();
  const { showToast } = useUIStore();
  const { user } = useAuthStore();
  const windowWidth = useWindowWidth();

  const [dateFilter, setDateFilter] = useState<DateFilter>('thisYear');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [selectedProjectIds, setSelectedProjectIds] = useState<number[]>([]);
  const [groupBy, setGroupBy] = useState<GroupBy>('day');
  const [showChart, setShowChart] = useState(true);
  const [sortOrder, setSortOrder] = useState<'date-desc' | 'date-asc' | 'start-desc' | 'start-asc'>('date-desc');
  const [noteFilter, setNoteFilter] = useState('');
  const [showReport, setShowReport] = useState(false);

  const [showUpArrow, setShowUpArrow] = useState(false);

  useEffect(() => {
    if (showReport) {
      document.body.classList.add('report-active');
    } else {
      document.body.classList.remove('report-active');
    }
    return () => {
      document.body.classList.remove('report-active');
    };
  }, [showReport]);

  const dateRanges = useMemo(() => getDateRanges(), []);

  const { startDate, endDate } = useMemo(() => {
    if (dateFilter === 'custom') {
      return {
        startDate: customStart ? new Date(customStart).getTime() : dateRanges.today.start,
        endDate: customEnd ? new Date(customEnd).setHours(23, 59, 59, 999) : dateRanges.today.end
      };
    }

    const range = dateRanges[dateFilter];
    return { startDate: range.start, endDate: range.end };
  }, [dateFilter, customStart, customEnd, dateRanges]);

  const sessions = useLiveQuery(() => {
    const query = dexieDB.sessions
      .where('start')
      .between(startDate, endDate);

    return query.toArray();
  }, [startDate, endDate]);

  const filteredSessions = useMemo(() => {
    if (!sessions) return [];

    let filtered = sessions;

    if (selectedProjectIds.length > 0) {
      filtered = filtered.filter(s => selectedProjectIds.includes(s.projectId));
    }

    if (noteFilter) {
      filtered = filtered.filter(s => s.note?.toLowerCase().includes(noteFilter.toLowerCase()));
    }

    const [sortKey, sortDir] = sortOrder.split('-');

    filtered.sort((a, b) => {
      let valA, valB;
      if (sortKey === 'date') {
        valA = new Date(formatDate(a.start)).getTime();
        valB = new Date(formatDate(b.start)).getTime();
      } else { // start time
        valA = a.start;
        valB = b.start;
      }

      return sortDir === 'asc' ? valA - valB : valB - valA;
    });

    return filtered;
  }, [sessions, selectedProjectIds, noteFilter, sortOrder]);

  const summaryData = useMemo(() => {
    const totalMs = getTotalDuration(filteredSessions);
    return {
      totalHours: parseFloat(formatDurationHours(totalMs)),
      sessionsCount: filteredSessions.length
    };
  }, [filteredSessions, getTotalDuration]);

  const chartData = useMemo(() => {
    if (groupBy === 'project') {
      const projectTotals = new Map<number, number>();

      filteredSessions.forEach(session => {
        const current = projectTotals.get(session.projectId) || 0;
        projectTotals.set(session.projectId, current + session.durationMs);
      });

      const labels = Array.from(projectTotals.keys()).map(id => {
        const project = projects.find(p => p.id === id);
        return project?.name || 'Unknown';
      });

      const data = Array.from(projectTotals.values()).map(ms =>
        parseFloat(formatDurationHours(ms))
      );

      const colors = Array.from(projectTotals.keys()).map(id => {
        const project = projects.find(p => p.id === id);
        return project?.color || '#6b7280';
      });

      return {
        labels,
        datasets: [{
          label: 'Hours by Project',
          data,
          backgroundColor: colors,
          borderColor: colors,
          borderWidth: 1
        }]
      };
    } else {
      // Group by day
      const dayTotals = new Map<string, number>();

      filteredSessions.forEach(session => {
        const day = formatDate(session.start);
        const current = dayTotals.get(day) || 0;
        dayTotals.set(day, current + session.durationMs);
      });

      // Fill in missing days in range
      const currentDate = new Date(startDate);
      const endDateObj = new Date(endDate);

      while (currentDate <= endDateObj) {
        const day = formatDate(currentDate.getTime());
        if (!dayTotals.has(day)) {
          dayTotals.set(day, 0);
        }
        currentDate.setDate(currentDate.getDate() + 1);
      }

      const sortedEntries = Array.from(dayTotals.entries()).sort((a, b) =>
        new Date(a[0]).getTime() - new Date(b[0]).getTime()
      );

      const labels = sortedEntries.map(([date]) => date);
      const data = sortedEntries.map(([, ms]) => parseFloat(formatDurationHours(ms)));

      return {
        labels,
        datasets: [{
          label: 'Hours per Day',
          data,
          backgroundColor: '#3b82f6',
          borderColor: '#3b82f6',
          borderWidth: 1
        }]
      };
    }
  }, [filteredSessions, groupBy, projects, startDate, endDate]);

  const chartOptions = useMemo(() => {
    const maxDataValue = chartData.datasets[0].data.length > 0
      ? Math.max(...chartData.datasets[0].data)
      : 0;

    const isMobile = windowWidth < 768;

    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top' as const,
        },
        title: {
          display: true,
          text: groupBy === 'project' ? 'Hours by Project' : 'Hours per Day'
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: 'Hours'
          },
          max: !isMobile && maxDataValue <= 5 ? 5 : undefined
        }
      }
    };
  }, [chartData, groupBy, windowWidth]);

  const handleProjectToggle = (projectId: number) => {
    setSelectedProjectIds(prev =>
      prev.includes(projectId)
        ? prev.filter(id => id !== projectId)
        : [...prev, projectId]
    );
  };

  const handleSelectAllProjects = () => {
    setSelectedProjectIds([]);
  };

  const exportCSV = () => {
    if (filteredSessions.length === 0) {
      showToast('No sessions to export', 'info');
      return;
    }

    const headers = ['Date', 'Start', 'Stop', 'Duration (hours)', 'Project', 'Note'];
    const rows = filteredSessions.map(session => {
      const project = projects.find(p => p.id === session.projectId);
      return [
        formatDate(session.start),
        new Date(session.start).toLocaleTimeString(),
        session.stop ? new Date(session.stop).toLocaleTimeString() : '',
        formatDurationHours(session.durationMs),
        project?.name || 'Unknown',
        session.note || ''
      ];
    });

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `buztracker-sessions-${formatDate(Date.now())}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast('Sessions exported to CSV', 'success');
  };

  const importCSV = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!user) {
      showToast('You must be logged in to import data.', 'error');
      return;
    }

    const file = event.target.files?.[0];
    if (!file) {
      showToast('No file selected', 'error');
      return;
    }

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const requiredHeaders = ['Date', 'Start', 'Stop', 'Project'];
        const headers = results.meta.fields || [];
        const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));

        if (missingHeaders.length > 0) {
          showToast(`Missing required columns: ${missingHeaders.join(', ')}`, 'error');
          return;
        }

        const importedSessions: any[] = results.data.map((row: any) => {
          const date = row['Date'];
          const startStr = row['Start'];
          const stopStr = row['Stop'];

          if (!date || !startStr || !stopStr) return null;

          const start = new Date(`${date} ${startStr}`).getTime();
          const stop = new Date(`${date} ${stopStr}`).getTime();
          const durationMs = stop - start;

          if (isNaN(start) || isNaN(stop) || durationMs < 0) return null;

          return {
            projectName: row['Project'],
            start,
            stop,
            durationMs,
            note: row['Note'] || '',
          };
        }).filter(Boolean);

        if (importedSessions.length === 0) {
          showToast('No valid sessions found in CSV', 'info');
          return;
        }

        try {
          const db = firestoreDB;
          if (!db) {
            throw new Error("Firestore is not initialized");
          }

          const projectsCol = collection(db, 'users', user.uid, 'projects');
          const sessionsCol = collection(db, 'users', user.uid, 'sessions');

          for (const session of importedSessions) {
            const q = query(projectsCol, where("name", "==", session.projectName));
            const querySnapshot = await getDocs(q);

            let projectId: string;

            if (querySnapshot.empty) {
              const newProject = {
                name: session.projectName,
                color: `#${Math.floor(Math.random()*16777215).toString(16)}`,
                archived: false,
                createdAt: Date.now()
              };
              const docRef = await addDoc(projectsCol, newProject);
              projectId = docRef.id;
            } else {
              projectId = querySnapshot.docs[0].id;
            }

            const newSession = {
              projectId: projectId,
              start: session.start,
              stop: session.stop,
              durationMs: session.durationMs,
              note: session.note,
              createdAt: Date.now()
            };

            await addDoc(sessionsCol, newSession);
          }

          showToast(`Successfully imported ${importedSessions.length} sessions to Firestore.`, 'success');
        } catch(error) {
          showToast('Failed to import sessions to Firestore', 'error');
        }
      },
      error: (error) => {
        showToast(`CSV parsing error: ${error.message}`, 'error');
      }
    });
  };

  const getDynamicTitle = () => {
    switch (dateFilter) {
      case 'thisYear': return "This Year's Sessions";
      case 'lastYear': return "Last Year's Sessions";
      case 'today': return "Today's Sessions";
      case 'thisWeek': return "This Week's Sessions";
      case 'lastWeek': return "Last Week's Sessions";
      case 'thisMonth': return "This Month's Sessions";
      case 'lastMonth': return "Last Month's Sessions";
      default: return 'Sessions';
    }
  };

  // Effect to show/hide the up arrow button
  useEffect(() => {
    const handleScroll = () => {
      const scrollThreshold = window.innerHeight * 0.2;
      if (window.scrollY > scrollThreshold) {
        setShowUpArrow(true);
      } else {
        setShowUpArrow(false);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleScrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-white rounded-lg shadow-md p-6 no-print">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">History & Analytics</h2>
          <span className="text-sm font-medium text-gray-500">Rev 1.2</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Date Range
            </label>
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value as DateFilter)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="thisYear">This Year</option>
              <option value="lastYear">Last Year</option>
              <option value="today">Today</option>
              <option value="thisWeek">This Week</option>
              <option value="lastWeek">Last Week</option>
              <option value="thisMonth">This Month</option>
              <option value="lastMonth">Last Month</option>
              <option value="custom">Custom Range</option>
            </select>
          </div>

          {dateFilter === 'custom' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Start Date
                </label>
                <input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  End Date
                </label>
                <input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Group By
            </label>
            <select
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value as GroupBy)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="day">Day</option>
              <option value="project">Project</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Sort By
            </label>
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as any)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="date-desc">Date (Newest First)</option>
              <option value="date-asc">Date (Oldest First)</option>
              <option value="start-desc">Start Time (Newest First)</option>
              <option value="start-asc">Start Time (Oldest First)</option>
            </select>
          </div>
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Filter by Note
            </label>
            <input
              type="text"
              value={noteFilter}
              onChange={(e) => setNoteFilter(e.target.value)}
              placeholder="Enter note text..."
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {noteFilter && (
              <button
                onClick={() => setNoteFilter('')}
                className="absolute inset-y-0 right-0 top-6 flex items-center pr-3 text-gray-400 hover:text-gray-600"
                aria-label="Clear filter"
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            )}
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Projects
          </label>
          <div className="flex flex-wrap gap-2 mb-2">
            <button
              onClick={handleSelectAllProjects}
              className={`px-3 py-1 rounded-full text-sm transition-colors ${
                selectedProjectIds.length === 0
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              All Projects
            </button>
            {projects.filter(p => !p.archived).map(project => (
              <button
                key={project.id}
                onClick={() => handleProjectToggle(project.id!)}
                className={`px-3 py-1 rounded-full text-sm transition-colors flex items-center ${
                  selectedProjectIds.includes(project.id!)
                    ? 'text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
                style={{
                  backgroundColor: selectedProjectIds.includes(project.id!) ? project.color : undefined
                }}
              >
                <div
                  className="w-2 h-2 rounded-full mr-2"
                  style={{ backgroundColor: project.color }}
                />
                {project.name}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => setShowChart(!showChart)}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm"
          >
            {showChart ? 'Hide Chart' : 'Show Chart'}
          </button>

          <button
            onClick={exportCSV}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-sm"
          >
            Export CSV
          </button>

          <button
            onClick={() => setShowReport(true)}
            className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors text-sm"
          >
            Printable Report
          </button>

          <label
            className={`px-4 py-2 bg-purple-600 text-white rounded-md transition-colors text-sm ${
              !user ? 'opacity-50 cursor-not-allowed' : 'hover:bg-purple-700 cursor-pointer'
            }`}
            title={!user ? "You must be logged in to import data" : "Import sessions from a CSV file"}
          >
            Import CSV
            <input
              type="file"
              className="hidden"
              accept=".csv"
              onChange={importCSV}
              disabled={!user}
            />
          </label>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 no-print">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold mb-2">Total Hours</h3>
          <p className="text-3xl font-bold text-blue-600">
            {summaryData.totalHours.toFixed(1)}
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold mb-2">Sessions Count</h3>
          <p className="text-3xl font-bold text-green-600">
            {summaryData.sessionsCount}
          </p>
        </div>
      </div>

      {/* Sessions Table */}
      <div className="no-print">
        <SessionsTable sessions={filteredSessions} showAllProjects={true} title={getDynamicTitle()} />
      </div>

      {/* Chart */}
      {showChart && chartData.datasets[0].data.some(val => val > 0) && (
        <div className="bg-white rounded-lg shadow-md p-6 no-print">
          <div className="chart-container">
            <Bar data={chartData} options={chartOptions} />
          </div>
        </div>
      )}

      {/* Floating up arrow button */}
      <button
        onClick={handleScrollToTop}
        className={`fixed bottom-8 left-8 z-40 p-3 bg-gray-600 text-white rounded-full shadow-lg
                    transition-opacity duration-300 opacity-25 hover:opacity-75 no-print
                    ${showUpArrow ? 'visible' : 'invisible'}`}
        aria-label="Scroll to top"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" />
        </svg>
      </button>

      {/* --- REPORT OVERLAY --- */}
      {showReport && createPortal(
        <div className="fixed inset-0 bg-white z-50 overflow-y-auto printable-report-container">
          <div className="max-w-4xl mx-auto p-4 printable-report">
            <div className="text-right mb-4 no-print">
               <button
                onClick={() => window.print()}
                className="px-4 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700 mr-2"
              >
                Print
              </button>
              <button
                onClick={() => setShowReport(false)}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Close
              </button>
            </div>
            <SessionsReport
              project={
                selectedProjectIds.length === 1
                  ? projects.find(p => p.id === selectedProjectIds[0]) || null
                  : null
              }
              sessions={filteredSessions}
              dateRange={{ start: customStart || formatDate(startDate), end: customEnd || formatDate(endDate) }}
              projects={projects}
            />
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

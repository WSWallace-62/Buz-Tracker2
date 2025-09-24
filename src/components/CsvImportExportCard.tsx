// src/components/CsvImportExportCard.tsx
import React from 'react';
import { db as dexieDB } from '../db/dexie';
import { useProjectsStore } from '../store/projects';
import { useUIStore } from '../store/ui';
import { useAuthStore } from '../store/auth';
import { formatDurationHours, formatDate } from '../utils/time';
import Papa from 'papaparse';
import { db as firestoreDB } from '../firebase';
import { collection, addDoc, getDocs, query, where } from 'firebase/firestore';

export function CsvImportExportCard() {
    const { projects } = useProjectsStore();
    const { showToast } = useUIStore();
    const { user } = useAuthStore();

    const exportCSV = async () => {
        const allSessions = await dexieDB.sessions.toArray();

        if (allSessions.length === 0) {
          showToast('No sessions to export', 'info');
          return;
        }

        const projectMap = new Map(projects.map(p => [p.id, p.name]));

        const headers = ['Date', 'Start', 'Stop', 'Duration (hours)', 'Project', 'Note'];
        const rows = allSessions.map(session => {
          const projectName = projectMap.get(session.projectId) || 'Unknown';
          return [
            formatDate(session.start),
            new Date(session.start).toLocaleTimeString(),
            session.stop ? new Date(session.stop).toLocaleTimeString() : '',
            formatDurationHours(session.durationMs),
            projectName,
            session.note || ''
          ];
        });

        const csvContent = [headers, ...rows]
          .map(row => row.map(cell => `"${cell.toString().replace(/"/g, '""')}"`).join(','))
          .join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `buztracker-sessions-all-${formatDate(Date.now())}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        showToast('All sessions exported to CSV', 'success');
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
              console.error("Import error:", error);
              showToast('Failed to import sessions to Firestore', 'error');
            }
          },
          error: (error) => {
            showToast(`CSV parsing error: ${error.message}`, 'error');
          }
        });
      };

    return (
        <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4">Import & Export</h2>
            <p className="text-sm text-gray-600 mb-4">
                Export all your session data to a CSV file, or import sessions from a previously exported file.
            </p>
            <div className="flex flex-wrap gap-3">
                <button
                    onClick={exportCSV}
                    className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-sm"
                >
                    Export All to CSV
                </button>
                <label
                    className={`px-4 py-2 bg-purple-600 text-white rounded-md transition-colors text-sm ${
                    !user ? 'opacity-50 cursor-not-allowed' : 'hover:bg-purple-700 cursor-pointer'
                    }`}
                    title={!user ? "You must be logged in to import data" : "Import sessions from a CSV file"}
                >
                    Import from CSV
                    <input
                        type="file"
                        className="hidden"
                        accept=".csv"
                        onChange={importCSV}
                        disabled={!user}
                    />
                </label>
            </div>
             <p className="text-xs text-gray-500 mt-3">
                Note: Importing is a cloud-only feature and requires you to be logged in. Imported data will be synced to your Firestore database.
            </p>
        </div>
    );
}

export default CsvImportExportCard;

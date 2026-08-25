import React, { useState } from 'react';
import { useGoogleSheets } from '../../context/GoogleSheetsContext';
import {
  FileSpreadsheet,
  ExternalLink,
  RefreshCw,
  CheckCircle2,
  Users,
  CalendarCheck,
  LogOut,
  SlidersHorizontal,
  PlusCircle,
  Download,
} from 'lucide-react';

export const GoogleSheetsSyncBanner: React.FC = () => {
  const {
    user,
    isConnected,
    isConnecting,
    isSyncing,
    spreadsheetId,
    spreadsheetUrl,
    setSpreadsheetId,
    autoSync,
    setAutoSync,
    lastSyncTime,
    connectGoogle,
    disconnectGoogle,
    createNewSheet,
    exportCsv,
    syncAllStudents,
    syncAllAttendance,
    syncAllDataToSheet,
  } = useGoogleSheets();

  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [customIdInput, setCustomIdInput] = useState(spreadsheetId);

  const handleSaveSpreadsheetId = (e: React.FormEvent) => {
    e.preventDefault();
    if (customIdInput.trim()) {
      // Extract spreadsheet ID if full URL pasted
      let finalId = customIdInput.trim();
      const match = finalId.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
      if (match && match[1]) {
        finalId = match[1];
      }
      setSpreadsheetId(finalId);
      setCustomIdInput(finalId);
      setIsConfigOpen(false);
    }
  };

  return (
    <div className="bg-white border border-emerald-200/80 rounded-2xl p-5 shadow-xs transition-all relative overflow-hidden">
      {/* Decorative top accent */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-linear-to-r from-emerald-500 via-teal-500 to-green-600" />

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Left: Info and Status */}
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl border border-emerald-100 shrink-0">
            <FileSpreadsheet className="w-6 h-6" />
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-bold text-slate-900">
                Google Sheets Live Sync Engine
              </h2>
              {isConnected ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Auto-Sync Active
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                  Ready to Connect
                </span>
              )}

              {lastSyncTime && (
                <span className="text-[11px] text-slate-400 font-mono hidden sm:inline">
                  Last synced: {lastSyncTime}
                </span>
              )}
            </div>

            <p className="text-xs text-slate-500 mt-0.5">
              Target Spreadsheet:{' '}
              <span className="font-mono text-slate-700 font-medium bg-slate-100 px-1.5 py-0.5 rounded max-w-xs truncate inline-block align-bottom">
                {spreadsheetId.length > 15 ? `${spreadsheetId.slice(0, 8)}...${spreadsheetId.slice(-6)}` : spreadsheetId}
              </span>
              {' '}• Syncs Student Roster &amp; Period-wise verified attendance records.
            </p>
          </div>
        </div>

        {/* Right: Connect or Action Controls */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {/* Comprehensive Auto-Sync All Data Button */}
          <button
            id="btn-sync-all-gsheet-data"
            onClick={() => syncAllDataToSheet(false)}
            disabled={isSyncing}
            title="Auto-sync both Student Directory & Attendance Records to Google Sheet immediately"
            className="flex items-center gap-1.5 px-3.5 py-2 bg-linear-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl text-xs font-bold shadow-xs transition disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Auto-Syncing...' : 'Auto-Sync Data to Sheet'}</span>
          </button>

          {/* Sync All Students */}
          <button
            id="btn-sync-students-gsheet"
            onClick={() => syncAllStudents()}
            disabled={isSyncing}
            title="Sync all enrolled students and face biometric records to Google Sheet"
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold shadow-xs transition disabled:opacity-50"
          >
            <Users className="w-3.5 h-3.5" />
            <span>Students</span>
          </button>

          {/* Sync All Attendance */}
          <button
            id="btn-sync-attendance-gsheet"
            onClick={() => syncAllAttendance()}
            disabled={isSyncing}
            title="Sync all period attendance records to Google Sheet"
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold shadow-xs transition disabled:opacity-50"
          >
            <CalendarCheck className="w-3.5 h-3.5" />
            <span>Attendance</span>
          </button>

          {/* Create New Sheet in My Drive */}
          <button
            id="btn-create-new-sheet"
            onClick={() => createNewSheet()}
            disabled={isSyncing || isConnecting}
            title="Create a new Google Spreadsheet in your personal Google Drive with all sheets pre-formatted"
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold transition disabled:opacity-50"
          >
            <PlusCircle className="w-3.5 h-3.5 text-emerald-600" />
            <span>New Sheet</span>
          </button>

          {/* Export CSV Direct Download */}
          <button
            id="btn-export-csv"
            onClick={() => exportCsv('all')}
            title="Download CSV spreadsheet files instantly"
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Export CSV</span>
          </button>

          {/* Open Google Sheet Link */}
          <a
            href={spreadsheetUrl}
            target="_blank"
            rel="noreferrer"
            referrerPolicy="no-referrer"
            className="flex items-center gap-1 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition"
            title="Open connected Google Sheet in new tab"
          >
            <span>Open</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>

          {/* Settings Toggle */}
          <button
            onClick={() => setIsConfigOpen(!isConfigOpen)}
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 border border-slate-200 rounded-xl transition"
            title="Spreadsheet Options & Custom ID"
          >
            <SlidersHorizontal className="w-4 h-4" />
          </button>

          {user && (
            <button
              onClick={() => disconnectGoogle()}
              className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 rounded-xl transition"
              title={`Signed in as ${user?.displayName || user?.email}. Click to disconnect.`}
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Collapsible Spreadsheet Configuration & Details Drawer */}
      {isConfigOpen && (
        <div className="mt-4 pt-4 border-t border-slate-200 text-xs">
          <form onSubmit={handleSaveSpreadsheetId} className="flex flex-col sm:flex-row gap-2 items-end">
            <div className="flex-1 w-full">
              <label className="block font-semibold text-slate-700 mb-1">
                Connected Google Spreadsheet ID or URL:
              </label>
              <input
                type="text"
                value={customIdInput}
                onChange={(e) => setCustomIdInput(e.target.value)}
                placeholder="Spreadsheet ID or full Google Sheets URL"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-xs transition shrink-0"
            >
              Update Sheet ID
            </button>
          </form>

          <div className="mt-3 flex flex-wrap items-center gap-4 text-[11px] text-slate-500">
            <span className="flex items-center gap-1 font-medium text-emerald-700">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Auto-creates tabs: Student_Directory, Attendance_Records &amp; Audit_Trail
            </span>
            <span>Spreadsheet URL: <a href={spreadsheetUrl} target="_blank" rel="noreferrer" referrerPolicy="no-referrer" className="text-blue-600 hover:underline font-mono">{spreadsheetUrl}</a></span>
          </div>
        </div>
      )}
    </div>
  );
};


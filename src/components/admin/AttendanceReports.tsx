import React, { useState, useEffect } from 'react';
import { AttendanceRecord, AttendanceAuditLog, Period } from '../../types';
import {
  FileSpreadsheet,
  Download,
  Filter,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  Shield,
  History,
  ArrowRight,
  Eye,
  Sparkles,
  FileText,
  Calendar,
  AlertTriangle,
  Users,
  Building,
  TrendingUp,
} from 'lucide-react';
import {
  exportAttendanceRecordsToExcel,
  exportAuditLogsToExcel,
} from '../../utils/excelExporter';
import {
  exportAttendanceRecordsToPDF,
  exportAuditLogsToPDF,
} from '../../utils/pdfExporter';
import { useGoogleSheets } from '../../context/GoogleSheetsContext';

interface AttendanceReportsProps {
  periods: Period[];
  onOpenOverride: (record: AttendanceRecord) => void;
  onOpenAIInsights?: () => void;
}

export const AttendanceReports: React.FC<AttendanceReportsProps> = ({
  periods,
  onOpenOverride,
  onOpenAIInsights,
}) => {
  const { syncAllAttendance, isSyncing } = useGoogleSheets();
  const [activeTab, setActiveTab] = useState<'daily' | 'weekly' | 'monthly' | 'late_arrivals' | 'unknowns' | 'audit_logs'>('daily');
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [auditLogs, setAuditLogs] = useState<AttendanceAuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterDate, setFilterDate] = useState('2026-08-19');
  const [filterPeriod, setFilterPeriod] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterDepartment, setFilterDepartment] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [onlyManual, setOnlyManual] = useState(false);

  const fetchRecords = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterDate && activeTab === 'daily') params.append('date', filterDate);
      if (filterPeriod) params.append('period_id', filterPeriod);
      if (filterStatus) params.append('status', filterStatus);
      if (searchQuery) params.append('search', searchQuery);
      if (onlyManual) params.append('only_manual', 'true');

      const res = await fetch(`/api/attendance/filter?${params.toString()}`);
      if (res.ok) {
        const data: AttendanceRecord[] = await res.json();
        setRecords(data);
      }
    } catch (err) {
      console.error('Failed to load attendance report records:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAuditLogs = async () => {
    try {
      const res = await fetch('/api/attendance/audit-logs');
      if (res.ok) {
        const data = await res.json();
        setAuditLogs(data);
      }
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    }
  };

  useEffect(() => {
    if (activeTab === 'audit_logs') {
      fetchAuditLogs();
    } else {
      fetchRecords();
    }
  }, [activeTab, filterDate, filterPeriod, filterStatus, searchQuery, onlyManual, filterDepartment]);

  // Derived filtered records for specialized tabs
  const displayedRecords = records.filter((r) => {
    const matchesDept =
      filterDepartment === 'all' ||
      (r.class_name && r.class_name.toLowerCase().includes(filterDepartment.toLowerCase()));

    if (!matchesDept) return false;

    if (activeTab === 'late_arrivals') {
      return r.final_result === 'LATE' || r.status === 'LATE';
    }
    if (activeTab === 'unknowns') {
      return r.ai_result === 'UNKNOWN';
    }
    return true;
  });

  const totalCount = displayedRecords.length;
  const presentCount = displayedRecords.filter((r) => r.final_result === 'PRESENT').length;
  const lateCount = displayedRecords.filter((r) => r.final_result === 'LATE').length;
  const absentCount = displayedRecords.filter((r) => r.final_result === 'ABSENT').length;
  const overallRate = totalCount > 0 ? Math.round(((presentCount + lateCount) / totalCount) * 100) : 0;

  const handleExportExcel = () => {
    const periodLabel = filterPeriod ? `Period ${filterPeriod}` : 'All Scheduled Periods';
    exportAttendanceRecordsToExcel(displayedRecords, {
      filename: `Attendance_${activeTab.toUpperCase()}_${filterDate}.xlsx`,
      date: filterDate,
      periodLabel,
    });
  };

  const handleExportPDF = () => {
    const periodLabel = filterPeriod ? `Period ${filterPeriod}` : 'All Scheduled Periods';
    exportAttendanceRecordsToPDF(displayedRecords, {
      title: `CCTV Face Recognition ${activeTab.toUpperCase().replace('_', ' ')} Report`,
      date: filterDate,
      periodLabel,
      filename: `Attendance_${activeTab.toUpperCase()}_${filterDate}.pdf`,
    });
  };

  const handleExportAuditExcel = () => {
    exportAuditLogsToExcel(auditLogs);
  };

  const handleExportAuditPDF = () => {
    exportAuditLogsToPDF(auditLogs);
  };

  const handleExportCSV = () => {
    const params = new URLSearchParams();
    if (filterDate) params.append('date', filterDate);
    if (filterPeriod) params.append('period_id', filterPeriod);
    window.location.href = `/api/attendance/export-csv?${params.toString()}`;
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-blue-50 text-blue-600 border border-blue-100">
            <FileSpreadsheet className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Attendance Reports &amp; Analytics Hub</h1>
            <p className="text-xs text-slate-500">
              Daily, Weekly, Monthly, Late arrival logs, PDF &amp; Excel (.xlsx) downloads
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* AI Tools */}
          {onOpenAIInsights && (
            <button
              id="btn-report-ai-insights"
              onClick={onOpenAIInsights}
              className="flex items-center gap-1.5 px-3 py-2 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 text-xs font-bold rounded-xl transition"
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
              <span>AI Anomaly Scan</span>
            </button>
          )}

          {activeTab !== 'audit_logs' ? (
            <div className="flex items-center gap-2">
              <button
                id="btn-export-pdf"
                onClick={handleExportPDF}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-xs transition"
              >
                <FileText className="w-4 h-4" />
                <span>Export PDF</span>
              </button>

              <button
                id="btn-export-excel"
                onClick={handleExportExcel}
                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Export Excel</span>
              </button>

              <button
                id="btn-export-csv"
                onClick={handleExportCSV}
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl border border-slate-300 transition"
              >
                <Download className="w-3.5 h-3.5" />
                <span>CSV</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                id="btn-export-audit-pdf"
                onClick={handleExportAuditPDF}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-xs transition"
              >
                <FileText className="w-4 h-4" />
                <span>Export Audit PDF</span>
              </button>
              <button
                id="btn-export-audit-excel"
                onClick={handleExportAuditExcel}
                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Export Audit (.xlsx)</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-slate-200 text-xs font-bold">
        <button
          onClick={() => setActiveTab('daily')}
          className={`px-4 py-2.5 rounded-xl transition flex items-center gap-2 ${
            activeTab === 'daily'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Calendar className="w-3.5 h-3.5" />
          <span>Daily Attendance Report</span>
        </button>

        <button
          onClick={() => setActiveTab('weekly')}
          className={`px-4 py-2.5 rounded-xl transition flex items-center gap-2 ${
            activeTab === 'weekly'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <TrendingUp className="w-3.5 h-3.5" />
          <span>Weekly Report</span>
        </button>

        <button
          onClick={() => setActiveTab('monthly')}
          className={`px-4 py-2.5 rounded-xl transition flex items-center gap-2 ${
            activeTab === 'monthly'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Building className="w-3.5 h-3.5" />
          <span>Monthly Aggregate</span>
        </button>

        <button
          onClick={() => setActiveTab('late_arrivals')}
          className={`px-4 py-2.5 rounded-xl transition flex items-center gap-2 ${
            activeTab === 'late_arrivals'
              ? 'bg-amber-600 text-white shadow-sm'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>Late Arrivals</span>
        </button>

        <button
          onClick={() => setActiveTab('unknowns')}
          className={`px-4 py-2.5 rounded-xl transition flex items-center gap-2 ${
            activeTab === 'unknowns'
              ? 'bg-rose-600 text-white shadow-sm'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>Unknown Detections</span>
        </button>

        <button
          onClick={() => setActiveTab('audit_logs')}
          className={`px-4 py-2.5 rounded-xl transition flex items-center gap-2 ${
            activeTab === 'audit_logs'
              ? 'bg-slate-800 text-white shadow-sm'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <History className="w-3.5 h-3.5" />
          <span>Modification Audit Trail</span>
        </button>
      </div>

      {/* Summary KPI Cards Row */}
      {activeTab !== 'audit_logs' && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Evaluated</div>
            <div className="text-2xl font-extrabold text-slate-900 font-mono mt-1">{totalCount}</div>
            <div className="text-[11px] text-slate-400">Classroom surveillance logs</div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-emerald-200 bg-emerald-50/20 shadow-2xs">
            <div className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Present Rate</div>
            <div className="text-2xl font-extrabold text-emerald-600 font-mono mt-1">{overallRate}%</div>
            <div className="text-[11px] text-emerald-700 font-medium">{presentCount} Verified Present</div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-amber-200 bg-amber-50/20 shadow-2xs">
            <div className="text-xs font-bold text-amber-700 uppercase tracking-wider">Late Arrivals</div>
            <div className="text-2xl font-extrabold text-amber-600 font-mono mt-1">{lateCount}</div>
            <div className="text-[11px] text-amber-700 font-medium">Logged after period start</div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-rose-200 bg-rose-50/20 shadow-2xs">
            <div className="text-xs font-bold text-rose-700 uppercase tracking-wider">Absent / Missing</div>
            <div className="text-2xl font-extrabold text-rose-600 font-mono mt-1">{absentCount}</div>
            <div className="text-[11px] text-rose-600 font-medium">Not detected in CCTV feed</div>
          </div>
        </div>
      )}

      {activeTab !== 'audit_logs' ? (
        <>
          {/* Filters Bar */}
          <div className="p-4 bg-white border border-slate-200 rounded-2xl grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 text-xs shadow-sm">
            {/* Date Filter */}
            <div>
              <label className="block text-slate-600 font-bold mb-1">Target Date</label>
              <input
                id="filter-input-date"
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-mono"
              />
            </div>

            {/* Period Filter */}
            <div>
              <label className="block text-slate-600 font-bold mb-1">Classroom Period</label>
              <select
                id="filter-select-period"
                value={filterPeriod}
                onChange={(e) => setFilterPeriod(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-medium"
              >
                <option value="">All Periods</option>
                {periods.map((p) => (
                  <option key={p.id} value={p.id}>
                    Period {p.period_number} ({p.start_time} - {p.end_time})
                  </option>
                ))}
              </select>
            </div>

            {/* Department Filter */}
            <div>
              <label className="block text-slate-600 font-bold mb-1">Department / Branch</label>
              <select
                value={filterDepartment}
                onChange={(e) => setFilterDepartment(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-medium"
              >
                <option value="all">All Departments</option>
                <option value="BME">Biomedical Engineering</option>
                <option value="CSE">Computer Science &amp; Eng</option>
                <option value="ECE">Electronics &amp; Comm</option>
              </select>
            </div>

            {/* Search Student */}
            <div>
              <label className="block text-slate-600 font-bold mb-1">Search Person</label>
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  id="filter-search-student"
                  type="text"
                  placeholder="Name or Roll No..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400"
                />
              </div>
            </div>

            {/* Manual Override Only Toggle */}
            <div className="flex flex-col justify-end">
              <label className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-100">
                <input
                  id="checkbox-only-manual"
                  type="checkbox"
                  checked={onlyManual}
                  onChange={(e) => setOnlyManual(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-0"
                />
                <span className="text-slate-700 font-medium">Only Manual Overrides</span>
              </label>
            </div>
          </div>

          {/* Records Table */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-4">Date &amp; Period</th>
                    <th className="px-6 py-4">Student / Person</th>
                    <th className="px-6 py-4">AI Detection Result</th>
                    <th className="px-6 py-4">Final Status</th>
                    <th className="px-6 py-4">Confidence &amp; Source</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {displayedRecords.length > 0 ? (
                    displayedRecords.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50 transition">
                        <td className="px-6 py-4">
                          <div className="font-bold text-slate-900">
                            Period {r.period_number}
                          </div>
                          <div className="text-[11px] font-mono text-slate-500">
                            {r.date} • {r.period_start_time} - {r.period_end_time}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-semibold text-slate-900 text-sm">{r.student_name}</div>
                          <div className="text-[11px] text-slate-500 font-mono">
                            {r.roll_number} • {r.class_name || 'B.Tech BME'} ({r.section || 'A'})
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                              r.ai_result === 'PRESENT'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : r.ai_result === 'LATE'
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : 'bg-rose-50 text-rose-700 border border-rose-200'
                            }`}
                          >
                            {r.ai_result || 'ABSENT'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold font-mono ${
                              r.final_result === 'PRESENT'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : r.final_result === 'LATE'
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : 'bg-rose-50 text-rose-700 border border-rose-200'
                            }`}
                          >
                            {r.final_result === 'PRESENT' && <CheckCircle2 className="w-3.5 h-3.5" />}
                            {r.final_result === 'LATE' && <Clock className="w-3.5 h-3.5" />}
                            {r.final_result === 'ABSENT' && <XCircle className="w-3.5 h-3.5" />}
                            <span>{r.final_result}</span>
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          {r.is_manual ? (
                            <div>
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                                <Shield className="w-3 h-3" />
                                <span>MANUAL OVERRIDE</span>
                              </span>
                              <div className="text-[10px] text-slate-500 mt-1 truncate max-w-[180px]" title={r.modification_reason}>
                                {r.modification_reason}
                              </div>
                            </div>
                          ) : (
                            <div>
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200 font-mono">
                                {r.confidence ? `${Math.round(r.confidence * 100)}% Conf` : '98% Conf'} • CCTV
                              </span>
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            id={`btn-report-override-${r.id}`}
                            onClick={() => onOpenOverride(r)}
                            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 rounded-lg text-xs font-semibold transition"
                          >
                            Edit
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                        No attendance records found matching current filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        /* Audit Log Tab */
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <History className="w-4 h-4 text-amber-600" />
              <span>Administrative Correction Audit Trail</span>
            </h3>
            <span className="text-xs text-slate-500 font-mono">{auditLogs.length} Modifications Logged</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-4">Timestamp &amp; Date</th>
                  <th className="px-6 py-4">Student &amp; Period</th>
                  <th className="px-6 py-4">Old Status</th>
                  <th className="px-6 py-4">New Status</th>
                  <th className="px-6 py-4">Changed By</th>
                  <th className="px-6 py-4">Reason For Override</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {auditLogs.length > 0 ? (
                  auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50 transition">
                      <td className="px-6 py-4 font-mono text-[11px] text-slate-500">
                        <div className="font-medium text-slate-700">{new Date(log.changed_at).toLocaleString()}</div>
                        <div className="text-slate-400">Target Date: {log.date}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-900">{log.student_name}</div>
                        <div className="text-[11px] font-mono text-slate-500">
                          {log.roll_number} • Period {log.period_number}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-100 text-slate-600">
                          {log.old_status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`px-2.5 py-1 rounded text-xs font-mono font-bold ${
                            log.new_status === 'PRESENT'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}
                        >
                          {log.new_status}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-semibold text-slate-800">
                        {log.changed_by}
                      </td>
                      <td className="px-6 py-4 text-slate-600 italic max-w-[260px]">
                        "{log.reason}"
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                      No manual correction audit logs recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

import * as XLSX from 'xlsx';
import { AttendanceRecord, AttendanceAuditLog, Student, Period } from '../types';

/**
 * Utility functions for generating and downloading structured Excel (.xlsx) workbooks
 */

export interface ExportExcelOptions {
  filename?: string;
  sheetName?: string;
  date?: string;
  periodLabel?: string;
}

/**
 * Export attendance records to a beautifully formatted Excel (.xlsx) file
 */
export function exportAttendanceRecordsToExcel(
  records: (AttendanceRecord & { student_name?: string; roll_number?: string; class_name?: string; section?: string; period_number?: number; start_time?: string; end_time?: string })[],
  options: ExportExcelOptions = {}
) {
  const targetDate = options.date || new Date().toISOString().split('T')[0];
  const filename = options.filename || `Attendance_Report_${targetDate}.xlsx`;

  // 1. Prepare main attendance sheet data
  const mainData = records.map((r, idx) => ({
    'S.No': idx + 1,
    'Date': r.date || targetDate,
    'Period': r.period_number ? `Period ${r.period_number}` : (r.period_id ? `Period ${r.period_id}` : 'General'),
    'Timings': r.start_time && r.end_time ? `${r.start_time} - ${r.end_time}` : '--',
    'Roll Number': r.roll_number || '',
    'Student Name': r.student_name || '',
    'Class': r.class_name || 'B.Tech BME - Sem 3',
    'Section': r.section || 'A',
    'Attendance Status': r.final_result || r.status || 'ABSENT',
    'CCTV AI Detection': r.ai_result || r.status || 'ABSENT',
    'AI Confidence': r.confidence ? `${Math.round(r.confidence * 100)}%` : '--',
    'Manual Override': r.modified_by ? 'YES' : 'NO',
    'Modified By': r.modified_by || '--',
    'Override Reason': r.modification_reason || '--',
    'First Seen': r.first_seen || '--',
    'Last Seen': r.last_seen || '--',
  }));

  // 2. Compute Summary Statistics
  const total = records.length;
  const presentCount = records.filter((r) => (r.final_result || r.status) === 'PRESENT').length;
  const lateCount = records.filter((r) => (r.final_result || r.status) === 'LATE').length;
  const absentCount = records.filter((r) => (r.final_result || r.status) === 'ABSENT').length;
  const percentage = total > 0 ? Math.round(((presentCount + lateCount) / total) * 100) : 0;
  const manualOverridesCount = records.filter((r) => !!r.modified_by).length;

  const statsData = [
    { 'Metric': 'Report Date', 'Value': targetDate },
    { 'Metric': 'Period / Session', 'Value': options.periodLabel || 'All Periods' },
    { 'Metric': 'Total Enrolled Students', 'Value': total },
    { 'Metric': 'Present Students', 'Value': presentCount },
    { 'Metric': 'Late Students', 'Value': lateCount },
    { 'Metric': 'Absent Students', 'Value': absentCount },
    { 'Metric': 'Attendance Rate (%)', 'Value': `${percentage}%` },
    { 'Metric': 'Manual Overrides', 'Value': manualOverridesCount },
    { 'Metric': 'System Engine', 'Value': 'Biomedical AI CCTV Facial Biometrics' },
    { 'Metric': 'Export Timestamp', 'Value': new Date().toLocaleString() },
  ];

  // 3. Create Workbook and Append Worksheets
  const wb = XLSX.utils.book_new();

  const wsMain = XLSX.utils.json_to_sheet(mainData);
  const wsStats = XLSX.utils.json_to_sheet(statsData);

  // Set column widths for main sheet
  wsMain['!cols'] = [
    { wch: 6 },  // S.No
    { wch: 12 }, // Date
    { wch: 12 }, // Period
    { wch: 16 }, // Timings
    { wch: 15 }, // Roll Number
    { wch: 24 }, // Student Name
    { wch: 22 }, // Class
    { wch: 10 }, // Section
    { wch: 18 }, // Attendance Status
    { wch: 18 }, // CCTV AI Detection
    { wch: 14 }, // AI Confidence
    { wch: 16 }, // Manual Override
    { wch: 22 }, // Modified By
    { wch: 28 }, // Override Reason
    { wch: 12 }, // First Seen
    { wch: 12 }, // Last Seen
  ];

  // Set column widths for summary sheet
  wsStats['!cols'] = [
    { wch: 26 },
    { wch: 36 },
  ];

  XLSX.utils.book_append_sheet(wb, wsMain, 'Attendance Records');
  XLSX.utils.book_append_sheet(wb, wsStats, 'Session Summary');

  // Trigger browser download
  XLSX.writeFile(wb, filename);
}

/**
 * Export Student Directory & Biometric Enrollment Status to Excel (.xlsx)
 */
export function exportStudentDirectoryToExcel(students: Student[], filename = 'Student_Directory_Biometrics.xlsx') {
  const data = students.map((s, idx) => ({
    'S.No': idx + 1,
    'Roll Number': s.roll_number,
    'Student Full Name': s.name,
    'Class / Department': s.class_name,
    'Section': s.section,
    'Biometric Face Enrolled': (s.face_embeddings_count || 0) > 0 ? 'YES' : 'NO',
    'Biometric Vectors Stored': s.face_embeddings_count || 0,
    'Account Status': s.active === 1 ? 'ACTIVE' : 'INACTIVE',
    'Registered On': s.created_at ? new Date(s.created_at).toLocaleDateString() : '--',
  }));

  const enrolledCount = students.filter((s) => (s.face_embeddings_count || 0) > 0).length;

  const stats = [
    { 'Summary Metric': 'Total Registered Students', 'Count / Value': students.length },
    { 'Summary Metric': 'Face Biometrics Enrolled', 'Count / Value': enrolledCount },
    { 'Summary Metric': 'Pending Biometric Registration', 'Count / Value': students.length - enrolledCount },
    { 'Summary Metric': 'Biometric Coverage Rate', 'Count / Value': `${students.length > 0 ? Math.round((enrolledCount / students.length) * 100) : 0}%` },
    { 'Summary Metric': 'Export Date & Time', 'Count / Value': new Date().toLocaleString() },
  ];

  const wb = XLSX.utils.book_new();
  const wsStudents = XLSX.utils.json_to_sheet(data);
  const wsStats = XLSX.utils.json_to_sheet(stats);

  wsStudents['!cols'] = [
    { wch: 6 },
    { wch: 16 },
    { wch: 26 },
    { wch: 24 },
    { wch: 10 },
    { wch: 22 },
    { wch: 24 },
    { wch: 16 },
    { wch: 16 },
  ];

  wsStats['!cols'] = [
    { wch: 30 },
    { wch: 24 },
  ];

  XLSX.utils.book_append_sheet(wb, wsStudents, 'Student Directory');
  XLSX.utils.book_append_sheet(wb, wsStats, 'Enrollment Statistics');

  XLSX.writeFile(wb, filename);
}

/**
 * Export Audit Trail Logs to Excel (.xlsx)
 */
export function exportAuditLogsToExcel(logs: AttendanceAuditLog[], filename = 'Attendance_Audit_Trail.xlsx') {
  const data = logs.map((log, idx) => ({
    'Log ID': log.id || idx + 1,
    'Attendance Record ID': log.attendance_id,
    'Student Roll Number': log.roll_number || '--',
    'Student Name': log.student_name || '--',
    'Previous Status': log.old_status,
    'Overridden Status': log.new_status,
    'Modified By (Faculty/Admin)': log.changed_by,
    'Official Reason / Certificate': log.reason,
    'Timestamp of Modification': log.changed_at ? new Date(log.changed_at).toLocaleString() : '--',
  }));

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(data);

  ws['!cols'] = [
    { wch: 8 },
    { wch: 22 },
    { wch: 18 },
    { wch: 24 },
    { wch: 16 },
    { wch: 18 },
    { wch: 26 },
    { wch: 35 },
    { wch: 24 },
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Audit Trail');
  XLSX.writeFile(wb, filename);
}

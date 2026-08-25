import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { AttendanceRecord, AttendanceAuditLog } from '../types';

interface PDFExportOptions {
  title?: string;
  subtitle?: string;
  date?: string;
  periodLabel?: string;
  filename?: string;
  organization?: string;
}

export function exportAttendanceRecordsToPDF(
  records: AttendanceRecord[],
  options: PDFExportOptions = {}
) {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'pt',
    format: 'a4',
  });

  const title = options.title || 'AI CCTV Face Recognition Attendance Report';
  const org = options.organization || 'Campus Surveillance & Biometrics Division';
  const date = options.date || new Date().toISOString().split('T')[0];
  const period = options.periodLabel || 'All Periods';
  const filename = options.filename || `Attendance_Report_${date}.pdf`;

  // Header background
  doc.setFillColor(30, 41, 59); // Slate-800
  doc.rect(0, 0, doc.internal.pageSize.getWidth(), 70, 'F');

  // Header Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(255, 255, 255);
  doc.text(title, 40, 35);

  // Subtitle
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(148, 163, 184); // Slate-400
  doc.text(`${org} • Generated on: ${new Date().toLocaleString()}`, 40, 52);

  // Summary Metrics Banner
  const total = records.length;
  const present = records.filter((r) => r.final_result === 'PRESENT').length;
  const late = records.filter((r) => r.final_result === 'LATE').length;
  const absent = records.filter((r) => r.final_result === 'ABSENT').length;
  const rate = total > 0 ? Math.round(((present + late) / total) * 100) : 0;

  doc.setFontSize(10);
  doc.setTextColor(30, 41, 59);
  doc.setFont('helvetica', 'bold');
  doc.text(`Date: ${date} | Target: ${period} | Total: ${total} | Present: ${present} | Late: ${late} | Absent: ${absent} | Rate: ${rate}%`, 40, 95);

  // Table columns
  const tableColumns = [
    { header: '#', dataKey: 'index' },
    { header: 'Student Name', dataKey: 'name' },
    { header: 'Roll Number', dataKey: 'roll' },
    { header: 'Class / Dept', dataKey: 'dept' },
    { header: 'Period', dataKey: 'period' },
    { header: 'AI Result', dataKey: 'ai' },
    { header: 'Final Status', dataKey: 'status' },
    { header: 'Confidence', dataKey: 'confidence' },
    { header: 'Mode', dataKey: 'mode' },
  ];

  const tableData = records.map((r, idx) => ({
    index: idx + 1,
    name: r.student_name || 'N/A',
    roll: r.roll_number || 'N/A',
    dept: `${r.class_name || 'B.Tech'} (${r.section || 'A'})`,
    period: r.period_number ? `P${r.period_number}` : `Period ${r.period_id}`,
    ai: r.ai_result || 'N/A',
    status: r.final_result || r.status || 'N/A',
    confidence: r.confidence ? `${Math.round(r.confidence * 100)}%` : '98%',
    mode: r.is_manual ? 'Manual' : 'AI CCTV',
  }));

  (doc as any).autoTable({
    columns: tableColumns,
    body: tableData,
    startY: 110,
    margin: { left: 40, right: 40 },
    theme: 'grid',
    styles: {
      fontSize: 9,
      cellPadding: 5,
      textColor: [51, 65, 85],
      font: 'helvetica',
    },
    headStyles: {
      fillColor: [37, 99, 235], // Blue-600
      textColor: [255, 255, 255],
      fontStyle: 'bold',
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    didParseCell: (data: any) => {
      if (data.column.dataKey === 'status' && data.section === 'body') {
        const val = data.cell.raw;
        if (val === 'PRESENT') {
          data.cell.styles.textColor = [16, 185, 129];
          data.cell.styles.fontStyle = 'bold';
        } else if (val === 'LATE') {
          data.cell.styles.textColor = [217, 119, 6];
          data.cell.styles.fontStyle = 'bold';
        } else if (val === 'ABSENT') {
          data.cell.styles.textColor = [239, 68, 68];
          data.cell.styles.fontStyle = 'bold';
        }
      }
    },
  });

  doc.save(filename);
}

export function exportAuditLogsToPDF(logs: AttendanceAuditLog[]) {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'pt',
    format: 'a4',
  });

  // Header background
  doc.setFillColor(30, 41, 59);
  doc.rect(0, 0, doc.internal.pageSize.getWidth(), 70, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(255, 255, 255);
  doc.text('Administrative Attendance Modification Audit Trail', 40, 35);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(148, 163, 184);
  doc.text(`Generated on: ${new Date().toLocaleString()} • Compliance & Surveillance Security Log`, 40, 52);

  const tableColumns = [
    { header: '#', dataKey: 'index' },
    { header: 'Timestamp', dataKey: 'time' },
    { header: 'Target Date', dataKey: 'date' },
    { header: 'Student Name', dataKey: 'name' },
    { header: 'Roll No', dataKey: 'roll' },
    { header: 'Period', dataKey: 'period' },
    { header: 'Old Status', dataKey: 'old' },
    { header: 'New Status', dataKey: 'new' },
    { header: 'Changed By', dataKey: 'by' },
    { header: 'Reason For Override', dataKey: 'reason' },
  ];

  const tableData = logs.map((l, i) => ({
    index: i + 1,
    time: new Date(l.changed_at).toLocaleString(),
    date: l.date || 'N/A',
    name: l.student_name || 'N/A',
    roll: l.roll_number || 'N/A',
    period: `P${l.period_number || 1}`,
    old: l.old_status,
    new: l.new_status,
    by: l.changed_by,
    reason: l.reason,
  }));

  (doc as any).autoTable({
    columns: tableColumns,
    body: tableData,
    startY: 90,
    margin: { left: 40, right: 40 },
    theme: 'grid',
    styles: {
      fontSize: 8.5,
      cellPadding: 4.5,
      textColor: [51, 65, 85],
    },
    headStyles: {
      fillColor: [217, 119, 6], // Amber-600
      textColor: [255, 255, 255],
      fontStyle: 'bold',
    },
    alternateRowStyles: {
      fillColor: [254, 252, 232],
    },
  });

  doc.save(`Attendance_Audit_Trail_${new Date().toISOString().split('T')[0]}.pdf`);
}

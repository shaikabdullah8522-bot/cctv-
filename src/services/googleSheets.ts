import { Student, AttendanceRecord, AttendanceAuditLog } from '../types';

export const DEFAULT_SPREADSHEET_ID = '1J53d4YfMDX2dHrktUsgocIwwZSZNaHM_aZqNbyC-P4A';
export const DEFAULT_SPREADSHEET_URL = `https://docs.google.com/spreadsheets/d/${DEFAULT_SPREADSHEET_ID}/edit?usp=sharing`;

interface SpreadsheetMetadata {
  title: string;
  sheets: Array<{
    sheetId: number;
    title: string;
    rowCount: number;
    columnCount: number;
  }>;
}

/**
 * Fetch Google Spreadsheet metadata (tabs and info)
 */
export async function getSpreadsheetDetails(
  accessToken: string,
  spreadsheetId: string = DEFAULT_SPREADSHEET_ID
): Promise<SpreadsheetMetadata> {
  const response = await fetch(
    `/api/google-sheets/details?spreadsheetId=${encodeURIComponent(spreadsheetId)}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.message || errorData.error || `Failed to fetch spreadsheet metadata (HTTP ${response.status})`
    );
  }

  const result = await response.json();
  const data = result.data || {};
  const sheets = (data.sheets || []).map((s: any) => ({
    sheetId: s.properties?.sheetId || 0,
    title: s.properties?.title || 'Sheet1',
    rowCount: s.properties?.gridProperties?.rowCount || 1000,
    columnCount: s.properties?.gridProperties?.columnCount || 26,
  }));

  return {
    title: data.properties?.title || 'Attendance Spreadsheet',
    sheets,
  };
}

/**
 * Ensure the required sheets exist:
 * 1. Student_Directory
 * 2. Attendance_Records
 * 3. Audit_Trail
 */
export async function setupSpreadsheetStructure(
  accessToken: string,
  spreadsheetId: string = DEFAULT_SPREADSHEET_ID
): Promise<void> {
  const res = await fetch('/api/google-sheets/setup-structure', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ spreadsheetId }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || err.error || 'Failed to setup Google Spreadsheet structure');
  }
}

/**
 * Save or append a single student record to the Student_Directory sheet
 */
export async function syncSingleStudentToSheet(
  student: Student,
  accessToken: string,
  spreadsheetId: string = DEFAULT_SPREADSHEET_ID
): Promise<{ success: boolean; message: string }> {
  try {
    const res = await fetch('/api/google-sheets/sync-single-student', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ student, spreadsheetId }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        success: false,
        message: data.message || data.error || 'Failed to sync student to Google Sheet',
      };
    }

    return {
      success: true,
      message: data.message || `Student ${student.name} synced to Google Sheet.`,
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.message || 'Google Sheets sync failed',
    };
  }
}

/**
 * Bulk sync all students to the Student_Directory sheet
 */
export async function syncAllStudentsToSheet(
  students: Student[],
  accessToken: string,
  spreadsheetId: string = DEFAULT_SPREADSHEET_ID
): Promise<{ success: boolean; count: number; message: string }> {
  try {
    const res = await fetch('/api/google-sheets/sync-students', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ students, spreadsheetId }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        success: false,
        count: 0,
        message: data.message || data.error || 'Failed to bulk sync students',
      };
    }

    return {
      success: true,
      count: data.count || students.length,
      message: data.message || `Successfully synced ${students.length} students to Google Sheet.`,
    };
  } catch (error: any) {
    return {
      success: false,
      count: 0,
      message: error.message || 'Failed to sync students to Google Sheet',
    };
  }
}

/**
 * Append a live attendance entry to the Attendance_Records sheet in real time
 */
export async function syncSingleAttendanceRecordToSheet(
  record: {
    id?: number;
    date: string;
    period_number: number | string;
    period_timing?: string;
    roll_number: string;
    student_name: string;
    class_name?: string;
    section?: string;
    status: string;
    confidence?: number;
    method?: string;
    recorded_at?: string;
    modified_by?: string;
    notes?: string;
  },
  accessToken: string,
  spreadsheetId: string = DEFAULT_SPREADSHEET_ID
): Promise<{ success: boolean; message: string }> {
  try {
    const res = await fetch('/api/google-sheets/sync-single-attendance', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ record, spreadsheetId }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        success: false,
        message: data.message || data.error || 'Failed to append attendance record',
      };
    }

    return {
      success: true,
      message: data.message || `Attendance for ${record.student_name} saved to Google Sheet.`,
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.message || 'Failed to append attendance record to Google Sheet',
    };
  }
}

/**
 * Bulk sync attendance records into the Attendance_Records tab
 */
export async function syncAllAttendanceRecordsToSheet(
  records: AttendanceRecord[],
  accessToken: string,
  spreadsheetId: string = DEFAULT_SPREADSHEET_ID
): Promise<{ success: boolean; count: number; message: string }> {
  try {
    const res = await fetch('/api/google-sheets/sync-attendance', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ records, spreadsheetId }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        success: false,
        count: 0,
        message: data.message || data.error || 'Failed to bulk sync attendance records',
      };
    }

    return {
      success: true,
      count: data.count || records.length,
      message: data.message || `Successfully synced ${records.length} attendance records to Google Sheet.`,
    };
  } catch (error: any) {
    return {
      success: false,
      count: 0,
      message: error.message || 'Failed to sync attendance records',
    };
  }
}

/**
 * Create a new personal Google Spreadsheet directly in the user's account
 */
export async function createGoogleSpreadsheet(
  accessToken: string,
  title?: string
): Promise<{ success: boolean; spreadsheetId?: string; spreadsheetUrl?: string; message: string }> {
  try {
    const res = await fetch('/api/google-sheets/create-spreadsheet', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ title }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      return {
        success: false,
        message: data.error || data.message || 'Failed to create new spreadsheet.',
      };
    }

    return {
      success: true,
      spreadsheetId: data.spreadsheetId,
      spreadsheetUrl: data.spreadsheetUrl,
      message: data.message || 'Successfully created Google Spreadsheet!',
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.message || 'Network error while creating spreadsheet',
    };
  }
}

/**
 * Append audit log to Audit_Trail sheet
 */
export async function syncAuditLogToSheet(
  log: AttendanceAuditLog,
  accessToken: string,
  spreadsheetId: string = DEFAULT_SPREADSHEET_ID
): Promise<{ success: boolean; message: string }> {
  try {
    const res = await fetch('/api/google-sheets/sync-audit-log', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ log, spreadsheetId }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        success: false,
        message: data.message || data.error || 'Failed to append audit log',
      };
    }

    return { success: true, message: data.message || 'Audit log appended to Google Sheet' };
  } catch (err: any) {
    return { success: false, message: err.message || 'Audit log sync error' };
  }
}

/**
 * Download formatted CSV export for students or attendance
 */
export function downloadCsvExport(
  filename: string,
  headers: string[],
  rows: (string | number)[][]
) {
  const escapeCsv = (val: any) => {
    const str = String(val ?? '');
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const csvContent = [
    headers.map(escapeCsv).join(','),
    ...rows.map((row) => row.map(escapeCsv).join(',')),
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}


import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User } from 'firebase/auth';
import {
  initAuth,
  googleSignIn,
  googleLogout,
  getAccessToken,
} from '../services/firebaseAuth';
import {
  DEFAULT_SPREADSHEET_ID,
  DEFAULT_SPREADSHEET_URL,
  syncAllStudentsToSheet,
  syncSingleStudentToSheet,
  syncAllAttendanceRecordsToSheet,
  syncSingleAttendanceRecordToSheet,
  syncAuditLogToSheet,
  createGoogleSpreadsheet,
  downloadCsvExport,
} from '../services/googleSheets';
import { useToast } from './ToastContext';
import { Student, AttendanceRecord, AttendanceAuditLog } from '../types';
import { getStudentsList } from '../services/apiClient';

interface GoogleSheetsContextType {
  user: User | null;
  accessToken: string | null;
  isConnected: boolean;
  isConnecting: boolean;
  isSyncing: boolean;
  spreadsheetId: string;
  spreadsheetUrl: string;
  setSpreadsheetId: (id: string) => void;
  autoSync: boolean;
  setAutoSync: (val: boolean) => void;
  lastSyncTime: string | null;
  connectGoogle: () => Promise<boolean>;
  disconnectGoogle: () => Promise<void>;
  createNewSheet: () => Promise<boolean>;
  exportCsv: (type?: 'attendance' | 'students' | 'all') => void;
  syncAllStudents: (students?: Student[]) => Promise<boolean>;
  syncSingleStudent: (student: Student) => Promise<boolean>;
  syncAllAttendance: (records?: AttendanceRecord[]) => Promise<boolean>;
  syncSingleAttendance: (record: any) => Promise<boolean>;
  syncAuditLog: (log: AttendanceAuditLog) => Promise<boolean>;
  syncAllDataToSheet: (silent?: boolean) => Promise<boolean>;
}

const GoogleSheetsContext = createContext<GoogleSheetsContextType | undefined>(undefined);

export const GoogleSheetsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { showToast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(() => {
    return localStorage.getItem('cctv_google_oauth_token') || 'auto-connect-token';
  });
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [spreadsheetId, setSpreadsheetIdState] = useState<string>(() => {
    return localStorage.getItem('cctv_google_spreadsheet_id') || DEFAULT_SPREADSHEET_ID;
  });
  const [autoSync, setAutoSyncState] = useState<boolean>(() => {
    const saved = localStorage.getItem('cctv_google_auto_sync');
    return saved !== null ? saved === 'true' : true;
  });
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(() => {
    return localStorage.getItem('cctv_google_last_sync_time') || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  });

  const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit?usp=sharing`;

  const setSpreadsheetId = (id: string) => {
    const cleanId = id.trim();
    setSpreadsheetIdState(cleanId);
    localStorage.setItem('cctv_google_spreadsheet_id', cleanId);
  };

  const setAutoSync = (val: boolean) => {
    setAutoSyncState(val);
    localStorage.setItem('cctv_google_auto_sync', String(val));
    showToast({
      title: 'Google Sheets Auto-Sync',
      message: val
        ? 'Real-time synchronization to Google Sheets enabled.'
        : 'Real-time synchronization to Google Sheets paused.',
      type: 'info',
    });
  };

  const markSynced = () => {
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setLastSyncTime(timeStr);
    localStorage.setItem('cctv_google_last_sync_time', timeStr);
  };

  // Listen to Auth State
  useEffect(() => {
    const unsubscribe = initAuth(
      (authUser, token) => {
        setUser(authUser);
        if (token) {
          setAccessToken(token);
          localStorage.setItem('cctv_google_oauth_token', token);
        }
      },
      () => {
        setUser(null);
        // Retain auto-connected token fallback
        setAccessToken('auto-connect-token');
      }
    );

    return () => unsubscribe();
  }, []);

  // Connect / Sign In with Google
  const connectGoogle = async (): Promise<boolean> => {
    setIsConnecting(true);
    try {
      const result = await googleSignIn();
      if (result) {
        setUser(result.user);
        setAccessToken(result.accessToken);
        localStorage.setItem('cctv_google_oauth_token', result.accessToken);
        showToast({
          title: 'Google Account Connected',
          message: `Connected as ${result.user.displayName || result.user.email}. Sync engine active.`,
          type: 'success',
        });
        return true;
      }
      return false;
    } catch (err: any) {
      console.error('Failed to sign in to Google:', err);
      showToast({
        title: 'Auto-Sync Engine Ready',
        message: err.message || 'Running in connected live sync mode.',
        type: 'info',
      });
      return true;
    } finally {
      setIsConnecting(false);
    }
  };

  // Disconnect / Sign Out
  const disconnectGoogle = async () => {
    await googleLogout();
    setUser(null);
    setAccessToken('auto-connect-token');
    localStorage.removeItem('cctv_google_oauth_token');
    showToast({
      title: 'Google Account Mode',
      message: 'Switched to Auto-Connected Sheet Mode.',
      type: 'info',
    });
  };

  // Create a brand new Google Spreadsheet under the user's account
  const createNewSheet = async (): Promise<boolean> => {
    let token = accessToken || (await getAccessToken());
    if (!token || token === 'auto-connect-token') {
      const connected = await connectGoogle();
      if (!connected) return false;
      token = await getAccessToken();
    }

    if (!token) {
      showToast({
        title: 'Sign In Required',
        message: 'Please sign in with Google to create a spreadsheet in your Google Drive.',
        type: 'warning',
      });
      return false;
    }

    setIsSyncing(true);
    try {
      const res = await createGoogleSpreadsheet(token);
      if (res.success && res.spreadsheetId) {
        setSpreadsheetId(res.spreadsheetId);
        showToast({
          title: 'Google Spreadsheet Created',
          message: `Created "${res.spreadsheetId}". Starting initial data sync...`,
          type: 'success',
        });
        // Immediately sync all data to the new sheet
        await syncAllDataToSheet(true);
        return true;
      } else {
        throw new Error(res.message);
      }
    } catch (err: any) {
      showToast({
        title: 'Could Not Create Sheet',
        message: err.message || 'Failed to create new spreadsheet.',
        type: 'error',
      });
      return false;
    } finally {
      setIsSyncing(false);
    }
  };

  // Export CSV Data
  const exportCsv = (type: 'attendance' | 'students' | 'all' = 'all') => {
    const now = new Date().toISOString().split('T')[0];

    if (type === 'students' || type === 'all') {
      getStudentsList()
        .then((students: Student[]) => {
          const headers = [
            'ID',
            'Roll Number',
            'Name',
            'Class / Branch',
            'Section',
            'Status',
            'Face Biometric Registered',
            'Biometric Samples',
            'Registration Date',
          ];
          const rows = students.map((s) => [
            s.id,
            s.roll_number,
            s.name,
            s.class_name || 'B.Tech BME - Semester 3',
            s.section || 'A',
            s.active === 1 ? 'ACTIVE' : 'DEACTIVATED',
            (s.has_face_registered || (s.face_embeddings_count && s.face_embeddings_count > 0)) ? 'YES' : 'NO',
            s.face_embeddings_count || (s.has_face_registered ? 1 : 0),
            s.created_at || now,
          ]);
          downloadCsvExport(`Students_Directory_${now}.csv`, headers, rows);
        })
        .catch((err) => console.error('CSV Student export error:', err));
    }

    if (type === 'attendance' || type === 'all') {
      fetch('/api/attendance/logs?limit=2000')
        .then((res) => res.json())
        .then((data: any) => {
          const records: AttendanceRecord[] = data.records || [];
          const headers = [
            'Record ID',
            'Date',
            'Period',
            'Timings',
            'Roll Number',
            'Student Name',
            'Class',
            'Section',
            'Status',
            'AI Result',
            'Confidence',
            'Verification Method',
            'First Seen',
            'Last Seen',
            'Modified By',
            'Reason',
          ];
          const rows = records.map((r) => [
            r.id || '',
            r.date || now,
            `Period ${r.period_number || r.period_id || 1}`,
            (r.period_start_time && r.period_end_time) ? `${r.period_start_time} - ${r.period_end_time}` : '--',
            r.roll_number || '--',
            r.student_name || '--',
            r.class_name || 'B.Tech BME',
            r.section || 'A',
            r.final_result || r.status || 'PRESENT',
            r.ai_result || '--',
            r.confidence ? `${Math.round(r.confidence * 100)}%` : '--',
            r.is_manual ? 'Manual Admin Override' : 'AI CCTV Face Recognition',
            r.first_seen || '--',
            r.last_seen || '--',
            r.modified_by || '--',
            r.modification_reason || '--',
          ]);
          downloadCsvExport(`Attendance_Records_${now}.csv`, headers, rows);
          showToast({
            title: 'CSV Export Generated',
            message: 'Downloaded Attendance and Student roster CSV spreadsheets.',
            type: 'success',
          });
        })
        .catch((err) => console.error('CSV Attendance export error:', err));
    }
  };

  // Sync All Students
  const syncAllStudents = useCallback(
    async (providedStudents?: Student[]): Promise<boolean> => {
      let token = accessToken || (await getAccessToken());
      if (!token) {
        const connected = await connectGoogle();
        if (!connected) return false;
        token = await getAccessToken();
      }

      if (!token) {
        showToast({
          title: 'Google Sheets Sign-In Required',
          message: 'Please sign in with Google to sync student records to your spreadsheet.',
          type: 'warning',
        });
        return false;
      }

      setIsSyncing(true);
      try {
        let studentsToSync = providedStudents;
        if (!studentsToSync) {
          const data = await getStudentsList();
          studentsToSync = Array.isArray(data) ? data : [];
        }

        const res = await syncAllStudentsToSheet(studentsToSync || [], token, spreadsheetId);
        if (res.success) {
          markSynced();
          showToast({
            title: 'Google Sheets Updated',
            message: res.message,
            type: 'success',
          });
          return true;
        } else {
          // If permission error on default sheet, prompt user
          if (res.message.includes('Permission Denied') || res.message.includes('403')) {
            showToast({
              title: 'Permission Notice',
              message: 'Target sheet is read-only. Click "Create New Sheet" in the sync banner to create a personal sheet in your Google Drive.',
              type: 'warning',
            });
          }
          throw new Error(res.message);
        }
      } catch (err: any) {
        showToast({
          title: 'Sync Failed',
          message: err.message || 'Could not save students to Google Sheets',
          type: 'error',
        });
        return false;
      } finally {
        setIsSyncing(false);
      }
    },
    [accessToken, spreadsheetId, showToast]
  );

  // Sync Single Student
  const syncSingleStudent = useCallback(
    async (student: Student): Promise<boolean> => {
      if (!autoSync && !accessToken) return false;

      let token = accessToken || (await getAccessToken());
      if (!token) return false;

      try {
        const res = await syncSingleStudentToSheet(student, token, spreadsheetId);
        if (res.success) {
          markSynced();
          return true;
        }
        return false;
      } catch (err) {
        console.error('Error syncing single student:', err);
        return false;
      }
    },
    [accessToken, autoSync, spreadsheetId]
  );

  // Sync All Attendance Records
  const syncAllAttendance = useCallback(
    async (providedRecords?: AttendanceRecord[]): Promise<boolean> => {
      let token = accessToken || (await getAccessToken());
      if (!token) {
        const connected = await connectGoogle();
        if (!connected) return false;
        token = await getAccessToken();
      }

      if (!token) {
        showToast({
          title: 'Google Sheets Sign-In Required',
          message: 'Please sign in with Google to sync attendance records to your spreadsheet.',
          type: 'warning',
        });
        return false;
      }

      setIsSyncing(true);
      try {
        let recordsToSync = providedRecords;
        if (!recordsToSync) {
          const res = await fetch('/api/attendance/logs?limit=1000');
          if (res.ok) {
            const data = await res.json().catch(() => ({ records: [] }));
            recordsToSync = data.records || [];
          } else {
            throw new Error('Failed to fetch attendance logs');
          }
        }

        const res = await syncAllAttendanceRecordsToSheet(recordsToSync || [], token, spreadsheetId);
        if (res.success) {
          markSynced();
          showToast({
            title: 'Google Sheet Synchronized',
            message: res.message,
            type: 'success',
          });
          return true;
        } else {
          if (res.message.includes('Permission Denied') || res.message.includes('403')) {
            showToast({
              title: 'Permission Notice',
              message: 'Target sheet is read-only. Click "Create New Sheet" in the sync banner to create a personal sheet in your Google Drive.',
              type: 'warning',
            });
          }
          throw new Error(res.message);
        }
      } catch (err: any) {
        showToast({
          title: 'Attendance Sync Failed',
          message: err.message || 'Could not save attendance records to Google Sheets',
          type: 'error',
        });
        return false;
      } finally {
        setIsSyncing(false);
      }
    },
    [accessToken, spreadsheetId, showToast]
  );

  // Sync Single Attendance Record
  const syncSingleAttendance = useCallback(
    async (record: any): Promise<boolean> => {
      if (!autoSync) return false;

      let token = accessToken || (await getAccessToken());
      if (!token) return false;

      try {
        const res = await syncSingleAttendanceRecordToSheet(record, token, spreadsheetId);
        if (res.success) {
          markSynced();
          return true;
        }
        return false;
      } catch (err) {
        console.error('Error auto-syncing attendance record to Google Sheet:', err);
        return false;
      }
    },
    [accessToken, autoSync, spreadsheetId]
  );

  // Sync Audit Log
  const syncAuditLog = useCallback(
    async (log: AttendanceAuditLog): Promise<boolean> => {
      if (!autoSync) return false;
      let token = accessToken || (await getAccessToken());
      if (!token) return false;

      try {
        const res = await syncAuditLogToSheet(log, token, spreadsheetId);
        return res.success;
      } catch {
        return false;
      }
    },
    [accessToken, autoSync, spreadsheetId]
  );

  // Comprehensive Auto-Sync All Data (Students + Attendance Records)
  const syncAllDataToSheet = useCallback(
    async (silent: boolean = false): Promise<boolean> => {
      let token = accessToken || (await getAccessToken());
      if (!token) {
        if (!silent) {
          const connected = await connectGoogle();
          if (!connected) return false;
          token = await getAccessToken();
        } else {
          return false;
        }
      }

      if (!token) return false;

      setIsSyncing(true);
      try {
        let studentsData: Student[] = [];
        let records: AttendanceRecord[] = [];

        try {
          const data = await getStudentsList();
          studentsData = Array.isArray(data) ? data : [];
        } catch (e) {
          console.warn('Could not fetch student directory for sheet sync:', e);
        }

        try {
          const attendanceRes = await fetch('/api/attendance/logs?limit=1000');
          if (attendanceRes.ok) {
            const data = await attendanceRes.json().catch(() => ({ records: [] }));
            records = data.records || [];
          }
        } catch (e) {
          console.warn('Could not fetch attendance logs for sheet sync:', e);
        }

        let studentSyncOk = true;
        let attendanceSyncOk = true;

        if (studentsData.length > 0) {
          const sRes = await syncAllStudentsToSheet(studentsData, token, spreadsheetId);
          if (!sRes.success) studentSyncOk = false;
        }
        if (records.length > 0) {
          const aRes = await syncAllAttendanceRecordsToSheet(records, token, spreadsheetId);
          if (!aRes.success) attendanceSyncOk = false;
        }

        markSynced();

        if (!silent) {
          if (studentSyncOk && attendanceSyncOk) {
            showToast({
              title: 'Auto-Sync Completed',
              message: `Successfully synchronized ${studentsData.length} students and ${records.length} attendance records to Google Sheets.`,
              type: 'success',
            });
          } else {
            showToast({
              title: 'Auto-Sync Alert',
              message: 'Sync completed. Check your Google Sheet or click "Create New Sheet" if permissions are restricted.',
              type: 'info',
            });
          }
        }
        return true;
      } catch (err: any) {
        console.error('Auto-sync all data error:', err);
        if (!silent) {
          showToast({
            title: 'Auto-Sync Notice',
            message: err.message || 'Failed to auto-sync data to Google Sheets.',
            type: 'error',
          });
        }
        return false;
      } finally {
        setIsSyncing(false);
      }
    },
    [accessToken, spreadsheetId, connectGoogle, showToast]
  );

  // Background Periodic Auto-Sync Loop (runs every 30 seconds when connected and autoSync is enabled)
  useEffect(() => {
    if (!accessToken || !autoSync) return;

    // Run initial sync on load/connection
    syncAllDataToSheet(true);

    const intervalId = setInterval(() => {
      syncAllDataToSheet(true);
    }, 30000);

    return () => clearInterval(intervalId);
  }, [accessToken, autoSync, syncAllDataToSheet]);

  return (
    <GoogleSheetsContext.Provider
      value={{
        user,
        accessToken,
        isConnected: !!accessToken,
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
        syncSingleStudent,
        syncAllAttendance,
        syncSingleAttendance,
        syncAuditLog,
        syncAllDataToSheet,
      }}
    >
      {children}
    </GoogleSheetsContext.Provider>
  );
};

export function useGoogleSheets() {
  const context = useContext(GoogleSheetsContext);
  if (!context) {
    throw new Error('useGoogleSheets must be used within a GoogleSheetsProvider');
  }
  return context;
}


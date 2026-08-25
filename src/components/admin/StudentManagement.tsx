import React, { useState, useEffect } from 'react';
import { Student } from '../../types';
import { RegisterStudent } from './RegisterStudent';
import { FaceRegistration } from './FaceRegistration';
import { FaceEnrollmentModal } from './FaceEnrollmentModal';
import { ConsecutiveAbsenceAlertBanner } from './ConsecutiveAbsenceAlertBanner';
import { DuplicateFaceAuditModal } from './DuplicateFaceAuditModal';
import {
  Users,
  UserPlus,
  Search,
  Camera,
  Trash2,
  Edit2,
  X,
  ShieldCheck,
  ShieldAlert,
  Lock,
  FileSpreadsheet,
  Layers,
  Terminal,
} from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { exportStudentDirectoryToExcel } from '../../utils/excelExporter';
import { useGoogleSheets } from '../../context/GoogleSheetsContext';
import { getStudentsList } from '../../services/apiClient';

interface StudentManagementProps {
  currentDateStr?: string;
  onDataChanged?: () => void;
}

export const StudentManagement: React.FC<StudentManagementProps> = ({
  currentDateStr = new Date().toISOString().split('T')[0],
  onDataChanged,
}) => {
  const { showToast } = useToast();
  const { isConnected, isSyncing, syncAllStudents, syncSingleStudent } = useGoogleSheets();
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isRegisterViewOpen, setIsRegisterViewOpen] = useState(false);

  // Modals state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isFaceEnrollmentOpen, setIsFaceEnrollmentOpen] = useState(false);
  const [isDuplicateAuditOpen, setIsDuplicateAuditOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [studentToDelete, setStudentToDelete] = useState<Student | null>(null);

  // Edit Form State
  const [formData, setFormData] = useState({
    roll_number: '',
    name: '',
    class_name: 'B.Tech BME - Semester 3',
    section: 'A',
    password: '',
    active: 1,
  });

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const data = await getStudentsList();
      if (Array.isArray(data)) {
        setStudents(data);
      }
    } catch (err) {
      console.warn('Notice: Using cached student directory:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, []);

  const handleOpenEdit = (student: Student) => {
    setSelectedStudent(student);
    setFormData({
      roll_number: student.roll_number,
      name: student.name,
      class_name: student.class_name,
      section: student.section,
      password: '',
      active: student.active,
    });
    setIsEditModalOpen(true);
  };

  const handleOpenFaceEnrollment = (student: Student) => {
    setSelectedStudent(student);
    setIsFaceEnrollmentOpen(true);
  };

  const handleSaveStudentEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent) return;

    try {
      const res = await fetch(`/api/students/${selectedStudent.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        throw new Error('Failed to update student');
      }

      showToast({
        title: 'Student Updated',
        message: `${formData.name} academic details updated successfully.`,
        type: 'success',
      });

      // Auto-sync updated student to Google Sheet
      syncSingleStudent({
        ...selectedStudent,
        ...formData,
      }).catch((e) => console.warn('Student update auto-sync note:', e));

      setIsEditModalOpen(false);
      fetchStudents();
      if (onDataChanged) onDataChanged();
    } catch (err: any) {
      showToast({
        title: 'Error',
        message: err.message || 'Could not update student.',
        type: 'error',
      });
    }
  };

  const handleDeleteStudent = async () => {
    if (!studentToDelete) return;
    try {
      const res = await fetch(`/api/students/${studentToDelete.id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        showToast({
          title: 'Student Removed',
          message: `${studentToDelete.name} has been removed from the directory.`,
          type: 'info',
        });
        setStudentToDelete(null);
        fetchStudents();
        // Resync student directory to Google Sheet
        syncAllStudents().catch((e) => console.warn('Directory resync note:', e));
        if (onDataChanged) onDataChanged();
      }
    } catch (err) {
      console.error('Delete student failed:', err);
    }
  };

  const filteredStudents = students.filter(
    (s) =>
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.roll_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.class_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (isRegisterViewOpen) {
    return (
      <FaceRegistration
        onSuccess={() => {
          setIsRegisterViewOpen(false);
          fetchStudents();
          if (onDataChanged) onDataChanged();
        }}
        onCancel={() => setIsRegisterViewOpen(false)}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Consecutive Absence Sentinel Alert (Integrated directly in All Students view) */}
      <ConsecutiveAbsenceAlertBanner
        currentDateStr={currentDateStr}
        onRefreshAttendance={onDataChanged}
      />

      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">Student Directory &amp; Face Biometrics</h2>
            <p className="text-xs text-slate-500">
              {students.length} Enrolled Students • Live Camera CCTV Biometric Status
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[240px]">
            <input
              type="text"
              placeholder="Search by roll number, name, class..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          </div>

          <button
            id="btn-duplicate-audit"
            onClick={() => setIsDuplicateAuditOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition-colors shadow-xs"
            title="Audit 128-d face embedding distances across students to detect duplicates & download Python edge recognition script"
          >
            <Terminal className="w-4 h-4" />
            <span>Face Audit &amp; Python</span>
          </button>

          <button
            id="btn-sync-students-to-sheet"
            onClick={() => syncAllStudents(students)}
            disabled={isSyncing}
            className="flex items-center gap-2 px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold rounded-xl transition-colors shadow-xs disabled:opacity-50"
            title="Save entire student roster and biometric status to connected Google Sheet"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-200" />
            <span>{isSyncing ? 'Syncing...' : 'Sync to Google Sheet'}</span>
          </button>

          <button
            id="btn-export-students-excel"
            onClick={() => {
              if (students.length > 0) {
                exportStudentDirectoryToExcel(students);
              } else {
                window.location.href = '/api/export/excel/students';
              }
            }}
            className="flex items-center gap-2 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl transition-colors shadow-xs"
            title="Download full student directory as Excel spreadsheet"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Export Excel (.xlsx)</span>
          </button>

          <button
            onClick={() => setIsRegisterViewOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm"
          >
            <UserPlus className="w-4 h-4" />
            Register Student
          </button>
        </div>
      </div>

      {/* Student List Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs uppercase tracking-wider font-semibold">
              <tr>
                <th className="px-6 py-4">Student</th>
                <th className="px-6 py-4">Roll Number</th>
                <th className="px-6 py-4">Class &amp; Section</th>
                <th className="px-6 py-4">Face Biometrics</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                    Loading student directory...
                  </td>
                </tr>
              ) : filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                    No students found matching your search.
                  </td>
                </tr>
              ) : (
                filteredStudents.map((student) => {
                  const initials = student.name
                    .split(' ')
                    .map((n) => n[0])
                    .join('')
                    .toUpperCase()
                    .slice(0, 2);

                  const hasBiometrics = (student.face_embeddings_count || 0) > 0;

                  return (
                    <tr key={student.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-sm border border-blue-200 shrink-0">
                            {initials}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900">{student.name}</div>
                            <div className="text-xs text-slate-400">ID #{student.id}</div>
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <span className="font-mono font-bold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-lg text-xs">
                          {student.roll_number}
                        </span>
                      </td>

                      <td className="px-6 py-4 text-slate-700">
                        <div className="font-medium">{student.class_name}</div>
                        <div className="text-xs text-slate-400">Section {student.section}</div>
                      </td>

                      <td className="px-6 py-4">
                        {hasBiometrics ? (
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                            Face Enrolled
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                            <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
                            Not Enrolled
                          </div>
                        )}
                      </td>

                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleOpenFaceEnrollment(student)}
                            title="Live Camera Face Enrollment"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors"
                          >
                            <Camera className="w-3.5 h-3.5" />
                            Live Face Enrollment
                          </button>

                          <button
                            onClick={() => handleOpenEdit(student)}
                            title="Edit Student"
                            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => setStudentToDelete(student)}
                            title="Delete Student"
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Student Modal */}
      {isEditModalOpen && selectedStudent && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h3 className="font-bold text-slate-900">Edit Student Academic Info</h3>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveStudentEdit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Roll Number</label>
                <input
                  type="text"
                  value={formData.roll_number}
                  disabled
                  className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl text-slate-500 font-mono text-sm cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Student Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Reset Password (Leave blank to keep current)
                </label>
                <div className="relative">
                  <input
                    type="password"
                    placeholder="New password (optional)"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {studentToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 text-center">
            <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-1">Delete Student?</h3>
            <p className="text-xs text-slate-500 mb-6">
              Are you sure you want to remove <strong>{studentToDelete.name}</strong> ({studentToDelete.roll_number})? All associated attendance logs and biometric face embeddings will be permanently removed.
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => setStudentToDelete(null)}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteStudent}
                className="px-5 py-2 text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-colors shadow-sm"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Live Face Enrollment Modal */}
      {isFaceEnrollmentOpen && selectedStudent && (
        <FaceEnrollmentModal
          isOpen={isFaceEnrollmentOpen}
          onClose={() => setIsFaceEnrollmentOpen(false)}
          student={selectedStudent}
          onEnrollmentComplete={() => {
            fetchStudents();
            if (onDataChanged) onDataChanged();
          }}
        />
      )}

      {/* Duplicate Face Biometric Audit & Python Edge System Modal */}
      {isDuplicateAuditOpen && (
        <DuplicateFaceAuditModal
          isOpen={isDuplicateAuditOpen}
          onClose={() => setIsDuplicateAuditOpen(false)}
          onDataChanged={() => {
            fetchStudents();
            if (onDataChanged) onDataChanged();
          }}
        />
      )}
    </div>
  );
};

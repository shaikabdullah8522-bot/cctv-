import React, { useState } from 'react';
import { AttendanceRecord, AttendanceStatus } from '../../types';
import { Shield, AlertCircle, CheckCircle2, Clock, X, Save } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { useGoogleSheets } from '../../context/GoogleSheetsContext';

interface ManualOverrideModalProps {
  isOpen: boolean;
  onClose: () => void;
  record: AttendanceRecord | null;
  onSuccess: () => void;
}

export const ManualOverrideModal: React.FC<ManualOverrideModalProps> = ({
  isOpen,
  onClose,
  record,
  onSuccess,
}) => {
  const { showToast } = useToast();
  const { syncSingleAttendance, syncAuditLog } = useGoogleSheets();
  if (!isOpen || !record) return null;

  const [newStatus, setNewStatus] = useState<AttendanceStatus>(record.final_result || record.status || 'PRESENT');
  const [reason, setReason] = useState(
    record.modification_reason || 'Student was present in classroom; verified manually by teacher.'
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      setErrorMsg('A valid reason is required for administrative audit log.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      const res = await fetch('/api/attendance/manual-override', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: record.student_id,
          date: record.date,
          period_id: record.period_id,
          new_status: newStatus,
          reason: reason.trim(),
          admin_name: 'Prof. Sharma (Admin)',
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update attendance');
      }

      showToast({
        title: 'Override Applied',
        message: `Updated ${record.student_name || 'student'} status to ${newStatus} with audit compliance log.`,
        type: 'success',
      });

      // Synchronize update to Google Sheet
      syncSingleAttendance({
        id: record.id,
        date: record.date,
        period_number: record.period_number || record.period_id,
        roll_number: record.roll_number || '',
        student_name: record.student_name || '',
        class_name: record.class_name,
        section: record.section,
        status: newStatus,
        method: 'Manual Admin Override',
        modified_by: 'Prof. Sharma (Admin)',
        notes: reason.trim(),
      }).catch((e) => console.warn('Google Sheet auto-sync note:', e));

      syncAuditLog({
        id: Date.now(),
        attendance_id: record.id,
        changed_by: 'Prof. Sharma (Admin)',
        student_name: record.student_name,
        roll_number: record.roll_number,
        date: record.date,
        period_number: record.period_number || record.period_id,
        old_status: record.final_result || record.status || 'ABSENT',
        new_status: newStatus,
        reason: reason.trim(),
        changed_at: new Date().toLocaleTimeString(),
      }).catch((e) => console.warn('Google Sheet audit sync note:', e));

      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save change');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden text-slate-900">
        {/* Modal Header */}
        <div className="p-6 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-600">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Manual Attendance Override</h2>
              <p className="text-xs text-slate-500">Administrative correction with compliance audit log</p>
            </div>
          </div>
          <button
            id="btn-close-override-modal"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-6 space-y-5">
          {errorMsg && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Student & Session Info Box */}
          <div className="grid grid-cols-2 gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs">
            <div>
              <span className="text-slate-500">Student:</span>
              <div className="font-bold text-slate-900 text-sm">{record.student_name}</div>
              <div className="text-[11px] font-mono text-slate-500">{record.roll_number}</div>
            </div>
            <div>
              <span className="text-slate-500">Class & Period:</span>
              <div className="font-semibold text-slate-800">
                Period {record.period_number} ({record.period_start_time} - {record.period_end_time})
              </div>
              <div className="text-[11px] text-slate-500">Date: {record.date}</div>
            </div>
          </div>

          {/* AI vs Final Status Comparison */}
          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
            <div>
              <span className="text-slate-500">Original AI Result:</span>
              <div className="font-bold text-slate-700 font-mono mt-0.5 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                <span>{record.ai_result || 'ABSENT'}</span>
              </div>
            </div>
            <div className="text-right">
              <span className="text-slate-500">Current Status:</span>
              <div className="font-bold text-blue-600 font-mono mt-0.5">
                {record.final_result || record.status}
              </div>
            </div>
          </div>

          {/* New Status Selection */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Select Final Attendance Status
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                id="btn-select-status-present"
                onClick={() => setNewStatus('PRESENT')}
                className={`py-2.5 px-3 rounded-xl text-xs font-bold transition flex flex-col items-center gap-1 border ${
                  newStatus === 'PRESENT'
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>PRESENT</span>
              </button>

              <button
                type="button"
                id="btn-select-status-late"
                onClick={() => setNewStatus('LATE')}
                className={`py-2.5 px-3 rounded-xl text-xs font-bold transition flex flex-col items-center gap-1 border ${
                  newStatus === 'LATE'
                    ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <Clock className="w-4 h-4" />
                <span>LATE</span>
              </button>

              <button
                type="button"
                id="btn-select-status-absent"
                onClick={() => setNewStatus('ABSENT')}
                className={`py-2.5 px-3 rounded-xl text-xs font-bold transition flex flex-col items-center gap-1 border ${
                  newStatus === 'ABSENT'
                    ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <X className="w-4 h-4" />
                <span>ABSENT</span>
              </button>
            </div>
          </div>

          {/* Override Reason */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Reason for Override <span className="text-rose-500">*</span>
            </label>
            <textarea
              id="textarea-override-reason"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g., Student was present but CCTV could not detect the face due to lighting/angle."
              required
              className="w-full p-3 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              This explanation is permanently logged in the audit trail with timestamp and admin signature.
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              id="btn-cancel-override"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              id="btn-save-override"
              disabled={isSubmitting}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-sm transition flex items-center gap-2 disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'Recording Change...' : 'Save Change & Log'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

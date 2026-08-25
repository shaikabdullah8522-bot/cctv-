import React, { useState, useEffect, useCallback } from 'react';
import { ConsecutiveAbsenceAlert, AttendanceStatus } from '../../types';
import {
  AlertTriangle,
  Bell,
  BellRing,
  ShieldAlert,
  CheckCircle2,
  ChevronRight,
  Clock,
  UserX,
  Volume2,
  VolumeX,
  RefreshCw,
  Sparkles,
  X,
  FileCheck,
} from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { getConsecutiveAbsences } from '../../services/apiClient';

interface ConsecutiveAbsenceAlertBannerProps {
  currentDateStr: string;
  onRefreshAttendance?: () => void;
}

// Synthesized urgent siren chime via Web Audio API
function playConsecutiveAbsenceSiren() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(880, ctx.currentTime); // A5
    osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.3); // Drop to A4
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.6); // Rise to A5

    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.65);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.7);
  } catch (e) {
    console.debug('Audio siren prevented or unsupported');
  }
}

export const ConsecutiveAbsenceAlertBanner: React.FC<ConsecutiveAbsenceAlertBannerProps> = ({
  currentDateStr,
  onRefreshAttendance,
}) => {
  const { showToast } = useToast();
  const [alerts, setAlerts] = useState<ConsecutiveAbsenceAlert[]>([]);
  const [loading, setLoading] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [dismissedStudentIds, setDismissedStudentIds] = useState<Record<number, boolean>>({});
  const [reviewedStudents, setReviewedStudents] = useState<Record<number, boolean>>({});
  const [isSimulating, setIsSimulating] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);

  // Native Web Notifications API Request & Trigger
  const requestNotificationPermission = useCallback(async () => {
    if ('Notification' in window && Notification.permission === 'default') {
      try {
        await Notification.requestPermission();
      } catch (e) {
        console.debug('Notification permission request error:', e);
      }
    }
  }, []);

  const dispatchBrowserNotification = useCallback((alert: ConsecutiveAbsenceAlert) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        const periodList = alert.consecutive_periods.map((p) => `P${p.period_number}`).join(', ');
        new Notification(`🚨 CRITICAL: ${alert.consecutive_count} Consecutive Absences!`, {
          body: `${alert.student_name} (${alert.roll_number}) is absent for ${alert.consecutive_count} consecutive periods (${periodList}) today. Immediate administrative review recommended.`,
          icon: '/favicon.ico',
        });
      } catch (e) {
        console.debug('Browser notification push failed:', e);
      }
    }
  }, []);

  const fetchConsecutiveAbsences = useCallback(async () => {
    try {
      const data = await getConsecutiveAbsences(currentDateStr, 3);
      const incomingAlerts: ConsecutiveAbsenceAlert[] = (data || []).filter(
        (a: ConsecutiveAbsenceAlert) => !dismissedStudentIds[a.student_id]
      );

      // If new critical alerts arrived that weren't in previous state, play chime & notify
      if (incomingAlerts.length > 0) {
        if (soundEnabled) {
          playConsecutiveAbsenceSiren();
        }

        // Trigger native browser notification
        if ('Notification' in window && Notification.permission === 'granted') {
          incomingAlerts.forEach((a) => {
            dispatchBrowserNotification(a);
          });
        }
      }

      setAlerts(incomingAlerts);
    } catch (err) {
      console.debug('Consecutive absence notice:', err);
    } finally {
      setLoading(false);
    }
  }, [currentDateStr, dismissedStudentIds, soundEnabled, dispatchBrowserNotification]);

  useEffect(() => {
    fetchConsecutiveAbsences();
    const interval = setInterval(fetchConsecutiveAbsences, 15000); // Check every 15s
    return () => clearInterval(interval);
  }, [fetchConsecutiveAbsences]);

  // Mark student alert as reviewed
  const handleReviewAlert = (alert: ConsecutiveAbsenceAlert) => {
    setReviewedStudents((prev) => ({ ...prev, [alert.student_id]: true }));
    showToast({
      title: 'Alert Acknowledged',
      message: `Flagged ${alert.student_name} (${alert.roll_number}) for academic counselor review.`,
      type: 'info',
    });
  };

  const handleDismissAlert = (studentId: number) => {
    setDismissedStudentIds((prev) => ({ ...prev, [studentId]: true }));
    setAlerts((prev) => prev.filter((a) => a.student_id !== studentId));
  };

  if (alerts.length === 0) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm text-slate-300">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-xl">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white tracking-tight">Consecutive Absence Sentinel</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  ALL CLEAR
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Monitoring students for ≥3 consecutive missed periods on {currentDateStr}. Zero critical streaks detected.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-r from-rose-950 via-slate-900 to-amber-950 border-2 border-rose-500/60 rounded-2xl p-5 shadow-2xl text-white relative overflow-hidden animate-pulse-slow">
      {/* Background glowing beacon effect */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-rose-600/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-rose-500/20 relative z-10">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-rose-600 text-white rounded-xl shadow-lg animate-bounce shrink-0">
            <BellRing className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-lg font-extrabold text-white tracking-tight uppercase">
                Critical Consecutive Absence Sentinel Alert
              </h3>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-rose-500 text-white shadow-sm">
                {alerts.length} STUDENT{alerts.length === 1 ? '' : 'S'} AT RISK
              </span>
            </div>
            <p className="text-xs text-rose-200/80 mt-0.5">
              Detected students missing <strong>≥ 3 consecutive academic periods</strong> on {currentDateStr}.
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2 self-end sm:self-auto flex-wrap">
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`p-2 rounded-xl text-xs font-medium border transition ${
              soundEnabled
                ? 'bg-rose-500/20 border-rose-500/40 text-rose-300'
                : 'bg-slate-800 border-slate-700 text-slate-400'
            }`}
            title={soundEnabled ? 'Mute alert chime' : 'Enable audio chime'}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          <button
            onClick={fetchConsecutiveAbsences}
            className="p-2 bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-xl text-xs font-medium transition"
            title="Refresh alerts"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="px-3 py-1.5 bg-slate-800/90 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold transition"
          >
            {isExpanded ? 'Collapse' : `View ${alerts.length} Alerts`}
          </button>
        </div>
      </div>

      {/* Expanded Student Cards */}
      {isExpanded && (
        <div className="mt-4 space-y-3 relative z-10">
          {alerts.map((alert) => {
            const isReviewed = reviewedStudents[alert.student_id];

            return (
              <div
                key={alert.student_id}
                className="bg-slate-900/90 border border-rose-500/30 rounded-xl p-4 transition-all hover:border-rose-400"
              >
                <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                  {/* Student Identity & Stats */}
                  <div className="flex items-start gap-3.5">
                    <div className="w-12 h-12 rounded-xl bg-rose-500/20 text-rose-300 border border-rose-500/40 font-bold flex items-center justify-center text-base shrink-0">
                      <UserX className="w-6 h-6" />
                    </div>

                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-base font-bold text-white">{alert.student_name}</span>
                        <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                          {alert.roll_number}
                        </span>
                        <span className="text-xs text-rose-300 font-semibold">
                          {alert.class_name} ({alert.section})
                        </span>
                      </div>

                      {/* Missed Periods Pills */}
                      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                        <span className="text-[11px] text-slate-400 font-medium mr-1">Missed Periods:</span>
                        {alert.consecutive_periods.map((p, idx) => (
                          <div
                            key={p.period_id || idx}
                            className="flex items-center gap-1 px-2.5 py-1 bg-rose-500/15 border border-rose-500/30 rounded-lg text-rose-200 text-xs font-medium"
                          >
                            <Clock className="w-3 h-3 text-rose-400" />
                            <span className="font-bold">Period {p.period_number}</span>
                            <span className="text-[10px] text-rose-300 font-mono">({p.start_time}-{p.end_time})</span>
                            <span className="text-[10px] px-1 rounded bg-rose-600/40 text-white font-bold uppercase">
                              ABSENT
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap items-center gap-2.5 lg:self-center shrink-0">
                    <button
                      id={`btn-review-alert-${alert.student_id}`}
                      onClick={() => handleReviewAlert(alert)}
                      className={`flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-bold shadow-md transition ${
                        isReviewed
                          ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/40'
                          : 'bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white'
                      }`}
                    >
                      {isReviewed ? (
                        <>
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          <span>Reviewed &amp; Acknowledged</span>
                        </>
                      ) : (
                        <>
                          <FileCheck className="w-4 h-4" />
                          <span>Acknowledge / Flag for Review</span>
                        </>
                      )}
                    </button>

                    <button
                      id={`btn-dismiss-alert-${alert.student_id}`}
                      onClick={() => handleDismissAlert(alert.student_id)}
                      className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700 rounded-xl transition"
                      title="Dismiss alert banner"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { StudentAttendanceSummary, Period } from '../../types';
import {
  Calendar as CalendarIcon,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  User,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Percent,
  Check,
  Info,
  Shield,
  GraduationCap,
  Download,
  Sparkles,
  Layers,
  ShieldCheck,
  Coffee,
  PartyPopper,
} from 'lucide-react';
import { AIStudentAdvisoryCard } from './AIStudentAdvisoryCard';
import { BMETimetableSchedule } from '../timetable/BMETimetableSchedule';

interface StudentDashboardProps {
  currentDateStr: string;
}

export const StudentDashboard: React.FC<StudentDashboardProps> = ({ currentDateStr }) => {
  const { user } = useAuth();
  const now = new Date();
  const [studentTab, setStudentTab] = useState<'attendance' | 'timetable'>('attendance');
  const [summary, setSummary] = useState<StudentAttendanceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string>(currentDateStr || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`);
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [allPeriods, setAllPeriods] = useState<Period[]>([]);

  const fetchStudentData = async () => {
    if (!user || user.id === undefined) return;
    setLoading(true);
    try {
      const sId = user.id > 0 ? user.id : 1;
      const [resSummary, resPeriods] = await Promise.all([
        fetch(`/api/attendance/student/${sId}`),
        fetch('/api/periods'),
      ]);

      if (resSummary.ok) {
        const data = await resSummary.json();
        setSummary(data);
      }
      if (resPeriods.ok) {
        const periodsData = await resPeriods.json();
        setAllPeriods(periodsData);
      }
    } catch (err) {
      console.error('Failed to load student data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudentData();
  }, [user]);

  if (loading || !summary) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-sm text-slate-500 font-medium">Loading student attendance portal...</span>
        </div>
      </div>
    );
  }

  // Days in month calculation
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDayIndex = new Date(viewYear, viewMonth, 1).getDay(); // 0 = Sunday
  const adjustedFirstDay = (firstDayIndex + 6) % 7;

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  const selectedDayData = summary.calendar_dates[selectedDate];

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Student Profile & Quick Info Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 font-bold text-xl shadow-sm">
              {summary.student.name.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl font-bold text-slate-900">{summary.student.name}</h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-slate-100 text-slate-700 border border-slate-200">
                  {summary.student.roll_number}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1 flex items-center gap-2">
                <span>{summary.student.class_name}</span>
                <span>•</span>
                <span>Section {summary.student.section}</span>
              </p>
            </div>
          </div>

          {/* Overall Percentage Badge & Actions */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-4 bg-slate-50 border border-slate-200 p-3.5 rounded-xl">
              <div>
                <div className="text-xs text-slate-500 font-medium">Overall Attendance Rate</div>
                <div className="text-2xl font-black tracking-tight flex items-baseline gap-1">
                  <span className={summary.attendance_percentage >= summary.min_required_percentage ? 'text-emerald-600' : 'text-rose-600'}>
                    {summary.attendance_percentage}%
                  </span>
                </div>
              </div>
              <div className="h-10 w-px bg-slate-200"></div>
              <div className="text-xs text-slate-600">
                <div>Required: <span className="font-bold text-slate-900">{summary.min_required_percentage}%</span></div>
                <div className="text-[11px] font-medium mt-0.5">
                  {summary.attendance_percentage >= summary.min_required_percentage ? (
                    <span className="text-emerald-600">✓ Good Standing</span>
                  ) : (
                    <span className="text-rose-600 font-bold">⚠️ Below Threshold</span>
                  )}
                </div>
              </div>
            </div>

            <button
              id="btn-export-student-csv"
              onClick={() => {
                window.location.href = `/api/attendance/export-student-csv?student_id=${summary.student.id}`;
              }}
              className="flex items-center gap-1.5 px-3.5 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-sm transition"
              title="Download your full semester attendance logs as CSV"
            >
              <Download className="w-4 h-4" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* Low Attendance Warning Alert */}
        {summary.is_low_attendance && (
          <div className="mt-5 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-sm text-rose-900">
                Attendance Warning: Your attendance is below the required percentage.
              </h4>
              <p className="text-xs text-rose-700 mt-1">
                Your current attendance is {summary.attendance_percentage}%, which is below the institution's required minimum of {summary.min_required_percentage}%. Please attend upcoming classes to meet the semester requirement.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Student View Switcher */}
      <div className="flex items-center gap-2 bg-slate-200/70 p-1 rounded-xl w-fit">
        <button
          type="button"
          id="btn-student-tab-attendance"
          onClick={() => setStudentTab('attendance')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition ${
            studentTab === 'attendance'
              ? 'bg-white text-blue-600 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <CalendarIcon className="w-4 h-4" />
          <span>My Attendance & Calendar</span>
        </button>

        <button
          type="button"
          id="btn-student-tab-timetable"
          onClick={() => setStudentTab('timetable')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition ${
            studentTab === 'timetable'
              ? 'bg-white text-blue-600 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>BME Semester 3 Timetable & Faculty</span>
        </button>
      </div>

      {studentTab === 'timetable' ? (
        <BMETimetableSchedule isAdmin={false} />
      ) : (
        <>

      {/* Attendance Metric Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
            Total Periods
          </div>
          <div className="text-2xl font-bold text-slate-900 font-mono">{summary.total_periods}</div>
          <div className="text-[11px] text-slate-500 mt-1">Conducted to date</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <div className="text-xs font-bold text-emerald-600 uppercase tracking-wider mb-1">
            Present Periods
          </div>
          <div className="text-2xl font-bold text-emerald-600 font-mono">{summary.present_periods}</div>
          <div className="text-[11px] text-emerald-600 font-medium mt-1">Verified via CCTV AI</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <div className="text-xs font-bold text-amber-600 uppercase tracking-wider mb-1">
            Late Arrivals
          </div>
          <div className="text-2xl font-bold text-amber-600 font-mono">{summary.late_periods}</div>
          <div className="text-[11px] text-amber-600 font-medium mt-1">After grace period</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <div className="text-xs font-bold text-rose-500 uppercase tracking-wider mb-1">
            Absent Periods
          </div>
          <div className="text-2xl font-bold text-rose-600 font-mono">{summary.absent_periods}</div>
          <div className="text-[11px] text-rose-500 font-medium mt-1">Unrecorded / missed</div>
        </div>
      </div>

      {/* Gemini Student Academic Advisory & Predictor */}
      <AIStudentAdvisoryCard studentId={summary.student.id} />

      {/* Main Interactive Grid: Calendar & Period Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Calendar Section (7 Cols) */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <CalendarIcon className="w-5 h-5 text-blue-600" />
              <h2 className="text-base sm:text-lg font-bold text-slate-900 uppercase tracking-wider">
                {monthNames[viewMonth]} {viewYear}
              </h2>
            </div>

            <div className="flex items-center gap-2">
              <button
                id="btn-prev-month"
                onClick={() => setViewMonth((prev) => (prev === 0 ? 11 : prev - 1))}
                className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs font-bold px-2 text-slate-700">
                {monthNames[viewMonth].slice(0, 3)}
              </span>
              <button
                id="btn-next-month"
                onClick={() => setViewMonth((prev) => (prev === 11 ? 0 : prev + 1))}
                className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Calendar Weekday Header */}
          <div className="grid grid-cols-7 gap-2 mb-2 text-center text-xs font-bold text-slate-400">
            <div>Mon</div>
            <div>Tue</div>
            <div>Wed</div>
            <div>Thu</div>
            <div>Fri</div>
            <div className="text-slate-400">Sat</div>
            <div className="text-slate-400">Sun</div>
          </div>

          {/* Calendar Days Grid */}
          <div className="grid grid-cols-7 gap-2">
            {/* Blank offset boxes */}
            {Array.from({ length: adjustedFirstDay }).map((_, i) => (
              <div key={`blank-${i}`} className="h-14 rounded-xl bg-slate-50 border border-transparent"></div>
            ))}

            {/* Days in Month */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const dayNum = i + 1;
              const dayStr = dayNum < 10 ? `0${dayNum}` : `${dayNum}`;
              const monthStr = viewMonth + 1 < 10 ? `0${viewMonth + 1}` : `${viewMonth + 1}`;
              const fullDateStr = `${viewYear}-${monthStr}-${dayStr}`;

              const dayRecord = summary.calendar_dates[fullDateStr];
              const isSelected = selectedDate === fullDateStr;

              // Color indicators per Professional Polish standard:
              // GREEN: Attendance recorded / present
              // AMBER: Institutional Holiday (Exempt)
              // PURPLE: Examination Day
              // RED: Absent
              // GREY: No class / no records
              let indicatorColor = 'bg-slate-50 text-slate-400 border-slate-200';
              let badgeDot = 'bg-slate-300';
              const calEvent = dayRecord?.calendar_event || dayRecord?.event;

              if (calEvent || dayRecord?.is_non_instructional) {
                const dayType = calEvent?.day_type || dayRecord?.status;
                if (dayType === 'HOLIDAY') {
                  indicatorColor = 'bg-amber-50 text-amber-900 border-amber-300 font-semibold shadow-xs';
                  badgeDot = 'bg-amber-500';
                } else if (dayType === 'EXAM_DAY') {
                  indicatorColor = 'bg-purple-50 text-purple-900 border-purple-300 font-semibold shadow-xs';
                  badgeDot = 'bg-purple-500';
                } else if (dayType === 'COLLEGE_FEST') {
                  indicatorColor = 'bg-emerald-50 text-emerald-900 border-emerald-300 font-semibold shadow-xs';
                  badgeDot = 'bg-emerald-500';
                } else if (dayType === 'SEMESTER_BREAK') {
                  indicatorColor = 'bg-slate-200 text-slate-900 border-slate-400 font-semibold shadow-xs';
                  badgeDot = 'bg-slate-500';
                }
              } else if (dayRecord) {
                if (dayRecord.status === 'PRESENT') {
                  indicatorColor = 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:border-emerald-400';
                  badgeDot = 'bg-emerald-500';
                } else if (dayRecord.status === 'PARTIAL') {
                  indicatorColor = 'bg-emerald-50/70 text-emerald-800 border-emerald-200 hover:border-emerald-400';
                  badgeDot = 'bg-emerald-500';
                } else if (dayRecord.status === 'ABSENT') {
                  indicatorColor = 'bg-rose-50 text-rose-800 border-rose-200 hover:border-rose-400';
                  badgeDot = 'bg-rose-500';
                }
              }

              return (
                <button
                  key={fullDateStr}
                  id={`btn-calendar-day-${fullDateStr}`}
                  onClick={() => setSelectedDate(fullDateStr)}
                  className={`h-14 p-1.5 rounded-xl border flex flex-col justify-between text-left transition relative ${indicatorColor} ${
                    isSelected ? 'ring-2 ring-blue-600 ring-offset-2 z-10 shadow-md bg-blue-50/50' : ''
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className={`text-xs font-bold font-mono ${isSelected ? 'text-blue-900' : ''}`}>
                      {dayNum}
                    </span>
                    <span className={`w-2 h-2 rounded-full ${badgeDot}`}></span>
                  </div>

                  <div className="text-[9px] font-medium leading-none truncate opacity-85">
                    {calEvent ? (
                      <span className="font-semibold">{calEvent.title}</span>
                    ) : dayRecord && dayRecord.total > 0 ? (
                      `${dayRecord.present}/${dayRecord.total} Per.`
                    ) : (
                      ''
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Calendar Indicators Legend */}
          <div className="mt-6 pt-4 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-5 gap-2.5 text-xs text-slate-500">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
              <span className="font-medium text-slate-700">Present</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-amber-500"></span>
              <span className="font-medium text-amber-800 font-semibold">Holiday (Exempt)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-purple-500"></span>
              <span className="font-medium text-purple-800 font-semibold">Exam Day</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-rose-500"></span>
              <span className="font-medium text-slate-700">Absent</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-slate-300"></span>
              <span className="font-medium text-slate-500">No Class</span>
            </div>
          </div>
        </div>

        {/* Date Details & Period-Wise Breakdown (5 Cols) */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Selected Date
                </span>
                <h3 className="text-base font-bold text-slate-900">
                  {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </h3>
              </div>

              {selectedDayData && (
                <div className="text-right">
                  <span className="text-[11px] text-slate-500">Daily Attendance</span>
                  <div className="text-base font-bold text-emerald-600 font-mono">
                    {selectedDayData.present + selectedDayData.late} / {selectedDayData.total} periods
                  </div>
                </div>
              )}
            </div>

            {/* Academic Event / Holiday / Exam Day Banner in Day Inspector */}
            {(() => {
              const calEvent = selectedDayData?.calendar_event || selectedDayData?.event;
              if (!calEvent) return null;

              const isHoliday = calEvent.day_type === 'HOLIDAY';
              const isExam = calEvent.day_type === 'EXAM_DAY';

              return (
                <div
                  className={`p-4 rounded-xl border mb-4 ${
                    isHoliday
                      ? 'bg-amber-50 border-amber-300 text-amber-900'
                      : isExam
                      ? 'bg-purple-50 border-purple-300 text-purple-900'
                      : 'bg-emerald-50 border-emerald-300 text-emerald-900'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-base">{isHoliday ? '🏖️' : isExam ? '📝' : '🎪'}</span>
                    <span className="font-bold text-xs uppercase tracking-wide">
                      {calEvent.day_type.replace('_', ' ')}
                    </span>
                    <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/90 border shadow-2xs">
                      Attendance Exempt
                    </span>
                  </div>
                  <h4 className="font-bold text-sm text-slate-900">{calEvent.title}</h4>
                  {calEvent.description && (
                    <p className="text-xs mt-1 text-slate-700 leading-relaxed">{calEvent.description}</p>
                  )}
                  <div className="mt-2 text-[11px] text-emerald-800 font-semibold flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>No unexcused absence recorded for this date.</span>
                  </div>
                </div>
              );
            })()}

            {/* Period List */}
            {selectedDayData && selectedDayData.periods.length > 0 ? (
              <div className="space-y-2.5">
                {selectedDayData.periods.map((p) => {
                  let statusBg = 'bg-slate-50 border-slate-200';
                  let statusText = 'text-slate-500';
                  let statusIcon = null;

                  if (p.status === 'PRESENT') {
                    statusBg = 'bg-emerald-50/60 border-emerald-200';
                    statusText = 'text-emerald-700';
                    statusIcon = <CheckCircle className="w-4 h-4 text-emerald-600" />;
                  } else if (p.status === 'LATE') {
                    statusBg = 'bg-amber-50/60 border-amber-200';
                    statusText = 'text-amber-700';
                    statusIcon = <Clock className="w-4 h-4 text-amber-600" />;
                  } else {
                    statusBg = 'bg-rose-50/60 border-rose-200';
                    statusText = 'text-rose-700';
                    statusIcon = <XCircle className="w-4 h-4 text-rose-600" />;
                  }

                  return (
                    <div
                      key={p.period_number}
                      className={`p-3.5 rounded-xl border flex items-center justify-between transition ${statusBg}`}
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-slate-900">
                            Period {p.period_number}
                          </span>
                          <span className="text-xs text-slate-500 font-mono">
                            {p.start_time} - {p.end_time}
                          </span>
                        </div>

                        {p.is_manual && (
                          <div className="flex items-center gap-1 text-[10px] text-blue-700 mt-1">
                            <span className="px-1.5 py-0.2 bg-blue-100 rounded font-bold">MANUAL</span>
                            <span className="truncate max-w-[200px]" title={p.modification_reason}>
                              • {p.modification_reason}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="text-right">
                          <div className={`text-xs font-bold font-mono ${statusText}`}>
                            {p.status}
                          </div>
                          <div className="text-[10px] text-slate-400 font-medium">
                            {p.is_manual ? 'Teacher Verified' : 'CCTV AI'}
                          </div>
                        </div>
                        {statusIcon}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 text-slate-500 text-xs">
                <Info className="w-6 h-6 mx-auto mb-2 text-slate-400" />
                <p>No timetable periods scheduled for this date (Weekend / Holiday).</p>
              </div>
            )}
          </div>

          {/* Student Policy Notice */}
          <div className="mt-6 pt-4 border-t border-slate-100 text-[11px] text-slate-500 flex items-start gap-2">
            <Info className="w-4 h-4 shrink-0 text-slate-400 mt-0.5" />
            <span>
              Attendance is recorded automatically via classroom CCTV AI at the beginning of each period. In case of discrepancies, contact your class coordinator for manual verification.
            </span>
          </div>
        </div>
      </div>
        </>
      )}
    </div>
  );
};

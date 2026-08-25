import React, { useState, useEffect } from 'react';
import { TimetableSlot, FacultyMember, Period } from '../../types';
import {
  Calendar,
  Clock,
  BookOpen,
  User,
  MapPin,
  Sparkles,
  Info,
  CheckCircle2,
  Edit3,
  Layers,
  GraduationCap,
  FlaskConical,
  Coffee,
  Download,
  Filter,
} from 'lucide-react';

interface BMETimetableScheduleProps {
  isAdmin?: boolean;
  onSelectPeriodForAttendance?: (periodNumber: number) => void;
}

export const BMETimetableSchedule: React.FC<BMETimetableScheduleProps> = ({
  isAdmin = false,
  onSelectPeriodForAttendance,
}) => {
  const [slots, setSlots] = useState<TimetableSlot[]>([]);
  const [faculty, setFaculty] = useState<FacultyMember[]>([]);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<string>('ALL'); // 'ALL' | 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT'
  const [selectedSlot, setSelectedSlot] = useState<TimetableSlot | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editFormData, setEditFormData] = useState<Partial<TimetableSlot>>({});

  // Fetch timetable data from server
  const fetchTimetable = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/timetable');
      if (res.ok) {
        const data = await res.json();
        setSlots(data.slots || []);
        setFaculty(data.faculty || []);
        setPeriods(data.periods || []);
      }
    } catch (err) {
      console.error('Failed to load timetable:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTimetable();
  }, []);

  // Real-time clock and active period engine
  const [realClock, setRealClock] = useState<{
    day: 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT';
    periodNumber: number;
    isLive: boolean;
    timeStr: string;
    statusLabel: string;
  }>({
    day: 'MON',
    periodNumber: 1,
    isLive: false,
    timeStr: '',
    statusLabel: 'Standby',
  });

  useEffect(() => {
    const updateRealTiming = () => {
      const now = new Date();
      const dayIdx = now.getDay();
      const dayMap: Record<number, 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT'> = {
        1: 'MON',
        2: 'TUE',
        3: 'WED',
        4: 'THU',
        5: 'FRI',
        6: 'SAT',
      };
      const currentDay = dayMap[dayIdx] || 'MON';
      const curTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });

      const livePeriod = periods.find((p) => p.active === 1 && p.start_time <= curTime && curTime < p.end_time);
      if (livePeriod) {
        setRealClock({
          day: currentDay,
          periodNumber: livePeriod.period_number,
          isLive: true,
          timeStr,
          statusLabel: `Period ${livePeriod.period_number} (${livePeriod.start_time} - ${livePeriod.end_time})`,
        });
      } else {
        const upcoming = periods.find((p) => p.active === 1 && p.start_time > curTime);
        if (upcoming) {
          setRealClock({
            day: currentDay,
            periodNumber: upcoming.period_number,
            isLive: false,
            timeStr,
            statusLabel: `Upcoming: Period ${upcoming.period_number} (${upcoming.start_time})`,
          });
        } else {
          setRealClock({
            day: currentDay,
            periodNumber: periods.length > 0 ? periods[0].period_number : 1,
            isLive: false,
            timeStr,
            statusLabel: curTime >= '15:10' ? 'Classes Ended for Today' : 'Schedule Standby',
          });
        }
      }
    };

    updateRealTiming();
    const interval = setInterval(updateRealTiming, 1000);
    return () => clearInterval(interval);
  }, [periods]);

  // Helper to retrieve slot for a given day and period
  const getSlot = (day: string, pNum: number): TimetableSlot | undefined => {
    return slots.find((s) => s.day_of_week === day && s.period_number === pNum);
  };

  const currentDemoDay = realClock.day;
  const currentDemoPeriod = realClock.periodNumber;
  const activeSlot = getSlot(currentDemoDay, currentDemoPeriod);

  const days: Array<{ key: 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT'; label: string; full: string }> = [
    { key: 'MON', label: 'MON', full: 'Monday' },
    { key: 'TUE', label: 'TUE', full: 'Tuesday' },
    { key: 'WED', label: 'WED', full: 'Wednesday' },
    { key: 'THU', label: 'THU', full: 'Thursday' },
    { key: 'FRI', label: 'FRI', full: 'Friday' },
    { key: 'SAT', label: 'SAT', full: 'Saturday' },
  ];

  const handleEditSlot = (slot: TimetableSlot) => {
    setSelectedSlot(slot);
    setEditFormData({
      day_of_week: slot.day_of_week,
      period_number: slot.period_number,
      subject_code: slot.subject_code,
      subject_name: slot.subject_name,
      teacher_code: slot.teacher_code,
      teacher_name: slot.teacher_name,
      room_or_lab: slot.room_or_lab,
      is_lab: slot.is_lab,
    });
    setIsEditModalOpen(true);
  };

  const handleSaveSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/timetable/slot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editFormData),
      });
      if (res.ok) {
        setIsEditModalOpen(false);
        fetchTimetable();
      }
    } catch (err) {
      console.error('Failed to save slot:', err);
    }
  };

  const getSubjectColorStyles = (slot?: TimetableSlot) => {
    if (!slot) return 'bg-slate-50 text-slate-400 border-slate-200';
    if (slot.is_lab) {
      return 'bg-emerald-50 text-emerald-900 border-emerald-300 hover:bg-emerald-100/90';
    }
    return 'bg-sky-50 text-sky-950 border-sky-300 hover:bg-sky-100/90';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px] bg-white border border-slate-200 rounded-2xl p-8 shadow-sm">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-xs text-slate-500 font-medium">Loading BME Dept. Semester 3 Timetable...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Timetable Header Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-md">
              <Calendar className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
                  BME DEPT. SEMESTER 3 TIME TABLE (2025-2026)
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                  BRANCH: 3 SEM
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Active Schedule
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Department of Biomedical Engineering • Academic Year 2025-2026 • Automated CCTV Recognition Sync
              </p>
            </div>
          </div>

          {/* Quick Filters */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setSelectedDay('ALL')}
                className={`px-3 py-1.5 rounded-lg transition ${
                  selectedDay === 'ALL'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Full Week Grid
              </button>
              {days.map((d) => (
                <button
                  key={d.key}
                  type="button"
                  onClick={() => setSelectedDay(d.key)}
                  className={`px-2.5 py-1.5 rounded-lg transition ${
                    selectedDay === d.key
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Live Ongoing Period Bar */}
        <div className="mt-5 p-3.5 rounded-xl bg-gradient-to-r from-blue-50 via-indigo-50/50 to-emerald-50 border border-blue-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-lg ${realClock.isLive ? 'bg-emerald-600' : 'bg-blue-600'} text-white flex items-center justify-center font-bold shadow-xs`}>
              {activeSlot?.period_label || realClock.periodNumber}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900">
                  {realClock.statusLabel}
                </span>
                <span className={`text-[10px] uppercase font-mono px-2 py-0.5 rounded font-bold ${
                  realClock.isLive ? 'bg-emerald-100 text-emerald-800 animate-pulse' : 'bg-blue-100 text-blue-700'
                }`}>
                  {currentDemoDay} {realClock.isLive ? 'Live Active' : 'Scheduled'}
                </span>
                {realClock.timeStr && (
                  <span className="text-[11px] font-mono text-slate-500 font-medium">
                    ({realClock.timeStr})
                  </span>
                )}
              </div>
              <div className="text-slate-600 font-medium mt-0.5 flex flex-wrap items-center gap-2 sm:gap-3">
                {activeSlot ? (
                  <>
                    <span className="text-blue-700 font-bold">{activeSlot.subject_name} ({activeSlot.subject_code})</span>
                    <span>• Faculty: {activeSlot.teacher_name} ({activeSlot.teacher_code})</span>
                    <span>• Room/Lab: {activeSlot.room_or_lab}</span>
                  </>
                ) : (
                  <span>No scheduled class in this slot or break time</span>
                )}
              </div>
            </div>
          </div>

          {onSelectPeriodForAttendance && (
            <button
              type="button"
              id="btn-take-attendance-current"
              onClick={() => onSelectPeriodForAttendance(realClock.periodNumber)}
              className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-sm transition flex items-center gap-1.5 whitespace-nowrap self-start sm:self-auto"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Mark Attendance for Period {realClock.periodNumber}</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Timetable Matrix View */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-bold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-blue-600" />
              <span>Official BME Timetable Master Grid</span>
            </span>
            <div className="flex items-center gap-2 text-[11px]">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-sky-100 text-sky-800 border border-sky-200 font-medium">
                <span className="w-2 h-2 rounded bg-sky-400"></span> Theory Lecture
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200 font-medium">
                <span className="w-2 h-2 rounded bg-emerald-400"></span> Practical / Lab
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200 font-medium">
                <Coffee className="w-3 h-3 text-amber-600" /> Lunch Break (12:50 - 1:30)
              </span>
            </div>
          </div>

          <div className="text-[11px] text-slate-500 font-mono">
            Updated for 2025-2026 Academic Year
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-center border-collapse">
            <thead>
              <tr className="bg-slate-100/80 border-b border-slate-300 text-slate-700 text-xs font-bold uppercase tracking-wider">
                <th className="py-3.5 px-4 border-r border-slate-300 w-20">DAY</th>
                <th className="py-3.5 px-3 border-r border-slate-300 w-20">BRANCH</th>
                <th className="py-3.5 px-3 border-r border-slate-300 min-w-[130px]">
                  <div className="text-slate-900 font-bold">9:30 - 10:20</div>
                  <div className="text-[11px] text-blue-700 font-mono">I</div>
                </th>
                <th className="py-3.5 px-3 border-r border-slate-300 min-w-[130px]">
                  <div className="text-slate-900 font-bold">10:20 - 11:10</div>
                  <div className="text-[11px] text-blue-700 font-mono">II</div>
                </th>
                <th className="py-3.5 px-3 border-r border-slate-300 min-w-[130px]">
                  <div className="text-slate-900 font-bold">11:10 - 12:00</div>
                  <div className="text-[11px] text-blue-700 font-mono">III</div>
                </th>
                <th className="py-3.5 px-3 border-r border-slate-300 min-w-[130px]">
                  <div className="text-slate-900 font-bold">12:00 - 12:50</div>
                  <div className="text-[11px] text-blue-700 font-mono">IV</div>
                </th>
                <th className="py-3.5 px-2 border-r border-amber-300 bg-amber-50 text-amber-900 w-16 text-[11px]">
                  <div>12:50 - 1:30</div>
                  <div className="text-[10px] font-bold text-amber-700">LUNCH</div>
                </th>
                <th className="py-3.5 px-3 border-r border-slate-300 min-w-[130px]">
                  <div className="text-slate-900 font-bold">1:30 - 2:20</div>
                  <div className="text-[11px] text-blue-700 font-mono">VI</div>
                </th>
                <th className="py-3.5 px-3 min-w-[130px]">
                  <div className="text-slate-900 font-bold">2:20 - 3:10</div>
                  <div className="text-[11px] text-blue-700 font-mono">VII</div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs">
              {days
                .filter((d) => selectedDay === 'ALL' || selectedDay === d.key)
                .map((day) => {
                  const isCurrentDay = day.key === currentDemoDay;

                  // Grab slots for this day
                  const s1 = getSlot(day.key, 1);
                  const s2 = getSlot(day.key, 2);
                  const s3 = getSlot(day.key, 3);
                  const s4 = getSlot(day.key, 4);
                  const s5 = getSlot(day.key, 5); // VI
                  const s6 = getSlot(day.key, 6); // VII

                  return (
                    <tr
                      key={day.key}
                      className={`transition ${isCurrentDay ? 'bg-blue-50/20 ring-1 ring-blue-500/20' : 'hover:bg-slate-50/50'}`}
                    >
                      {/* Day Label */}
                      <td className="py-4 px-3 font-bold text-slate-900 border-r border-slate-300 bg-slate-50">
                        <div className="flex flex-col items-center">
                          <span className="text-sm font-extrabold">{day.label}</span>
                          {isCurrentDay && (
                            <span className="text-[9px] px-1.5 py-0.2 bg-blue-600 text-white font-bold rounded-full uppercase mt-1">
                              Today
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Branch */}
                      <td className="py-4 px-2 font-bold text-slate-700 border-r border-slate-300 bg-slate-50/50 text-[11px]">
                        3 SEM
                      </td>

                      {/* Specific Day Custom Spans for Visual Parity with Uploaded Timetable */}
                      {day.key === 'MON' && (
                        <>
                          {/* MON Period 1: BHAP (AJ) */}
                          <td className="p-2 border-r border-slate-300">
                            <SlotCard slot={s1} isCurrent={isCurrentDay && currentDemoPeriod === 1} onEdit={isAdmin ? () => s1 && handleEditSlot(s1) : undefined} />
                          </td>
                          {/* MON Periods 2,3,4: Merged Eng. Lab (HU-310) */}
                          <td colSpan={3} className="p-2 border-r border-slate-300">
                            <SlotCard slot={s2} spanText="Periods II, III, IV (10:20 - 12:50)" isCurrent={isCurrentDay && [2, 3, 4].includes(currentDemoPeriod)} onEdit={isAdmin ? () => s2 && handleEditSlot(s2) : undefined} />
                          </td>
                          {/* Lunch Break */}
                          <LunchCell />
                          {/* MON Period 5 (VI): NA (RR) */}
                          <td className="p-2 border-r border-slate-300">
                            <SlotCard slot={s5} isCurrent={isCurrentDay && currentDemoPeriod === 5} onEdit={isAdmin ? () => s5 && handleEditSlot(s5) : undefined} />
                          </td>
                          {/* MON Period 6 (VII): LICA (RR) */}
                          <td className="p-2">
                            <SlotCard slot={s6} isCurrent={isCurrentDay && currentDemoPeriod === 6} onEdit={isAdmin ? () => s6 && handleEditSlot(s6) : undefined} />
                          </td>
                        </>
                      )}

                      {day.key === 'TUE' && (
                        <>
                          {/* TUE Periods 1,2: Merged DE (KT) */}
                          <td colSpan={2} className="p-2 border-r border-slate-300">
                            <SlotCard slot={s1} spanText="Periods I & II (09:30 - 11:10)" isCurrent={isCurrentDay && [1, 2].includes(currentDemoPeriod)} onEdit={isAdmin ? () => s1 && handleEditSlot(s1) : undefined} />
                          </td>
                          {/* TUE Periods 3,4: Merged DE LAB(KT) */}
                          <td colSpan={2} className="p-2 border-r border-slate-300">
                            <SlotCard slot={s3} spanText="Periods III & IV (11:10 - 12:50)" isCurrent={isCurrentDay && [3, 4].includes(currentDemoPeriod)} onEdit={isAdmin ? () => s3 && handleEditSlot(s3) : undefined} />
                          </td>
                          {/* Lunch Break */}
                          <LunchCell />
                          {/* TUE Periods 5,6 (VI & VII): Merged (EC-309) LICA LAB(RR) */}
                          <td colSpan={2} className="p-2">
                            <SlotCard slot={s5} spanText="Periods VI & VII (1:30 - 3:10)" isCurrent={isCurrentDay && [5, 6].includes(currentDemoPeriod)} onEdit={isAdmin ? () => s5 && handleEditSlot(s5) : undefined} />
                          </td>
                        </>
                      )}

                      {day.key === 'WED' && (
                        <>
                          {/* WED Periods 1,2: Merged ADC(PC) */}
                          <td colSpan={2} className="p-2 border-r border-slate-300">
                            <SlotCard slot={s1} spanText="Periods I & II (09:30 - 11:10)" isCurrent={isCurrentDay && [1, 2].includes(currentDemoPeriod)} onEdit={isAdmin ? () => s1 && handleEditSlot(s1) : undefined} />
                          </td>
                          {/* WED Periods 3,4: Merged DE (KT) */}
                          <td colSpan={2} className="p-2 border-r border-slate-300">
                            <SlotCard slot={s3} spanText="Periods III & IV (11:10 - 12:50)" isCurrent={isCurrentDay && [3, 4].includes(currentDemoPeriod)} onEdit={isAdmin ? () => s3 && handleEditSlot(s3) : undefined} />
                          </td>
                          {/* Lunch Break */}
                          <LunchCell />
                          {/* WED Period 5 (VI): MATHS (VJ) */}
                          <td className="p-2 border-r border-slate-300">
                            <SlotCard slot={s5} isCurrent={isCurrentDay && currentDemoPeriod === 5} onEdit={isAdmin ? () => s5 && handleEditSlot(s5) : undefined} />
                          </td>
                          {/* WED Period 6 (VII): NA (RR) */}
                          <td className="p-2">
                            <SlotCard slot={s6} isCurrent={isCurrentDay && currentDemoPeriod === 6} onEdit={isAdmin ? () => s6 && handleEditSlot(s6) : undefined} />
                          </td>
                        </>
                      )}

                      {day.key === 'THU' && (
                        <>
                          {/* THU Periods 1,2: Merged BHAP (AJ) */}
                          <td colSpan={2} className="p-2 border-r border-slate-300">
                            <SlotCard slot={s1} spanText="Periods I & II (09:30 - 11:10)" isCurrent={isCurrentDay && [1, 2].includes(currentDemoPeriod)} onEdit={isAdmin ? () => s1 && handleEditSlot(s1) : undefined} />
                          </td>
                          {/* THU Periods 3,4: Merged MATHS (VJ) */}
                          <td colSpan={2} className="p-2 border-r border-slate-300">
                            <SlotCard slot={s3} spanText="Periods III & IV (11:10 - 12:50)" isCurrent={isCurrentDay && [3, 4].includes(currentDemoPeriod)} onEdit={isAdmin ? () => s3 && handleEditSlot(s3) : undefined} />
                          </td>
                          {/* Lunch Break */}
                          <LunchCell />
                          {/* THU Period 5 (VI): NA (RR) */}
                          <td className="p-2 border-r border-slate-300">
                            <SlotCard slot={s5} isCurrent={isCurrentDay && currentDemoPeriod === 5} onEdit={isAdmin ? () => s5 && handleEditSlot(s5) : undefined} />
                          </td>
                          {/* THU Period 6 (VII): BHAP (AJ) */}
                          <td className="p-2">
                            <SlotCard slot={s6} isCurrent={isCurrentDay && currentDemoPeriod === 6} onEdit={isAdmin ? () => s6 && handleEditSlot(s6) : undefined} />
                          </td>
                        </>
                      )}

                      {day.key === 'FRI' && (
                        <>
                          {/* FRI Periods 1,2: Merged LICA (RR) */}
                          <td colSpan={2} className="p-2 border-r border-slate-300">
                            <SlotCard slot={s1} spanText="Periods I & II (09:30 - 11:10)" isCurrent={isCurrentDay && [1, 2].includes(currentDemoPeriod)} onEdit={isAdmin ? () => s1 && handleEditSlot(s1) : undefined} />
                          </td>
                          {/* FRI Periods 3,4: Merged DE (KT) */}
                          <td colSpan={2} className="p-2 border-r border-slate-300">
                            <SlotCard slot={s3} spanText="Periods III & IV (11:10 - 12:50)" isCurrent={isCurrentDay && [3, 4].includes(currentDemoPeriod)} onEdit={isAdmin ? () => s3 && handleEditSlot(s3) : undefined} />
                          </td>
                          {/* Lunch Break */}
                          <LunchCell />
                          {/* FRI Periods 5,6 (VI & VII): Merged (BM-308) CHN LAB (PKC) */}
                          <td colSpan={2} className="p-2">
                            <SlotCard slot={s5} spanText="Periods VI & VII (1:30 - 3:10)" isCurrent={isCurrentDay && [5, 6].includes(currentDemoPeriod)} onEdit={isAdmin ? () => s5 && handleEditSlot(s5) : undefined} />
                          </td>
                        </>
                      )}

                      {day.key === 'SAT' && (
                        <>
                          {/* SAT Period 1: BHAP (AJ) */}
                          <td className="p-2 border-r border-slate-300">
                            <SlotCard slot={s1} isCurrent={isCurrentDay && currentDemoPeriod === 1} onEdit={isAdmin ? () => s1 && handleEditSlot(s1) : undefined} />
                          </td>
                          {/* SAT Period 2: ADC (PC) */}
                          <td className="p-2 border-r border-slate-300">
                            <SlotCard slot={s2} isCurrent={isCurrentDay && currentDemoPeriod === 2} onEdit={isAdmin ? () => s2 && handleEditSlot(s2) : undefined} />
                          </td>
                          {/* SAT Periods 3,4: Merged LICA (RR) */}
                          <td colSpan={2} className="p-2 border-r border-slate-300">
                            <SlotCard slot={s3} spanText="Periods III & IV (11:10 - 12:50)" isCurrent={isCurrentDay && [3, 4].includes(currentDemoPeriod)} onEdit={isAdmin ? () => s3 && handleEditSlot(s3) : undefined} />
                          </td>
                          {/* Lunch Break */}
                          <LunchCell />
                          {/* SAT Period 5 (VI): MATHS (VJ) */}
                          <td className="p-2 border-r border-slate-300">
                            <SlotCard slot={s5} isCurrent={isCurrentDay && currentDemoPeriod === 5} onEdit={isAdmin ? () => s5 && handleEditSlot(s5) : undefined} />
                          </td>
                          {/* SAT Period 6 (VII): ADC (PC) */}
                          <td className="p-2">
                            <SlotCard slot={s6} isCurrent={isCurrentDay && currentDemoPeriod === 6} onEdit={isAdmin ? () => s6 && handleEditSlot(s6) : undefined} />
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Faculty Directory & Subject Legend Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Faculty Legend Card (8 Cols) */}
        <div className="lg:col-span-8 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between pb-4 border-b border-slate-200">
            <div className="flex items-center gap-2.5">
              <GraduationCap className="w-5 h-5 text-blue-600" />
              <h3 className="font-bold text-slate-900 text-sm">
                Faculty Directory & Teaching Load Allotment
              </h3>
            </div>
            <span className="text-[11px] font-medium text-slate-500">
              Department of Biomedical Engineering
            </span>
          </div>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {faculty.map((f) => (
              <div
                key={f.code}
                className="p-3 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-slate-50 transition flex items-start gap-3"
              >
                <div className="w-9 h-9 rounded-lg bg-blue-100 text-blue-800 font-extrabold flex items-center justify-center text-xs flex-shrink-0">
                  {f.code}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-bold text-xs text-slate-900 truncate">{f.name}</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.2 bg-slate-200 text-slate-700 rounded font-semibold">
                      {f.code}
                    </span>
                  </div>
                  <div className="text-[11px] font-mono text-blue-700 font-medium mt-0.5 truncate">
                    {f.workload}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5 truncate">{f.department}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Subjects & Lab Legend Card (4 Cols) */}
        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 pb-4 border-b border-slate-200">
              <BookOpen className="w-5 h-5 text-emerald-600" />
              <h3 className="font-bold text-slate-900 text-sm">Course & Subject Index</h3>
            </div>

            <div className="mt-4 space-y-2.5 text-xs">
              <div className="p-2.5 rounded-lg bg-sky-50 border border-sky-200 flex items-start gap-2.5">
                <span className="px-1.5 py-0.5 rounded bg-sky-200 text-sky-900 font-bold font-mono text-[10px]">
                  BHAP
                </span>
                <div>
                  <div className="font-bold text-slate-900">Basic Human Anatomy & Physiology</div>
                  <div className="text-[10px] text-slate-600">Theory • Faculty: A Ajay Teja (AJ)</div>
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-sky-50 border border-sky-200 flex items-start gap-2.5">
                <span className="px-1.5 py-0.5 rounded bg-sky-200 text-sky-900 font-bold font-mono text-[10px]">
                  DE
                </span>
                <div>
                  <div className="font-bold text-slate-900">Digital Electronics & Logic Design</div>
                  <div className="text-[10px] text-slate-600">Theory • Faculty: K Thirupathanna (KT)</div>
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-sky-50 border border-sky-200 flex items-start gap-2.5">
                <span className="px-1.5 py-0.5 rounded bg-sky-200 text-sky-900 font-bold font-mono text-[10px]">
                  ADC
                </span>
                <div>
                  <div className="font-bold text-slate-900">Analog & Digital Circuits</div>
                  <div className="text-[10px] text-slate-600">Theory • Faculty: Y Poornachandra (PC)</div>
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-sky-50 border border-sky-200 flex items-start gap-2.5">
                <span className="px-1.5 py-0.5 rounded bg-sky-200 text-sky-900 font-bold font-mono text-[10px]">
                  LICA
                </span>
                <div>
                  <div className="font-bold text-slate-900">Linear Integrated Circuits & Applications</div>
                  <div className="text-[10px] text-slate-600">Theory • Faculty: Rathod Rameshwar (RR)</div>
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-sky-50 border border-sky-200 flex items-start gap-2.5">
                <span className="px-1.5 py-0.5 rounded bg-sky-200 text-sky-900 font-bold font-mono text-[10px]">
                  NA / MATHS
                </span>
                <div>
                  <div className="font-bold text-slate-900">Network Analysis / Mathematics - III</div>
                  <div className="text-[10px] text-slate-600">Theory • Faculty: Rathod Rameshwar (RR) / VJ</div>
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 flex items-start gap-2.5">
                <span className="px-1.5 py-0.5 rounded bg-emerald-200 text-emerald-900 font-bold font-mono text-[10px]">
                  LABS
                </span>
                <div>
                  <div className="font-bold text-slate-900">Eng. Lab, DE Lab, LICA Lab, CHN Lab</div>
                  <div className="text-[10px] text-emerald-800">Practical Sessions (HU-310, EC-309, BM-308)</div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>Branch: BME 3rd Sem</span>
            <span>Room: Main Block EC/BM</span>
          </div>
        </div>
      </div>

      {/* Edit Timetable Slot Modal */}
      {isEditModalOpen && selectedSlot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden text-slate-900">
            <div className="p-5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-sm">
                Edit Schedule Slot ({editFormData.day_of_week} • Period {editFormData.period_number})
              </h3>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveSlot} className="p-5 space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1">Subject Code & Abbreviation *</label>
                <input
                  type="text"
                  required
                  value={editFormData.subject_code || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, subject_code: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 font-mono"
                  placeholder="e.g. LICA (RR)"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Full Subject Title</label>
                <input
                  type="text"
                  value={editFormData.subject_name || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, subject_name: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900"
                  placeholder="e.g. Linear Integrated Circuits & Applications"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Faculty Code</label>
                  <input
                    type="text"
                    value={editFormData.teacher_code || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, teacher_code: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 font-mono"
                    placeholder="e.g. RR"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Faculty Name</label>
                  <input
                    type="text"
                    value={editFormData.teacher_name || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, teacher_name: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900"
                    placeholder="e.g. Rathod Rameshwar"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Room / Laboratory</label>
                <input
                  type="text"
                  value={editFormData.room_or_lab || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, room_or_lab: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 font-mono"
                  placeholder="e.g. EC-305 or BM-308"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="is_lab_check"
                  checked={Boolean(editFormData.is_lab)}
                  onChange={(e) => setEditFormData({ ...editFormData, is_lab: e.target.checked })}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="is_lab_check" className="text-slate-700 font-medium">
                  This is a Practical / Laboratory Session
                </label>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-sm"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// Reusable Cell Card for Timetable Slot
interface SlotCardProps {
  slot?: TimetableSlot;
  spanText?: string;
  isCurrent?: boolean;
  onEdit?: () => void;
}

const SlotCard: React.FC<SlotCardProps> = ({ slot, spanText, isCurrent, onEdit }) => {
  if (!slot) {
    return (
      <div className="p-3 rounded-xl border border-dashed border-slate-200 bg-slate-50/50 text-slate-400 text-[11px] flex items-center justify-center min-h-[70px]">
        No Class
      </div>
    );
  }

  const isLab = slot.is_lab;

  return (
    <div
      onClick={onEdit}
      className={`p-3 rounded-xl border text-center transition relative min-h-[72px] flex flex-col justify-center items-center group cursor-pointer ${
        isCurrent
          ? 'ring-2 ring-blue-600 shadow-md animate-pulse ' +
            (isLab ? 'bg-emerald-100 border-emerald-400 text-emerald-950' : 'bg-blue-100 border-blue-400 text-blue-950')
          : isLab
          ? 'bg-emerald-50/90 border-emerald-300 text-emerald-950 hover:bg-emerald-100 hover:border-emerald-400'
          : 'bg-sky-50/90 border-sky-300 text-sky-950 hover:bg-sky-100 hover:border-sky-400'
      }`}
    >
      {isCurrent && (
        <span className="absolute -top-2 px-1.5 py-0.2 rounded-full text-[8px] font-extrabold bg-blue-600 text-white uppercase tracking-wider shadow-sm">
          Live Now
        </span>
      )}

      {onEdit && (
        <span className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition text-slate-500 hover:text-slate-800">
          <Edit3 className="w-3 h-3" />
        </span>
      )}

      <div className="font-extrabold text-xs sm:text-sm tracking-tight leading-tight">
        {slot.subject_code}
      </div>

      {spanText && (
        <div className="text-[10px] font-medium text-slate-600 mt-0.5">
          {spanText}
        </div>
      )}

      <div className="text-[10px] font-mono text-slate-500 mt-1 flex items-center gap-1.5">
        <span>{slot.room_or_lab}</span>
      </div>
    </div>
  );
};

// Lunch Break Cell Column
const LunchCell = () => (
  <td className="p-1 border-r border-amber-300 bg-amber-50/80 text-amber-900">
    <div className="py-2 flex flex-col items-center justify-center font-bold text-[10px] tracking-widest text-amber-800 leading-none">
      <span>L</span>
      <span>U</span>
      <span>N</span>
      <span>C</span>
      <span>H</span>
    </div>
  </td>
);

import React, { useState, useEffect } from 'react';
import {
  Calendar as CalendarIcon,
  Plus,
  Trash2,
  Edit3,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  BookOpen,
  Coffee,
  GraduationCap,
  PartyPopper,
  Info,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  Filter,
} from 'lucide-react';
import { AcademicCalendarEvent, CalendarDayType } from '../../types';
import { useToast } from '../../context/ToastContext';

interface AcademicCalendarManagerProps {
  currentDateStr: string;
  onCalendarUpdated?: () => void;
}

export const AcademicCalendarManager: React.FC<AcademicCalendarManagerProps> = ({
  currentDateStr,
  onCalendarUpdated,
}) => {
  const { showToast } = useToast();
  const [events, setEvents] = useState<AcademicCalendarEvent[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedDate, setSelectedDate] = useState<string>(currentDateStr);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingEvent, setEditingEvent] = useState<AcademicCalendarEvent | null>(null);

  // Month navigation state
  const initialDateObj = new Date(currentDateStr || Date.now());
  const [viewYear, setViewYear] = useState<number>(initialDateObj.getFullYear());
  const [viewMonth, setViewMonth] = useState<number>(initialDateObj.getMonth()); // 0-indexed

  // Form State
  const [formDate, setFormDate] = useState<string>(currentDateStr);
  const [formDayType, setFormDayType] = useState<CalendarDayType>('HOLIDAY');
  const [formTitle, setFormTitle] = useState<string>('');
  const [formDescription, setFormDescription] = useState<string>('');
  const [filterType, setFilterType] = useState<string>('ALL');

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/calendar/events');
      if (res.ok) {
        const data = await res.json();
        setEvents(data);
      }
    } catch (err) {
      console.error('Failed to load academic calendar events:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  const openAddModal = (dateToPreFill?: string) => {
    setEditingEvent(null);
    setFormDate(dateToPreFill || currentDateStr);
    setFormDayType('HOLIDAY');
    setFormTitle('');
    setFormDescription('');
    setIsModalOpen(true);
  };

  const openEditModal = (event: AcademicCalendarEvent) => {
    setEditingEvent(event);
    setFormDate(event.date);
    setFormDayType(event.day_type);
    setFormTitle(event.title);
    setFormDescription(event.description || '');
    setIsModalOpen(true);
  };

  const handleSaveEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formDate || !formTitle.trim()) {
      showToast('Please enter both date and event title', 'warn');
      return;
    }

    try {
      const res = await fetch('/api/calendar/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: formDate,
          day_type: formDayType,
          title: formTitle.trim(),
          description: formDescription.trim(),
          created_by: 'Admin',
        }),
      });

      if (res.ok) {
        showToast(
          editingEvent
            ? `Updated "${formTitle}" for ${formDate}`
            : `Marked ${formDate} as ${formDayType.replace('_', ' ')}: "${formTitle}"`,
          'success'
        );
        setIsModalOpen(false);
        await fetchEvents();
        if (onCalendarUpdated) onCalendarUpdated();
      } else {
        const errData = await res.json();
        showToast(errData.error || 'Failed to save calendar event', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Network error saving event', 'error');
    }
  };

  const handleDeleteEvent = async (id: number, title: string, date: string) => {
    if (!window.confirm(`Are you sure you want to remove the non-instructional designation for "${title}" on ${date}? Regular lecture attendance tracking will be restored for this date.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/calendar/events/${id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        showToast(`Removed event "${title}". Regular tracking restored.`, 'info');
        await fetchEvents();
        if (onCalendarUpdated) onCalendarUpdated();
      } else {
        showToast('Failed to delete calendar event', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Error deleting event', 'error');
    }
  };

  // Calendar matrix calculations
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDayIndex = new Date(viewYear, viewMonth, 1).getDay(); // 0 = Sunday
  const adjustedFirstDay = (firstDayIndex + 6) % 7; // Monday = 0

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
  };

  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(viewYear + 1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  };

  // Map events by date for fast lookup
  const eventsByDate = new Map<string, AcademicCalendarEvent>();
  for (const ev of events) {
    eventsByDate.set(ev.date, ev);
  }

  const selectedEvent = eventsByDate.get(selectedDate);

  // Filtered event list
  const filteredEvents = events.filter((ev) => {
    if (filterType === 'ALL') return true;
    return ev.day_type === filterType;
  });

  const getDayTypeBadge = (type: CalendarDayType) => {
    switch (type) {
      case 'HOLIDAY':
        return {
          bg: 'bg-amber-50 border-amber-200 text-amber-700',
          dot: 'bg-amber-500',
          icon: <Coffee className="w-4 h-4 text-amber-600" />,
          label: 'Institutional Holiday',
          desc: 'Attendance Exempt',
        };
      case 'EXAM_DAY':
        return {
          bg: 'bg-purple-50 border-purple-200 text-purple-700',
          dot: 'bg-purple-500',
          icon: <GraduationCap className="w-4 h-4 text-purple-600" />,
          label: 'Examination Day',
          desc: 'Hall Exam Scheduled',
        };
      case 'COLLEGE_FEST':
        return {
          bg: 'bg-emerald-50 border-emerald-200 text-emerald-700',
          dot: 'bg-emerald-500',
          icon: <PartyPopper className="w-4 h-4 text-emerald-600" />,
          label: 'College Fest / Event',
          desc: 'Lecture Scan Exempt',
        };
      case 'SEMESTER_BREAK':
        return {
          bg: 'bg-slate-100 border-slate-300 text-slate-700',
          dot: 'bg-slate-500',
          icon: <BookOpen className="w-4 h-4 text-slate-600" />,
          label: 'Semester Vacation',
          desc: 'Campus Closed',
        };
      default:
        return {
          bg: 'bg-blue-50 border-blue-200 text-blue-700',
          dot: 'bg-blue-500',
          icon: <CalendarIcon className="w-4 h-4 text-blue-600" />,
          label: 'Instructional Day',
          desc: 'Regular Lectures',
        };
    }
  };

  return (
    <div className="space-y-6" id="academic-calendar-manager">
      {/* Header & Quick Action */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-600 shadow-sm">
              <CalendarIcon className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-slate-800 tracking-tight">Academic Calendar & Non-Instructional Days</h2>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold">
                  Auto-Exemption Active
                </span>
              </div>
              <p className="text-sm text-slate-500 mt-0.5">
                Mark institutional holidays, exam periods, and college fests to prevent automated absence penalties on non-lecture days.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => openAddModal()}
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" />
              Mark Holiday / Exam Day
            </button>
          </div>
        </div>

        {/* Protection Banner */}
        <div className="mt-5 p-4 rounded-xl bg-blue-50/70 border border-blue-200 flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" />
          <div className="text-xs text-blue-900 leading-relaxed">
            <span className="font-semibold">Absence Protection Engine:</span> When a day is marked as a <span className="font-semibold text-amber-800">Holiday</span> or <span className="font-semibold text-purple-800">Exam Day</span>, the system automatically bypasses lecture scanning, pauses consecutive absence alerting, and excludes the date from unearned student attendance percentage penalties.
          </div>
        </div>
      </div>

      {/* Main Grid: Interactive Calendar & Event Details */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 7 Cols: Interactive Calendar Matrix */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            {/* Month Navigation */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-slate-800">
                  {monthNames[viewMonth]} {viewYear}
                </h3>
                <span className="px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-600 text-xs font-medium">
                  {events.filter((e) => {
                    const d = new Date(e.date);
                    return d.getMonth() === viewMonth && d.getFullYear() === viewYear;
                  }).length}{' '}
                  Special Days
                </span>
              </div>

              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                <button
                  onClick={prevMonth}
                  className="p-1.5 rounded-lg hover:bg-white text-slate-600 hover:text-slate-900 transition-colors"
                  title="Previous Month"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => {
                    const now = new Date();
                    setViewMonth(now.getMonth());
                    setViewYear(now.getFullYear());
                  }}
                  className="px-2 py-1 text-xs font-medium text-slate-700 hover:bg-white rounded-md transition-colors"
                >
                  Today
                </button>
                <button
                  onClick={nextMonth}
                  className="p-1.5 rounded-lg hover:bg-white text-slate-600 hover:text-slate-900 transition-colors"
                  title="Next Month"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Day of Week Headers */}
            <div className="grid grid-cols-7 gap-2 mb-2 text-center text-xs font-semibold text-slate-400">
              <span>MON</span>
              <span>TUE</span>
              <span>WED</span>
              <span>THU</span>
              <span>FRI</span>
              <span>SAT</span>
              <span className="text-red-400">SUN</span>
            </div>

            {/* Calendar Days Matrix */}
            <div className="grid grid-cols-7 gap-2">
              {/* Empty leading offset */}
              {Array.from({ length: adjustedFirstDay }).map((_, i) => (
                <div key={`offset-${i}`} className="h-14 rounded-xl bg-slate-50/50 border border-transparent opacity-40"></div>
              ))}

              {/* Month Days */}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const dayNum = i + 1;
                const formattedDate = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                const event = eventsByDate.get(formattedDate);
                const isSelected = selectedDate === formattedDate;
                const isToday = formattedDate === currentDateStr;
                const dayOfWeek = (adjustedFirstDay + i) % 7;
                const isSunday = dayOfWeek === 6;

                let badgeStyle = 'bg-slate-50 border-slate-200 text-slate-700 hover:border-slate-300';
                if (event) {
                  if (event.day_type === 'HOLIDAY') {
                    badgeStyle = 'bg-amber-50 border-amber-300 text-amber-900 font-semibold shadow-xs';
                  } else if (event.day_type === 'EXAM_DAY') {
                    badgeStyle = 'bg-purple-50 border-purple-300 text-purple-900 font-semibold shadow-xs';
                  } else if (event.day_type === 'COLLEGE_FEST') {
                    badgeStyle = 'bg-emerald-50 border-emerald-300 text-emerald-900 font-semibold shadow-xs';
                  } else if (event.day_type === 'SEMESTER_BREAK') {
                    badgeStyle = 'bg-slate-200 border-slate-400 text-slate-800 font-semibold shadow-xs';
                  }
                } else if (isSunday) {
                  badgeStyle = 'bg-red-50/40 border-red-100 text-red-700';
                }

                return (
                  <button
                    key={`day-${dayNum}`}
                    onClick={() => setSelectedDate(formattedDate)}
                    className={`h-14 p-1.5 rounded-xl border flex flex-col justify-between items-start transition-all relative group text-left ${badgeStyle} ${
                      isSelected ? 'ring-2 ring-blue-600 ring-offset-2 z-10' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span
                        className={`text-xs font-semibold ${
                          isToday
                            ? 'w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center'
                            : ''
                        }`}
                      >
                        {dayNum}
                      </span>
                      {event && (
                        <span
                          className={`w-2 h-2 rounded-full ${
                            event.day_type === 'HOLIDAY'
                              ? 'bg-amber-500'
                              : event.day_type === 'EXAM_DAY'
                              ? 'bg-purple-500'
                              : event.day_type === 'COLLEGE_FEST'
                              ? 'bg-emerald-500'
                              : 'bg-slate-500'
                          }`}
                        />
                      )}
                    </div>

                    {event ? (
                      <span className="text-[10px] font-medium truncate w-full leading-tight opacity-90">
                        {event.title}
                      </span>
                    ) : isSunday ? (
                      <span className="text-[9px] text-red-500 font-medium">Sunday</span>
                    ) : (
                      <span className="text-[9px] text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">
                        Lecture Day
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Calendar Color Legend */}
          <div className="mt-6 pt-4 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="flex items-center gap-2 text-slate-700">
              <span className="w-3 h-3 rounded-md bg-amber-100 border border-amber-300"></span>
              <span>Holiday (Exempt)</span>
            </div>
            <div className="flex items-center gap-2 text-slate-700">
              <span className="w-3 h-3 rounded-md bg-purple-100 border border-purple-300"></span>
              <span>Exam Day (Special)</span>
            </div>
            <div className="flex items-center gap-2 text-slate-700">
              <span className="w-3 h-3 rounded-md bg-emerald-100 border border-emerald-300"></span>
              <span>College Fest / Event</span>
            </div>
            <div className="flex items-center gap-2 text-slate-700">
              <span className="w-3 h-3 rounded-md bg-slate-100 border border-slate-300"></span>
              <span>Regular Lecture</span>
            </div>
          </div>
        </div>

        {/* Right 5 Cols: Selected Date Inspector & Quick Actions */}
        <div className="lg:col-span-5 space-y-6">
          {/* Selected Date Card */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Selected Date</span>
                <h4 className="text-lg font-bold text-slate-800">{selectedDate}</h4>
              </div>

              {selectedEvent ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openEditModal(selectedEvent)}
                    className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                    title="Edit Designation"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteEvent(selectedEvent.id, selectedEvent.title, selectedEvent.date)}
                    className="p-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 transition-colors"
                    title="Remove Holiday / Restore Tracking"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => openAddModal(selectedDate)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-xl text-xs font-semibold transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Mark this Day
                </button>
              )}
            </div>

            {selectedEvent ? (
              <div className="space-y-4">
                {(() => {
                  const badge = getDayTypeBadge(selectedEvent.day_type);
                  return (
                    <div className={`p-4 rounded-xl border ${badge.bg}`}>
                      <div className="flex items-center gap-2.5 mb-2">
                        {badge.icon}
                        <span className="font-bold text-sm">{badge.label}</span>
                        <span className="ml-auto text-[11px] font-semibold px-2 py-0.5 rounded-full bg-white/80 border">
                          {badge.desc}
                        </span>
                      </div>
                      <h5 className="text-base font-bold text-slate-900 mb-1">{selectedEvent.title}</h5>
                      {selectedEvent.description && (
                        <p className="text-xs text-slate-600 leading-relaxed">{selectedEvent.description}</p>
                      )}
                    </div>
                  );
                })()}

                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Attendance Policy:</span>
                    <span className="font-semibold text-emerald-700">Auto-Exempt (No Absence Penalties)</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Alert Engine:</span>
                    <span className="font-semibold text-slate-800">Consecutive Alerts Suspended</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Marked By:</span>
                    <span className="font-semibold text-slate-800">{selectedEvent.created_by || 'Admin'}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-6 rounded-xl bg-slate-50 border border-dashed border-slate-200 text-center">
                <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-2.5">
                  <BookOpen className="w-5 h-5" />
                </div>
                <p className="text-sm font-semibold text-slate-800">Standard Instructional Day</p>
                <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                  Regular timetable classes and automated CCTV biometric scans operate as scheduled for this date.
                </p>
                <button
                  onClick={() => openAddModal(selectedDate)}
                  className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition-colors inline-flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Mark as Holiday or Exam Day
                </button>
              </div>
            )}
          </div>

          {/* Quick Filtered Special Events Roster */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-slate-500" />
                <h4 className="text-sm font-bold text-slate-800">Upcoming Special Days ({filteredEvents.length})</h4>
              </div>

              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="ALL">All Types</option>
                <option value="HOLIDAY">Holidays</option>
                <option value="EXAM_DAY">Exam Days</option>
                <option value="COLLEGE_FEST">Fests & Events</option>
                <option value="SEMESTER_BREAK">Vacation</option>
              </select>
            </div>

            <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
              {filteredEvents.length === 0 ? (
                <div className="text-center py-6 text-xs text-slate-400">
                  No special dates found matching filter.
                </div>
              ) : (
                filteredEvents.map((ev) => {
                  const badge = getDayTypeBadge(ev.day_type);
                  const isSelected = selectedDate === ev.date;

                  return (
                    <div
                      key={ev.id}
                      onClick={() => {
                        setSelectedDate(ev.date);
                        const d = new Date(ev.date);
                        setViewMonth(d.getMonth());
                        setViewYear(d.getFullYear());
                      }}
                      className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                        isSelected
                          ? 'border-blue-500 bg-blue-50/50'
                          : 'border-slate-100 hover:border-slate-200 bg-slate-50/50'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${badge.bg}`}>
                          {badge.icon}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-800 truncate">{ev.title}</p>
                          <p className="text-[11px] text-slate-500">{ev.date} • {badge.label}</p>
                        </div>
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteEvent(ev.id, ev.title, ev.date);
                        }}
                        className="text-slate-400 hover:text-red-600 p-1 rounded-md transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Add / Edit Holiday Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-purple-50 border border-purple-200 text-purple-600 flex items-center justify-center">
                  <CalendarIcon className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-slate-800">
                  {editingEvent ? 'Edit Academic Calendar Day' : 'Mark Non-Instructional Day'}
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg text-lg leading-none"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSaveEvent} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Target Date</label>
                <input
                  type="date"
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Day Classification</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { type: 'HOLIDAY' as CalendarDayType, label: '🏖️ Holiday', desc: 'No lectures / Exempt' },
                    { type: 'EXAM_DAY' as CalendarDayType, label: '📝 Exam Day', desc: 'Hall exams active' },
                    { type: 'COLLEGE_FEST' as CalendarDayType, label: '🎪 College Fest', desc: 'Special celebration' },
                    { type: 'SEMESTER_BREAK' as CalendarDayType, label: '⏸️ Semester Break', desc: 'Vacation period' },
                  ].map((item) => (
                    <button
                      key={item.type}
                      type="button"
                      onClick={() => setFormDayType(item.type)}
                      className={`p-2.5 rounded-xl border text-left transition-all ${
                        formDayType === item.type
                          ? 'border-blue-600 bg-blue-50/80 text-blue-900 ring-1 ring-blue-600'
                          : 'border-slate-200 bg-slate-50 hover:bg-white text-slate-700'
                      }`}
                    >
                      <span className="block text-xs font-bold">{item.label}</span>
                      <span className="block text-[10px] text-slate-500">{item.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Event Title / Holiday Name</label>
                <input
                  type="text"
                  placeholder="e.g. Independence Day, Mid-Term Exam 1, Annual Symposium"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Description / Notes (Optional)</label>
                <textarea
                  rows={2}
                  placeholder="e.g. University closed as per statutory gazette. Regular lecture attendance exempt."
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 rounded-xl hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-sm transition-colors"
                >
                  {editingEvent ? 'Update Calendar Day' : 'Save & Protect Attendance'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

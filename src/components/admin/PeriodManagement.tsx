import React, { useState } from 'react';
import { Period } from '../../types';
import { Clock, Plus, Trash2, Edit2, CheckCircle2, Save, X, Calendar, Layers, Sliders } from 'lucide-react';
import { BMETimetableSchedule } from '../timetable/BMETimetableSchedule';
import { useToast } from '../../context/ToastContext';

interface PeriodManagementProps {
  periods: Period[];
  activePeriod: Period | null;
  onPeriodsChanged: () => void;
  onSelectPeriodForAttendance?: (periodNumber: number) => void;
}

export const PeriodManagement: React.FC<PeriodManagementProps> = ({
  periods,
  activePeriod,
  onPeriodsChanged,
  onSelectPeriodForAttendance,
}) => {
  const { showToast } = useToast();
  const [activeSubTab, setActiveSubTab] = useState<'timetable' | 'periods'>('timetable');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPeriod, setEditingPeriod] = useState<Period | null>(null);
  const [formData, setFormData] = useState({
    period_number: periods.length + 1,
    start_time: '09:30',
    end_time: '10:20',
    active: 1,
  });

  const handleOpenAdd = () => {
    setEditingPeriod(null);
    setFormData({
      period_number: periods.length + 1,
      start_time: '09:00',
      end_time: '10:00',
      active: 1,
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (p: Period) => {
    setEditingPeriod(p);
    setFormData({
      period_number: p.period_number,
      start_time: p.start_time,
      end_time: p.end_time,
      active: p.active,
    });
    setIsModalOpen(true);
  };

  const handleSavePeriod = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetch('/api/periods', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      setIsModalOpen(false);
      showToast({
        title: 'Timetable Updated',
        message: `Period ${formData.period_number} (${formData.start_time} - ${formData.end_time}) saved.`,
        type: 'success',
      });
      onPeriodsChanged();
    } catch (err) {
      console.error('Failed to save period:', err);
      showToast({
        title: 'Save Failed',
        message: 'Could not update period settings.',
        type: 'error',
      });
    }
  };

  const handleDeletePeriod = async (id: number) => {
    try {
      await fetch(`/api/periods/${id}`, { method: 'DELETE' });
      showToast({
        title: 'Period Removed',
        message: 'Timetable period slot deleted.',
        type: 'info',
      });
      onPeriodsChanged();
    } catch (err) {
      console.error('Failed to delete period:', err);
    }
  };

  const handleToggleActive = async (p: Period) => {
    try {
      await fetch('/api/periods', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...p,
          active: p.active === 1 ? 0 : 1,
        }),
      });
      onPeriodsChanged();
    } catch (err) {
      console.error('Failed to toggle period active status:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Subtab Navigation */}
      <div className="flex items-center justify-between gap-4 border-b border-slate-200 pb-3 flex-wrap">
        <div className="flex items-center gap-2 bg-slate-200/70 p-1 rounded-xl">
          <button
            type="button"
            id="tab-master-timetable"
            onClick={() => setActiveSubTab('timetable')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition ${
              activeSubTab === 'timetable'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>BME Semester 3 Master Timetable</span>
          </button>
          <button
            type="button"
            id="tab-period-slots"
            onClick={() => setActiveSubTab('periods')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition ${
              activeSubTab === 'periods'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Sliders className="w-4 h-4" />
            <span>Daily Period Slots & Timings</span>
          </button>
        </div>

        {activeSubTab === 'periods' && (
          <button
            id="btn-add-period"
            onClick={handleOpenAdd}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-sm transition"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Period</span>
          </button>
        )}
      </div>

      {activeSubTab === 'timetable' ? (
        <BMETimetableSchedule
          isAdmin={true}
          onSelectPeriodForAttendance={onSelectPeriodForAttendance}
        />
      ) : (
        <>
          {/* Visual Timeline Bar */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-blue-600" />
              <span>BME Dept. Daily Schedule Distribution (09:30 - 15:10)</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-6 gap-3">
              {periods.map((p) => {
                const isCurrent = activePeriod?.id === p.id;
                return (
                  <div
                    key={p.id}
                    className={`p-4 rounded-xl border transition relative ${
                      isCurrent
                        ? 'bg-blue-50/70 border-blue-500 text-slate-900 ring-2 ring-blue-500/20 shadow-sm'
                        : p.active === 1
                        ? 'bg-slate-50 border-slate-200 text-slate-700'
                        : 'bg-slate-50/40 border-slate-200 text-slate-400 opacity-60'
                    }`}
                  >
                    {isCurrent && (
                      <div className="absolute -top-2.5 right-3 px-2 py-0.5 rounded-full text-[9px] font-bold bg-blue-600 text-white uppercase tracking-wide">
                        Live Now
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-slate-900">Period {p.period_number}</span>
                      <span className="text-[11px] font-mono text-blue-700 font-bold bg-blue-50 px-1.5 py-0.5 rounded">
                        {p.label || `P${p.period_number}`}
                      </span>
                    </div>
                    <div className="text-xs font-mono text-blue-600 font-semibold mt-1">
                      {p.start_time} - {p.end_time}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-2 font-medium">
                      50 mins • {p.active === 1 ? 'Active Slot' : 'Disabled'}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Periods Table */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-4">Period #</th>
                  <th className="px-6 py-4">Label</th>
                  <th className="px-6 py-4">Start Time</th>
                  <th className="px-6 py-4">End Time</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {periods.map((p) => {
                  const isCurrent = activePeriod?.id === p.id;
                  return (
                    <tr key={p.id} className="hover:bg-slate-50 transition">
                      <td className="px-6 py-4 font-bold text-slate-900 text-sm">
                        Period {p.period_number}
                        {isCurrent && (
                          <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] bg-blue-50 text-blue-700 border border-blue-200 font-bold">
                            Current
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 font-mono font-bold text-blue-700">{p.label || `P${p.period_number}`}</td>
                      <td className="px-6 py-4 font-mono text-slate-900 font-medium">{p.start_time}</td>
                      <td className="px-6 py-4 font-mono text-slate-900 font-medium">{p.end_time}</td>
                      <td className="px-6 py-4">
                        <button
                          id={`btn-toggle-period-active-${p.id}`}
                          onClick={() => handleToggleActive(p)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold transition ${
                            p.active === 1
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                              : 'bg-slate-100 text-slate-500 border border-slate-200 hover:bg-slate-200'
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${p.active === 1 ? 'bg-emerald-600' : 'bg-slate-400'}`}></span>
                          <span>{p.active === 1 ? 'Active Slot' : 'Inactive'}</span>
                        </button>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            id={`btn-edit-period-${p.id}`}
                            onClick={() => handleOpenEdit(p)}
                            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 rounded-lg transition"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            id={`btn-delete-period-${p.id}`}
                            onClick={() => handleDeletePeriod(p.id)}
                            className="p-1.5 bg-slate-100 hover:bg-rose-600 text-slate-600 hover:text-white rounded-lg transition"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Add / Edit Period Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden text-slate-900">
            <div className="p-6 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-base">
                {editingPeriod ? `Edit Period ${editingPeriod.period_number}` : 'Add New Period'}
              </h3>
              <button
                id="btn-close-period-modal"
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSavePeriod} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1">Period Number (Sequence) *</label>
                <input
                  id="input-period-number"
                  type="number"
                  min="1"
                  max="12"
                  required
                  value={formData.period_number}
                  onChange={(e) => setFormData({ ...formData, period_number: Number(e.target.value) })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Start Time (24h) *</label>
                  <input
                    id="input-period-start-time"
                    type="time"
                    required
                    value={formData.start_time}
                    onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">End Time (24h) *</label>
                  <input
                    id="input-period-end-time"
                    type="time"
                    required
                    value={formData.end_time}
                    onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  id="btn-cancel-period-form"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  id="btn-submit-period-form"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-sm"
                >
                  Save Period
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

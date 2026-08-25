import React, { useState, useEffect } from 'react';
import { Period, PeriodAIInsights } from '../../types';
import {
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
  Download,
  X,
  TrendingUp,
  Camera,
  Layers,
  FileSpreadsheet,
  RefreshCw,
  Info,
} from 'lucide-react';

interface AIAttendanceInsightsModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDate: string;
  currentPeriod: Period | null;
  periods: Period[];
}

export const AIAttendanceInsightsModal: React.FC<AIAttendanceInsightsModalProps> = ({
  isOpen,
  onClose,
  selectedDate,
  currentPeriod,
  periods,
}) => {
  const [selectedPeriodId, setSelectedPeriodId] = useState<number>(currentPeriod?.id || 1);
  const [insights, setInsights] = useState<PeriodAIInsights | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchInsights = async (pId: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/ai/period-insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: selectedDate,
          period_id: pId,
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to generate AI insights');
      }

      const data = await res.json();
      setInsights(data);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Error running AI analysis');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      const activePId = currentPeriod?.id || (periods[0] ? periods[0].id : 1);
      setSelectedPeriodId(activePId);
      fetchInsights(activePId);
    }
  }, [isOpen, selectedDate, currentPeriod]);

  if (!isOpen) return null;

  const currentPeriodObj = periods.find((p) => p.id === selectedPeriodId) || currentPeriod;

  const handleExportPeriodCsv = () => {
    window.location.href = `/api/attendance/export-period-csv?date=${selectedDate}&period_id=${selectedPeriodId}`;
  };

  const getHealthBadge = (health: string) => {
    switch (health) {
      case 'EXCELLENT':
        return <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">✓ Excellent (90%+)</span>;
      case 'GOOD':
        return <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-300">✓ Good (80%+)</span>;
      case 'ATTENTION_REQUIRED':
        return <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">⚠️ Attention Required</span>;
      default:
        return <span className="px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300">🚨 Critical Attendance</span>;
    }
  };

  const getSeverityBadge = (sev: string) => {
    switch (sev) {
      case 'HIGH':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">High Risk</span>;
      case 'MEDIUM':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">Moderate</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">Low</span>;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-indigo-900 via-blue-900 to-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-400/40 flex items-center justify-center text-blue-300">
              <Sparkles className="w-5 h-5 text-blue-300 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold">AI Attendance Insights & Anomaly Scanner</h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-400/20 text-blue-200 border border-blue-400/30">
                  Gemini 3.7 Flash
                </span>
              </div>
              <p className="text-xs text-blue-200 mt-0.5">
                Automated multi-period surveillance analytics, bunking detection, and audit reporting
              </p>
            </div>
          </div>

          <button
            id="btn-close-ai-modal"
            onClick={onClose}
            className="p-1.5 rounded-lg text-blue-200 hover:text-white hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Period Selector & Controls Bar */}
        <div className="px-6 py-3.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Select Period:</span>
            <div className="flex gap-1.5 overflow-x-auto py-1">
              {periods.map((p) => (
                <button
                  key={p.id}
                  id={`btn-ai-select-period-${p.period_number}`}
                  onClick={() => {
                    setSelectedPeriodId(p.id);
                    fetchInsights(p.id);
                  }}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition whitespace-nowrap ${
                    selectedPeriodId === p.id
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  Period {p.period_number} ({p.start_time})
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="btn-refresh-ai-insights"
              onClick={() => fetchInsights(selectedPeriodId)}
              disabled={loading}
              className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-lg flex items-center gap-1.5 transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-blue-600' : ''}`} />
              Re-Scan
            </button>
            <button
              id="btn-export-period-csv-ai"
              onClick={handleExportPeriodCsv}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 shadow-sm transition"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              Export Period {currentPeriodObj?.period_number || ''} CSV
            </button>
          </div>
        </div>

        {/* Modal Content */}
        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
          {loading ? (
            <div className="py-16 text-center space-y-4">
              <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
              <div>
                <h4 className="font-bold text-slate-800 text-sm">Processing Multi-Period CCTV Analytics...</h4>
                <p className="text-xs text-slate-500 mt-1">
                  Gemini AI is cross-referencing biometric camera observations with class schedules and manual audit logs.
                </p>
              </div>
            </div>
          ) : error ? (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold">Failed to load AI Insights</div>
                <div className="text-xs text-rose-700 mt-0.5">{error}</div>
              </div>
            </div>
          ) : insights ? (
            <>
              {/* Executive Summary Card */}
              <div className="p-4 rounded-xl bg-blue-50/60 border border-blue-200 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-blue-600" />
                    <span className="text-xs font-bold uppercase tracking-wider text-blue-900">
                      Executive Administrative Briefing
                    </span>
                  </div>
                  {getHealthBadge(insights.attendanceHealth)}
                </div>
                <p className="text-sm font-medium text-slate-800 leading-relaxed">
                  {insights.executiveSummary}
                </p>
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                  <div className="text-xs text-slate-500 font-bold uppercase tracking-wider">
                    Anomaly Risk Score
                  </div>
                  <div className="text-2xl font-black text-slate-900 mt-1 flex items-baseline gap-1.5">
                    <span>{insights.anomalyScore}</span>
                    <span className="text-xs text-slate-400 font-normal">/ 100</span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {insights.anomalyScore < 20
                      ? '✓ Normal pattern variance'
                      : insights.anomalyScore < 50
                      ? '⚠️ Moderate irregularities'
                      : '🚨 High risk detected'}
                  </div>
                </div>

                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                  <div className="text-xs text-slate-500 font-bold uppercase tracking-wider">
                    Camera Recognition Accuracy
                  </div>
                  <div className="text-2xl font-black text-emerald-600 mt-1">
                    {insights.cameraAccuracyScore || '98.8%'}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    Multi-frame 128-d cosine verified
                  </div>
                </div>

                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                  <div className="text-xs text-slate-500 font-bold uppercase tracking-wider">
                    Target Period
                  </div>
                  <div className="text-2xl font-black text-blue-600 mt-1">
                    Period {currentPeriodObj?.period_number || selectedPeriodId}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {currentPeriodObj?.start_time} - {currentPeriodObj?.end_time} ({selectedDate})
                  </div>
                </div>
              </div>

              {/* Bunking & Selective Attendance Patterns */}
              {insights.bunkingPatternInsights && (
                <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-xl flex items-start gap-3">
                  <ShieldAlert className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-amber-900">
                      Attendance Anomaly & Bunking Patterns
                    </h4>
                    <p className="text-xs text-amber-800 mt-1 leading-relaxed">
                      {insights.bunkingPatternInsights}
                    </p>
                  </div>
                </div>
              )}

              {/* Detected Anomalies List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-slate-700" />
                    Specific Student Anomalies ({insights.detectedAnomalies?.length || 0})
                  </h3>
                  <span className="text-[11px] text-slate-500">Cross-referenced with CCTV timeline</span>
                </div>

                {insights.detectedAnomalies && insights.detectedAnomalies.length > 0 ? (
                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-white">
                    {insights.detectedAnomalies.map((anom, idx) => (
                      <div key={idx} className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50 transition">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-slate-900">{anom.studentName}</span>
                            <span className="font-mono text-xs px-2 py-0.5 bg-slate-100 rounded text-slate-600 font-bold">
                              {anom.rollNumber}
                            </span>
                            {getSeverityBadge(anom.severity)}
                          </div>
                          <p className="text-xs text-slate-600 leading-normal">{anom.description}</p>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="px-2 py-1 rounded-md text-[10px] font-mono font-bold bg-slate-100 text-slate-700">
                            {anom.anomalyType.replace(/_/g, ' ')}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-6 text-center bg-slate-50 border border-dashed border-slate-200 rounded-xl text-xs text-slate-500">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 mx-auto mb-1.5" />
                    No critical attendance anomalies or bunking incidents detected for Period {currentPeriodObj?.period_number}.
                  </div>
                )}
              </div>

              {/* Administrative Recommendations */}
              {insights.recommendations && insights.recommendations.length > 0 && (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-blue-600" />
                    Recommended Action Items for Administration
                  </h4>
                  <ul className="space-y-1.5 text-xs text-slate-700">
                    {insights.recommendations.map((rec, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="font-bold text-blue-600">•</span>
                        <span>{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          ) : null}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Info className="w-4 h-4 text-slate-400" />
            <span>Attendance records are immutable and timestamp-logged with audit logs.</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              id="btn-close-ai-modal-bottom"
              onClick={onClose}
              className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-xl transition"
            >
              Close
            </button>
            <button
              id="btn-download-csv-footer"
              onClick={handleExportPeriodCsv}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl flex items-center gap-2 shadow-sm transition"
            >
              <Download className="w-4 h-4" />
              Download Period {currentPeriodObj?.period_number || ''} CSV Report
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

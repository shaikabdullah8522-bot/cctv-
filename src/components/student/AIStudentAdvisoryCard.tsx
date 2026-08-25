import React, { useState } from 'react';
import { Sparkles, GraduationCap, AlertCircle, CheckCircle2, RefreshCw, Compass } from 'lucide-react';

interface AIStudentAdvisoryCardProps {
  studentId: number;
}

export const AIStudentAdvisoryCard: React.FC<AIStudentAdvisoryCardProps> = ({ studentId }) => {
  const [advisory, setAdvisory] = useState<{
    summary?: string;
    exam_eligibility?: string;
    risk_level?: string;
    classes_needed_for_target?: number;
    recommended_actions?: string[];
    ai_counselor_note?: string;
  } | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAdvisory = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/ai/student-advisory?student_id=${studentId}`);
      if (!res.ok) throw new Error('Failed to fetch AI advisory');
      const data = await res.json();
      setAdvisory(data);
    } catch (err: any) {
      console.error('Advisory error:', err);
      setError(err.message || 'Could not generate student advisory.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-gradient-to-br from-indigo-50/70 via-white to-blue-50/50 border border-indigo-100 rounded-2xl p-6 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-indigo-100/80">
        <div className="flex items-center gap-3">
          <span className="p-2.5 rounded-xl bg-indigo-600 text-white shadow-sm">
            <Sparkles className="w-5 h-5" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-slate-900 text-base">Gemini Academic Advisory & Exam Predictor</h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-700 uppercase">
                AI Powered
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Personalized exam eligibility projection, attendance risk analysis, and actionable advice
            </p>
          </div>
        </div>

        <button
          id="btn-generate-student-advisory"
          onClick={fetchAdvisory}
          disabled={loading}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-xs font-bold rounded-xl shadow-sm transition"
        >
          {loading ? (
            <>
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>Analyzing Records...</span>
            </>
          ) : (
            <>
              <GraduationCap className="w-3.5 h-3.5" />
              <span>{advisory ? 'Refresh Advisory' : 'Generate AI Advisory'}</span>
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="mt-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading && !advisory && (
        <div className="py-8 flex flex-col items-center justify-center gap-2 text-indigo-700">
          <RefreshCw className="w-6 h-6 animate-spin text-indigo-600" />
          <span className="text-xs font-semibold">Gemini is analyzing your period attendance history & predicting exam eligibility...</span>
        </div>
      )}

      {!loading && !advisory && !error && (
        <div className="py-6 text-center text-slate-500 text-xs flex flex-col items-center gap-2">
          <Compass className="w-8 h-8 text-indigo-300" />
          <p>Click <strong>"Generate AI Advisory"</strong> to receive an intelligent evaluation of your semester attendance, exam eligibility standing, and target roadmap.</p>
        </div>
      )}

      {advisory && (
        <div className="mt-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3.5 rounded-xl bg-white border border-indigo-100 shadow-sm">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Exam Eligibility</span>
              <div className="text-sm font-bold text-indigo-900 mt-1 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>{advisory.exam_eligibility || 'Eligible'}</span>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-white border border-indigo-100 shadow-sm">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Attendance Risk</span>
              <div className="text-sm font-bold text-slate-900 mt-1 flex items-center gap-1.5">
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    advisory.risk_level === 'High'
                      ? 'bg-rose-500'
                      : advisory.risk_level === 'Medium'
                      ? 'bg-amber-500'
                      : 'bg-emerald-500'
                  }`}
                ></span>
                <span>{advisory.risk_level || 'Low'} Risk</span>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-white border border-indigo-100 shadow-sm">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Classes Needed for 75%</span>
              <div className="text-sm font-bold text-indigo-600 font-mono mt-1">
                {advisory.classes_needed_for_target !== undefined ? `${advisory.classes_needed_for_target} consecutive periods` : '0 periods'}
              </div>
            </div>
          </div>

          {advisory.summary && (
            <div className="p-4 rounded-xl bg-white border border-indigo-100 text-xs text-slate-700 leading-relaxed shadow-sm">
              <div className="font-bold text-slate-900 mb-1 flex items-center gap-1.5 text-xs">
                <span>AI Evaluation Summary</span>
              </div>
              <p>{advisory.summary}</p>
            </div>
          )}

          {advisory.recommended_actions && advisory.recommended_actions.length > 0 && (
            <div className="p-4 rounded-xl bg-white border border-indigo-100 shadow-sm">
              <div className="font-bold text-slate-900 text-xs mb-2">Recommended Steps:</div>
              <ul className="space-y-1.5">
                {advisory.recommended_actions.map((act, i) => (
                  <li key={i} className="text-xs text-slate-700 flex items-start gap-2">
                    <span className="text-indigo-600 font-bold">•</span>
                    <span>{act}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {advisory.ai_counselor_note && (
            <div className="p-3 rounded-xl bg-indigo-50/70 border border-indigo-100 text-[11px] text-indigo-900 italic">
              <strong>Counselor Note:</strong> "{advisory.ai_counselor_note}"
            </div>
          )}
        </div>
      )}
    </div>
  );
};

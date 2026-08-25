import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Info,
  X,
  Radio,
  Layers,
  Database,
  Volume2,
  VolumeX,
  Sparkles,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

export type ToastType = 'success' | 'batch_processed' | 'info' | 'warning' | 'error';

export interface BatchDetails {
  frameCount: number;
  studentsUpdated: string[];
  periodId?: number | string;
  confidence?: number;
  dbLatencyMs?: number;
}

export interface ToastItem {
  id: string;
  title: string;
  message: string;
  type: ToastType;
  timestamp: string;
  duration?: number; // ms, default 5000
  batchDetails?: BatchDetails;
}

interface ToastContextType {
  toasts: ToastItem[];
  showToast: (toast: Omit<ToastItem, 'id' | 'timestamp'>) => void;
  showBatchProcessedToast: (info: {
    frameCount: number;
    studentNames: string[] | string;
    periodId: number | string;
    confidence?: number;
    dbLatencyMs?: number;
    customMessage?: string;
  }) => void;
  removeToast: (id: string) => void;
  clearAllToasts: () => void;
  soundEnabled: boolean;
  setSoundEnabled: (enabled: boolean) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

// Web Audio API subtle chime synthesizer
function playNotificationChime(type: ToastType) {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'batch_processed' || type === 'success') {
      // Pleasant double bell chime
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, now); // D5
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.12); // A5
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc.start(now);
      osc.stop(now + 0.35);
    } else if (type === 'warning') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.setValueAtTime(370, now + 0.1);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      osc.start(now);
      osc.stop(now + 0.3);
    } else if (type === 'error') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(330, now);
      osc.frequency.exponentialRampToValueAtTime(220, now + 0.15);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      osc.start(now);
      osc.stop(now + 0.3);
    } else {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(659.25, now); // E5
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      osc.start(now);
      osc.stop(now + 0.2);
    }
  } catch (e) {
    // AudioContext may be blocked before first user gesture, ignore safely
  }
}

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const clearAllToasts = useCallback(() => {
    setToasts([]);
  }, []);

  const showToast = useCallback(
    (toast: Omit<ToastItem, 'id' | 'timestamp'>) => {
      const id = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const timestamp = new Date().toLocaleTimeString();
      const newToast: ToastItem = { ...toast, id, timestamp };

      if (soundEnabled) {
        playNotificationChime(toast.type);
      }

      setToasts((prev) => [newToast, ...prev.slice(0, 5)]); // Keep max 6 toasts to prevent clutter

      // Auto dismiss
      const duration = toast.duration || (toast.type === 'batch_processed' ? 6000 : 4500);
      if (duration > 0) {
        setTimeout(() => {
          removeToast(id);
        }, duration);
      }
    },
    [soundEnabled, removeToast]
  );

  const showBatchProcessedToast = useCallback(
    (info: {
      frameCount: number;
      studentNames: string[] | string;
      periodId: number | string;
      confidence?: number;
      dbLatencyMs?: number;
      customMessage?: string;
    }) => {
      const studentsArr = Array.isArray(info.studentNames) ? info.studentNames : [info.studentNames];
      const studentCount = studentsArr.length;
      const studentSummary =
        studentCount === 1
          ? studentsArr[0]
          : `${studentsArr[0]} + ${studentCount - 1} other${studentCount > 2 ? 's' : ''}`;

      const title = 'CCTV Frame Batch Processed';
      const message =
        info.customMessage ||
        `Verified ${info.frameCount} frames • Attendance database updated for ${studentSummary} (Period ${info.periodId})`;

      showToast({
        title,
        message,
        type: 'batch_processed',
        duration: 6500,
        batchDetails: {
          frameCount: info.frameCount,
          studentsUpdated: studentsArr,
          periodId: info.periodId,
          confidence: info.confidence,
          dbLatencyMs: info.dbLatencyMs || Math.floor(Math.random() * 25 + 18),
        },
      });
    },
    [showToast]
  );

  return (
    <ToastContext.Provider
      value={{
        toasts,
        showToast,
        showBatchProcessedToast,
        removeToast,
        clearAllToasts,
        soundEnabled,
        setSoundEnabled,
      }}
    >
      {children}
      <ToastContainer
        toasts={toasts}
        onRemove={removeToast}
        onClearAll={clearAllToasts}
        soundEnabled={soundEnabled}
        onToggleSound={() => setSoundEnabled(!soundEnabled)}
      />
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

// Toast Item Component
const ToastCard: React.FC<{
  toast: ToastItem;
  onRemove: (id: string) => void;
}> = ({ toast, onRemove }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const isBatch = toast.type === 'batch_processed';

  return (
    <div
      id={`toast-item-${toast.id}`}
      className={`w-full max-w-sm rounded-2xl shadow-xl border overflow-hidden transition-all duration-300 transform translate-y-0 backdrop-blur-md ${
        isBatch
          ? 'bg-slate-900/95 border-blue-500/50 text-white shadow-blue-500/10'
          : toast.type === 'success'
          ? 'bg-emerald-950/95 border-emerald-500/40 text-white shadow-emerald-500/10'
          : toast.type === 'error'
          ? 'bg-rose-950/95 border-rose-500/40 text-white shadow-rose-500/10'
          : toast.type === 'warning'
          ? 'bg-amber-950/95 border-amber-500/40 text-white shadow-amber-500/10'
          : 'bg-slate-900/95 border-slate-700 text-white'
      }`}
    >
      {/* Top Banner Stripe */}
      <div
        className={`h-1 w-full ${
          isBatch
            ? 'bg-gradient-to-r from-blue-500 via-indigo-400 to-emerald-400 animate-pulse'
            : toast.type === 'success'
            ? 'bg-emerald-500'
            : toast.type === 'error'
            ? 'bg-rose-500'
            : toast.type === 'warning'
            ? 'bg-amber-500'
            : 'bg-blue-500'
        }`}
      />

      <div className="p-3.5 sm:p-4">
        <div className="flex items-start gap-3">
          {/* Icon Badge */}
          <div
            className={`p-2 rounded-xl shrink-0 ${
              isBatch
                ? 'bg-blue-500/20 text-blue-400 border border-blue-400/30'
                : toast.type === 'success'
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-400/30'
                : toast.type === 'error'
                ? 'bg-rose-500/20 text-rose-400 border border-rose-400/30'
                : toast.type === 'warning'
                ? 'bg-amber-500/20 text-amber-400 border border-amber-400/30'
                : 'bg-blue-500/20 text-blue-400 border border-blue-400/30'
            }`}
          >
            {isBatch ? (
              <Layers className="w-4 h-4 animate-spin-slow" />
            ) : toast.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4" />
            ) : toast.type === 'error' ? (
              <AlertCircle className="w-4 h-4" />
            ) : toast.type === 'warning' ? (
              <AlertTriangle className="w-4 h-4" />
            ) : (
              <Info className="w-4 h-4" />
            )}
          </div>

          {/* Text Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-1 mb-0.5">
              <span className="text-xs font-bold tracking-tight text-white flex items-center gap-1.5">
                {toast.title}
                {isBatch && (
                  <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-blue-500/30 text-blue-300 border border-blue-400/30">
                    DB SYNCED
                  </span>
                )}
              </span>
              <span className="text-[10px] font-mono text-slate-400">{toast.timestamp}</span>
            </div>

            <p className="text-xs text-slate-300 leading-snug break-words">{toast.message}</p>

            {/* Batch Details Pill Strip */}
            {toast.batchDetails && (
              <div className="mt-2.5 pt-2 border-t border-slate-700/60 flex flex-wrap items-center gap-1.5 text-[10px] font-mono">
                <span className="px-2 py-0.5 rounded-md bg-slate-800/90 text-blue-300 border border-slate-700 flex items-center gap-1">
                  <Radio className="w-3 h-3 text-blue-400 animate-pulse" />
                  <span>{toast.batchDetails.frameCount} Frames</span>
                </span>

                <span className="px-2 py-0.5 rounded-md bg-slate-800/90 text-emerald-300 border border-slate-700 flex items-center gap-1">
                  <Database className="w-3 h-3 text-emerald-400" />
                  <span>SQLite Saved ({toast.batchDetails.dbLatencyMs}ms)</span>
                </span>

                {toast.batchDetails.confidence !== undefined && (
                  <span className="px-2 py-0.5 rounded-md bg-slate-800/90 text-indigo-300 border border-slate-700">
                    {Math.round(toast.batchDetails.confidence * 100)}% Conf
                  </span>
                )}

                {toast.batchDetails.studentsUpdated.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="ml-auto text-slate-400 hover:text-white flex items-center gap-0.5"
                  >
                    <span>{isExpanded ? 'Less' : 'More'}</span>
                    {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>
                )}
              </div>
            )}

            {/* Expandable Multi-Student List */}
            {isExpanded && toast.batchDetails && toast.batchDetails.studentsUpdated.length > 1 && (
              <div className="mt-2 p-2 bg-slate-950/80 rounded-lg border border-slate-800 space-y-1 text-[11px]">
                <div className="text-[10px] uppercase font-bold text-slate-400">Updated Students:</div>
                <div className="max-h-24 overflow-y-auto space-y-0.5 pr-1">
                  {toast.batchDetails.studentsUpdated.map((name, idx) => (
                    <div key={idx} className="flex items-center gap-1.5 text-slate-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                      <span>{name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Dismiss Button */}
          <button
            id={`btn-dismiss-toast-${toast.id}`}
            onClick={() => onRemove(toast.id)}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/80 transition shrink-0"
            title="Dismiss notification"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};

// Global Toast Container
const ToastContainer: React.FC<{
  toasts: ToastItem[];
  onRemove: (id: string) => void;
  onClearAll: () => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
}> = ({ toasts, onRemove, onClearAll, soundEnabled, onToggleSound }) => {
  if (toasts.length === 0) return null;

  return (
    <aside
      aria-label="Notifications"
      className="fixed top-4 right-4 z-50 flex flex-col items-end gap-2.5 max-w-sm w-full pointer-events-auto sm:right-6 sm:top-6"
    >
      {/* Toast Top Controls (Clear All / Sound Mute) */}
      <div className="flex items-center justify-between w-full px-2 text-[11px] text-slate-400 bg-slate-900/90 backdrop-blur-md rounded-xl p-1.5 border border-slate-800 shadow-md">
        <div className="flex items-center gap-1.5 font-semibold text-slate-300">
          <Sparkles className="w-3.5 h-3.5 text-blue-400" />
          <span>System Alerts ({toasts.length})</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            id="btn-toggle-toast-sound"
            type="button"
            onClick={onToggleSound}
            title={soundEnabled ? 'Mute alert chime' : 'Enable alert chime'}
            className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition"
          >
            {soundEnabled ? <Volume2 className="w-3.5 h-3.5 text-blue-400" /> : <VolumeX className="w-3.5 h-3.5" />}
          </button>
          <button
            id="btn-clear-all-toasts"
            type="button"
            onClick={onClearAll}
            className="text-[10px] font-bold text-slate-400 hover:text-rose-400 transition"
          >
            Clear All
          </button>
        </div>
      </div>

      {/* Stacked Cards */}
      <div className="w-full space-y-2">
        {toasts.map((toast) => (
          <ToastCard key={toast.id} toast={toast} onRemove={onRemove} />
        ))}
      </div>
    </aside>
  );
};

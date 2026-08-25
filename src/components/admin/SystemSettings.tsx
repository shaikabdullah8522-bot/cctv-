import React, { useState, useEffect } from 'react';
import { SystemSettings as SettingsType, DataRetentionStatus } from '../../types';
import {
  Settings,
  Save,
  CheckCircle2,
  Shield,
  Radio,
  Clock,
  Sliders,
  AlertCircle,
  HardDrive,
  Trash2,
  Key,
  ExternalLink,
  Copy,
  Check,
  Calendar,
  Database,
  Lock,
  RefreshCw,
} from 'lucide-react';
import { useToast } from '../../context/ToastContext';

interface SystemSettingsProps {
  onSettingsSaved: () => void;
}

export const SystemSettings: React.FC<SystemSettingsProps> = ({ onSettingsSaved }) => {
  const { showToast } = useToast();
  const [settings, setSettings] = useState<SettingsType>({
    min_attendance_percentage: 75,
    late_threshold_minutes: 15,
    confidence_threshold: 0.65,
    observation_frames_required: 3,
    cctv_rtsp_url: 'rtsp://192.168.1.120:554/live/ch0',
    camera_mode: 'test_video',
    attendance_closing_minutes: 50,
    data_retention_days: 90,
    storage_mode: 'LOCAL_SYSTEM_ONLY',
  });

  const [retentionStatus, setRetentionStatus] = useState<DataRetentionStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isPruning, setIsPruning] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const fetchSettingsAndRetention = async () => {
    try {
      const [settingsRes, retentionRes] = await Promise.all([
        fetch('/api/settings'),
        fetch('/api/settings/retention/status'),
      ]);

      if (settingsRes.ok) {
        const data = await settingsRes.json();
        setSettings((prev) => ({ ...prev, ...data }));
      }

      if (retentionRes.ok) {
        const retData = await retentionRes.json();
        setRetentionStatus(retData);
      }
    } catch (err) {
      console.error('Failed to load settings or retention data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSettingsAndRetention();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveSuccess(false);

    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });

      if (res.ok) {
        setSaveSuccess(true);
        onSettingsSaved();
        fetchSettingsAndRetention();
        showToast({
          title: 'Settings Saved',
          message: 'System configuration and 90-day retention policies updated successfully.',
          type: 'success',
        });
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch (err) {
      console.error('Failed to save settings:', err);
      showToast({
        title: 'Error Saving Settings',
        message: 'Could not save system settings.',
        type: 'error',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handlePruneExpiredData = async () => {
    if (!window.confirm('Execute 90-Day Retention Cleanup now? All attendance records older than 90 days will be permanently deleted from the local system.')) {
      return;
    }

    setIsPruning(true);
    try {
      const res = await fetch('/api/settings/retention/cleanup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ retention_days: settings.data_retention_days || 90 }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        showToast({
          title: '90-Day Cleanup Completed',
          message: `Purged ${data.purgedCount || 0} attendance records prior to ${data.cutoffDate}. Local storage is clean.`,
          type: 'success',
        });
        fetchSettingsAndRetention();
      } else {
        throw new Error(data.error || 'Failed cleanup');
      }
    } catch (err: any) {
      showToast({
        title: 'Cleanup Error',
        message: err?.message || 'Failed to prune expired records',
        type: 'error',
      });
    } finally {
      setIsPruning(false);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[300px] text-slate-400 text-xs">
        Loading system configuration...
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-blue-50 text-blue-600 border border-blue-100">
            <Settings className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900">System Settings & Data Policies</h1>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold border border-emerald-200">
                100% Local Storage
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Configure local data storage, 90-day retention policies, secret API keys, and CCTV thresholds
            </p>
          </div>
        </div>

        {saveSuccess && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold">
            <CheckCircle2 className="w-4 h-4" />
            <span>Saved Successfully</span>
          </div>
        )}
      </div>

      {/* 1. LOCAL SYSTEM STORAGE & 90-DAY RETENTION POLICY */}
      <div className="bg-white border-2 border-indigo-200 rounded-2xl p-6 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-50 text-indigo-700 rounded-xl border border-indigo-100">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <span>Local System Storage & 90-Day Data Retention Policy</span>
                <span className="px-2 py-0.5 bg-indigo-100 text-indigo-800 text-[10px] font-bold rounded-md">
                  Active Policy
                </span>
              </h3>
              <p className="text-xs text-slate-500">
                All records stay strictly within your local machine (no external cloud sync). Data expires after 90 days.
              </p>
            </div>
          </div>

          <button
            type="button"
            id="btn-run-prune-now"
            onClick={handlePruneExpiredData}
            disabled={isPruning}
            className="flex items-center gap-2 px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-xl border border-rose-200 transition disabled:opacity-50"
          >
            {isPruning ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Trash2 className="w-3.5 h-3.5 text-rose-600" />
            )}
            <span>{isPruning ? 'Pruning...' : 'Run 90-Day Cleanup Now'}</span>
          </button>
        </div>

        {/* Local Storage Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
            <div className="text-slate-500 text-[11px] font-medium flex items-center gap-1">
              <Database className="w-3.5 h-3.5 text-slate-400" />
              <span>Storage Mode</span>
            </div>
            <div className="font-bold text-slate-900 mt-1">Local SQLite</div>
            <div className="text-[10px] text-emerald-600 font-medium">attendance.sqlite</div>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
            <div className="text-slate-500 text-[11px] font-medium flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>Retention Window</span>
            </div>
            <div className="font-bold text-indigo-700 mt-1">{settings.data_retention_days || 90} Days</div>
            <div className="text-[10px] text-slate-500">Auto-purged</div>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
            <div className="text-slate-500 text-[11px] font-medium flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>90-Day Cutoff</span>
            </div>
            <div className="font-bold text-slate-900 mt-1">
              {retentionStatus?.cutoff_date || 'Calculated on load'}
            </div>
            <div className="text-[10px] text-slate-500">Records before this purged</div>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
            <div className="text-slate-500 text-[11px] font-medium flex items-center gap-1">
              <Shield className="w-3.5 h-3.5 text-slate-400" />
              <span>Local Records</span>
            </div>
            <div className="font-bold text-slate-900 mt-1">
              {retentionStatus?.total_attendance_records || 0} entries
            </div>
            <div className="text-[10px] text-slate-500">
              {retentionStatus?.total_audit_logs || 0} audit logs
            </div>
          </div>
        </div>

        <div className="p-3.5 bg-indigo-50/70 border border-indigo-100 rounded-xl text-xs text-indigo-950 space-y-1">
          <div className="font-bold flex items-center gap-1.5 text-indigo-900">
            <CheckCircle2 className="w-4 h-4 text-indigo-600" />
            <span>How the 90-Day Local Retention Policy Works:</span>
          </div>
          <ul className="list-disc list-inside text-[11px] text-indigo-900/80 space-y-0.5 pl-1">
            <li><strong>Local System Only:</strong> All student profiles, facial biometric vectors, and period logs reside in your local SQLite file on your server/computer.</li>
            <li><strong>Automatic 90-Day Expiration:</strong> When attendance records reach 90 days of age, they are automatically purged on database startup and routine checks.</li>
            <li><strong>Privacy Compliant:</strong> No facial biometric templates or daily attendance records are transmitted to third-party databases.</li>
          </ul>
        </div>
      </div>

      {/* 2. SECRET KEYS & CREDENTIALS GUIDE */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
          <div className="p-2 bg-amber-50 text-amber-700 rounded-xl border border-amber-100">
            <Key className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-slate-900">Secret Keys & Credentials Guide</h3>
            <p className="text-xs text-slate-500">
              Where to obtain and configure the required secret keys for this system
            </p>
          </div>
        </div>

        <div className="space-y-3 text-xs">
          {/* Key 1: GEMINI_API_KEY */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 bg-blue-100 text-blue-800 font-mono font-bold text-[11px] rounded">
                  GEMINI_API_KEY
                </span>
                <span className="font-semibold text-slate-800">Google Gemini AI Secret Key</span>
              </div>
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-blue-600 hover:text-blue-700 font-semibold text-xs"
              >
                <span>Get Key on Google AI Studio</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <p className="text-[11px] text-slate-600">
              Used for server-side AI Vision face verification, anomaly analysis, and the natural language copilot.
            </p>
            <div className="bg-slate-900 text-slate-200 p-2.5 rounded-lg font-mono text-[11px] flex items-center justify-between">
              <span>https://aistudio.google.com/app/apikey &rarr; Click &quot;Create API Key&quot;</span>
              <button
                type="button"
                onClick={() => copyToClipboard('https://aistudio.google.com/app/apikey', 'gemini-url')}
                className="text-slate-400 hover:text-white"
                title="Copy Link"
              >
                {copiedKey === 'gemini-url' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[11px] text-slate-500">
              &bull; <strong>In AI Studio:</strong> Configured automatically via your platform workspace settings.<br />
              &bull; <strong>In Local Self-Hosted:</strong> Place it inside your local <code className="bg-slate-200 px-1 rounded">.env</code> file as <code className="bg-slate-200 px-1 rounded">GEMINI_API_KEY=&quot;AIzaSy...&quot;</code>.
            </p>
          </div>

          {/* Key 2: JWT_SECRET_KEY */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 font-mono font-bold text-[11px] rounded">
                  JWT_SECRET_KEY
                </span>
                <span className="font-semibold text-slate-800">Session Cryptographic Secret</span>
              </div>
              <span className="text-[11px] text-slate-500 font-medium">Locally Generated</span>
            </div>
            <p className="text-[11px] text-slate-600">
              This is a custom local cryptographic passphrase for signing login tokens. You can generate any secure 32-character key locally on your terminal:
            </p>
            <div className="bg-slate-900 text-slate-200 p-2.5 rounded-lg font-mono text-[11px] flex items-center justify-between">
              <span>openssl rand -base64 32</span>
              <button
                type="button"
                onClick={() => copyToClipboard('openssl rand -base64 32', 'openssl-cmd')}
                className="text-slate-400 hover:text-white"
                title="Copy Command"
              >
                {copiedKey === 'openssl-cmd' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[11px] text-slate-500">
              Place the generated string in your <code className="bg-slate-200 px-1 rounded">.env</code> file under <code className="bg-slate-200 px-1 rounded">JWT_SECRET_KEY</code>.
            </p>
          </div>

          {/* Key 3: CCTV_RTSP_URL */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 bg-purple-100 text-purple-800 font-mono font-bold text-[11px] rounded">
                  CCTV_RTSP_URL
                </span>
                <span className="font-semibold text-slate-800">IP Camera / NVR Stream Credentials</span>
              </div>
              <span className="text-[11px] text-slate-500 font-medium">From CCTV Admin Console</span>
            </div>
            <p className="text-[11px] text-slate-600">
              Obtain the RTSP stream URL and camera credentials directly from your Hikvision, Dahua, CP Plus, or Axis camera management interface:
            </p>
            <div className="bg-slate-900 text-slate-200 p-2.5 rounded-lg font-mono text-[11px] flex items-center justify-between">
              <span>rtsp://admin:YourPassword@192.168.1.120:554/live/ch0</span>
              <button
                type="button"
                onClick={() => copyToClipboard('rtsp://admin:YourPassword@192.168.1.120:554/live/ch0', 'rtsp-sample')}
                className="text-slate-400 hover:text-white"
                title="Copy Format"
              >
                {copiedKey === 'rtsp-sample' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 3. SETTINGS FORM */}
      <form onSubmit={handleSave} className="space-y-6">
        {/* Retention Period Setting */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
          <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
            <Clock className="w-4 h-4 text-indigo-600" />
            <span>Local Data Retention Duration Configuration</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block text-slate-700 font-bold mb-1">
                Data Retention Window (Days) *
              </label>
              <input
                id="input-setting-retention-days"
                type="number"
                min="7"
                max="365"
                required
                value={settings.data_retention_days || 90}
                onChange={(e) =>
                  setSettings({ ...settings, data_retention_days: Number(e.target.value) })
                }
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 font-mono font-bold"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Default: <strong>90 Days</strong>. Records older than this threshold are purged automatically.
              </p>
            </div>

            <div>
              <label className="block text-slate-700 font-bold mb-1">
                Storage Target Architecture
              </label>
              <input
                id="input-setting-storage-mode"
                type="text"
                disabled
                value="Local In-Memory Architecture - Fast & Responsive"
                className="w-full px-3 py-2 bg-slate-100 border border-slate-300 rounded-lg text-slate-700 font-mono text-xs cursor-not-allowed"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                All biometric and period logs are handled in memory.
              </p>
            </div>
          </div>
        </div>

        {/* Attendance Policy & Warning Rule */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
          <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
            <Shield className="w-4 h-4 text-emerald-600" />
            <span>Institutional Attendance Policy & Warning Rules</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block text-slate-700 font-bold mb-1">
                Minimum Attendance Warning Threshold (%) *
              </label>
              <input
                id="input-setting-min-percentage"
                type="number"
                min="1"
                max="100"
                required
                value={settings.min_attendance_percentage}
                onChange={(e) =>
                  setSettings({ ...settings, min_attendance_percentage: Number(e.target.value) })
                }
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 font-mono"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Students below this percentage will see the official low-attendance warning banner.
              </p>
            </div>

            <div>
              <label className="block text-slate-700 font-bold mb-1">
                Late Arrival Grace Period (Minutes) *
              </label>
              <input
                id="input-setting-late-minutes"
                type="number"
                min="0"
                max="45"
                required
                value={settings.late_threshold_minutes}
                onChange={(e) =>
                  setSettings({ ...settings, late_threshold_minutes: Number(e.target.value) })
                }
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 font-mono"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Detections after this many minutes into the period are marked as LATE.
              </p>
            </div>
          </div>
        </div>

        {/* AI Face Recognition Parameters */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
          <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
            <Sliders className="w-4 h-4 text-blue-600" />
            <span>AI Recognition & Observation Parameters</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block text-slate-700 font-bold mb-1">
                Cosine Similarity Match Threshold (0.50 - 0.95)
              </label>
              <input
                id="input-setting-confidence"
                type="number"
                step="0.05"
                min="0.5"
                max="0.95"
                required
                value={settings.confidence_threshold}
                onChange={(e) =>
                  setSettings({ ...settings, confidence_threshold: Number(e.target.value) })
                }
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 font-mono"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Minimum confidence score to distinguish registered students from unknown faces.
              </p>
            </div>

            <div>
              <label className="block text-slate-700 font-bold mb-1">
                Consecutive Observation Frames Requirement
              </label>
              <input
                id="input-setting-frames"
                type="number"
                min="1"
                max="10"
                required
                value={settings.observation_frames_required}
                onChange={(e) =>
                  setSettings({ ...settings, observation_frames_required: Number(e.target.value) })
                }
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 font-mono"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Requires reliable repeated detections before committing attendance to the database.
              </p>
            </div>
          </div>
        </div>

        {/* RTSP IP CCTV Camera Configuration */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
          <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
            <Radio className="w-4 h-4 text-purple-600" />
            <span>IP CCTV Camera (RTSP) Network Settings</span>
          </h3>

          <div className="text-xs space-y-3">
            <div>
              <label className="block text-slate-700 font-bold mb-1">
                RTSP Stream Connection URL
              </label>
              <input
                id="input-setting-rtsp"
                type="text"
                value={settings.cctv_rtsp_url}
                onChange={(e) => setSettings({ ...settings, cctv_rtsp_url: e.target.value })}
                placeholder="rtsp://username:password@CAMERA_IP:PORT/STREAM"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 font-mono"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Supports ONVIF and RTSP IP cameras.
              </p>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            type="submit"
            id="btn-save-system-settings"
            disabled={isSaving}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-sm transition flex items-center gap-2 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? 'Saving Settings...' : 'Save Configuration & Retention Policy'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};


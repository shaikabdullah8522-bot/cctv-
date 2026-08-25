import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { GoogleSheetsProvider } from './context/GoogleSheetsContext';
import { Navbar } from './components/Navbar';
import { LoginModal } from './components/LoginModal';
import { LoginPage } from './components/LoginPage';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { StudentDashboard } from './components/student/StudentDashboard';
import { Period } from './types';
import { getPeriodScheduleStatus } from './utils/periodUtils';
import { getPeriodsList } from './services/apiClient';

function getLocalDateString(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getFormattedDateString(d: Date = new Date()): string {
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function MainApp() {
  const { user } = useAuth();
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [activePeriod, setActivePeriod] = useState<Period | null>(null);
  const [currentDateStr, setCurrentDateStr] = useState<string>(getLocalDateString());
  const [displayDateStr, setDisplayDateStr] = useState<string>(getFormattedDateString());

  const updateScheduleState = (periodList: Period[]) => {
    if (!periodList || periodList.length === 0) return;
    const status = getPeriodScheduleStatus(periodList, new Date());
    setActivePeriod(status.activePeriod);
  };

  const fetchPeriods = async () => {
    try {
      const data = await getPeriodsList();
      if (Array.isArray(data) && data.length > 0) {
        setPeriods(data);
        updateScheduleState(data);
      }
    } catch (err) {
      console.warn('Periods fetch notice:', err);
    }
  };

  // Real-time ticking clock & period updater
  useEffect(() => {
    if (user) {
      fetchPeriods();
    }

    const timer = setInterval(() => {
      const now = new Date();
      setCurrentDateStr(getLocalDateString(now));
      setDisplayDateStr(getFormattedDateString(now));
      if (periods.length > 0) {
        updateScheduleState(periods);
      }
    }, 5000);

    return () => clearInterval(timer);
  }, [user, periods.length]);

  // If user is not authenticated, display the dedicated Login Page first
  if (!user) {
    return <LoginPage />;
  }

  return (
    <div className="min-h-screen bg-[#f1f5f9] text-slate-900 flex flex-col font-sans selection:bg-blue-600 selection:text-white">
      {/* Header Navigation */}
      <Navbar
        onOpenLogin={() => setIsLoginModalOpen(true)}
        activePeriod={activePeriod}
        periods={periods}
        currentDateStr={displayDateStr}
      />

      {/* Main Content View Container */}
      <main className="flex-1 w-full mx-auto p-4 sm:p-6 lg:p-8 max-w-[1600px]">
        {user.role === 'admin' || user.role === 'faculty' || (user.role as string) === 'teacher' ? (
          <AdminDashboard
            currentDateStr={currentDateStr}
            activePeriod={activePeriod}
            periods={periods}
            onRefreshPeriods={fetchPeriods}
          />
        ) : (
          <StudentDashboard currentDateStr={currentDateStr} />
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-3.5 px-6 text-center text-xs text-slate-500">
        <div className="max-w-[1600px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span className="font-semibold text-slate-700">AI CCTV Automated Attendance Engine</span>
          </div>
          <span className="font-mono text-[11px] text-slate-400">Campus: North Block • RTSP: Connected • August 2026</span>
        </div>
      </footer>

      {/* Login / Switch Account Modal */}
      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
      />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <GoogleSheetsProvider>
          <MainApp />
        </GoogleSheetsProvider>
      </ToastProvider>
    </AuthProvider>
  );
}

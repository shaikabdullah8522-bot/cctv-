import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Period } from '../types';
import { Camera, Clock, Shield, GraduationCap, ArrowRightLeft, FileSpreadsheet, ExternalLink, Coffee, CheckCircle2, LogOut, UserCheck } from 'lucide-react';
import { useGoogleSheets } from '../context/GoogleSheetsContext';
import { getPeriodScheduleStatus } from '../utils/periodUtils';

interface NavbarProps {
  onOpenLogin: () => void;
  activePeriod?: Period | null;
  periods?: Period[];
  currentDateStr: string;
}

export const Navbar: React.FC<NavbarProps> = ({ onOpenLogin, activePeriod, periods = [], currentDateStr }) => {
  const { user, logout, switchRoleQuick } = useAuth();
  const { isConnected, spreadsheetUrl, connectGoogle } = useGoogleSheets();
  const [timeStr, setTimeStr] = useState('');
  const [scheduleStatus, setScheduleStatus] = useState(() => getPeriodScheduleStatus(periods));

  useEffect(() => {
    const updateTime = () => {
      const d = new Date();
      setTimeStr(d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }));
      setScheduleStatus(getPeriodScheduleStatus(periods, d));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [periods]);

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-8 flex items-center justify-between shadow-sm sticky top-0 z-40">
      {/* Left: Campus & Period Status */}
      <div className="flex items-center gap-2 sm:gap-4 text-slate-500 text-xs sm:text-sm">
        <div className="flex items-center gap-2 font-medium text-slate-800">
          <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center text-white shadow-sm">
            <Camera className="w-4 h-4" />
          </div>
          <span className="font-bold text-slate-900 hidden md:inline">Campus: North Block</span>
        </div>

        <span className="w-1 h-1 bg-slate-300 rounded-full hidden sm:inline"></span>
        <span className="text-slate-600 font-medium hidden sm:inline">{currentDateStr}</span>

        {/* Real Live Digital Clock */}
        <span className="w-1 h-1 bg-slate-300 rounded-full hidden sm:inline"></span>
        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 border border-slate-200 rounded-lg text-slate-800 font-mono text-xs font-bold shadow-xs">
          <Clock className="w-3.5 h-3.5 text-blue-600 animate-pulse" />
          <span>{timeStr || '00:00:00'}</span>
        </div>

        {/* Dynamic Real-Time Period Status Pill */}
        <span className="w-1 h-1 bg-slate-300 rounded-full hidden lg:inline"></span>
        <div
          className={`hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-bold tracking-tight transition-all ${
            scheduleStatus.state === 'LIVE'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
              : scheduleStatus.state === 'LUNCH'
              ? 'bg-amber-50 border-amber-300 text-amber-800'
              : scheduleStatus.state === 'PRE_COLLEGE'
              ? 'bg-indigo-50 border-indigo-200 text-indigo-800'
              : scheduleStatus.state === 'CONCLUDED'
              ? 'bg-slate-100 border-slate-300 text-slate-700'
              : 'bg-blue-50 border-blue-200 text-blue-800'
          }`}
        >
          {scheduleStatus.state === 'LIVE' && (
            <span className="relative flex h-2 w-2 mr-0.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
          )}
          {scheduleStatus.state === 'LUNCH' && (
            <Coffee className="w-3.5 h-3.5 text-amber-600 mr-0.5" />
          )}
          {scheduleStatus.state === 'CONCLUDED' && (
            <CheckCircle2 className="w-3.5 h-3.5 text-slate-500 mr-0.5" />
          )}
          <span>
            {scheduleStatus.state === 'LIVE'
              ? `Period ${scheduleStatus.activePeriod?.period_number} (${scheduleStatus.activePeriod?.start_time} - ${scheduleStatus.activePeriod?.end_time}) • LIVE`
              : scheduleStatus.state === 'LUNCH'
              ? `Lunch Break (12:50 - 13:30)`
              : scheduleStatus.state === 'PRE_COLLEGE'
              ? `Next: Period 1 (${scheduleStatus.nextPeriod?.start_time || '09:30'})`
              : scheduleStatus.state === 'CONCLUDED'
              ? `Classes Concluded • Off-Hours`
              : scheduleStatus.displayLabel}
          </span>
        </div>
      </div>

      {/* Right: Live Connection, IP & User Controls */}
      <div className="flex items-center gap-3 sm:gap-5">
        {/* RTSP Live Badge */}
        <div className="hidden lg:flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
          </span>
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
            RTSP: Connected
          </span>
        </div>

        {/* Google Sheets Live Status Link */}
        {isConnected ? (
          <a
            href={spreadsheetUrl}
            target="_blank"
            rel="noreferrer"
            referrerPolicy="no-referrer"
            title="Google Sheet Live Connected: 1J53...P4A"
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-lg text-emerald-800 text-xs font-semibold transition shadow-2xs"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span className="hidden md:inline">Sheet Live</span>
            <ExternalLink className="w-3 h-3 text-emerald-600" />
          </a>
        ) : (
          <button
            onClick={() => connectGoogle()}
            title="Connect Google Sheet to sync student roster & attendance"
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg text-slate-700 text-xs font-medium transition"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span className="hidden md:inline">Sync Sheet</span>
          </button>
        )}

        {/* Camera IP Pill */}
        <div className="hidden xl:block px-2.5 py-1 bg-slate-100 rounded-md text-[11px] font-mono text-slate-600 border border-slate-200">
          192.168.1.104
        </div>

        {/* Role Quick Switch & User Info */}
        {user ? (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 border border-slate-200 rounded-lg text-slate-800">
              {user.role === 'faculty' ? (
                <div className="p-1 rounded bg-blue-100 text-blue-700">
                  <Shield className="w-4 h-4 text-blue-600" />
                </div>
              ) : user.role === 'admin' ? (
                <div className="p-1 rounded bg-indigo-100 text-indigo-700">
                  <Shield className="w-4 h-4 text-indigo-600" />
                </div>
              ) : (
                <div className="p-1 rounded bg-emerald-100 text-emerald-700">
                  <GraduationCap className="w-4 h-4 text-emerald-600" />
                </div>
              )}
              <div className="text-left hidden sm:block">
                <div className="text-xs font-bold text-slate-900 leading-none">{user.name}</div>
                <div className="text-[10px] text-slate-500 font-mono uppercase mt-0.5">
                  {user.role === 'faculty' ? 'Teacher Portal (BME)' : user.role === 'admin' ? 'Admin Portal' : `Roll: ${user.rollNumber}`}
                </div>
              </div>
            </div>

            {/* Role Switcher */}
            <button
              id="btn-quick-switch-role"
              onClick={() => switchRoleQuick(user.role === 'student' ? 'faculty' : 'student')}
              title={user.role === 'student' ? 'Switch to Teacher View' : 'Switch to Student View'}
              className="px-2.5 py-1.5 text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg transition text-xs font-medium flex items-center gap-1.5"
            >
              <ArrowRightLeft className="w-3.5 h-3.5 text-slate-500" />
              <span className="hidden md:inline">
                {user.role === 'student' ? 'Teacher View' : 'Student View'}
              </span>
            </button>

            {/* Logout */}
            <button
              id="btn-logout"
              onClick={logout}
              title="Logout"
              className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 rounded-lg transition"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button
            id="btn-open-login"
            onClick={onOpenLogin}
            className="flex items-center gap-2 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-sm transition"
          >
            <UserCheck className="w-4 h-4" />
            <span>Sign In</span>
          </button>
        )}
      </div>
    </header>
  );
};

import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Shield,
  GraduationCap,
  Lock,
  User,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  Camera,
  Calendar,
  Layers,
  KeyRound,
  Eye,
  EyeOff,
} from 'lucide-react';
import { PasswordStrengthMeter } from './PasswordStrengthMeter';
import { validateStrongPassword } from '../utils/passwordStrength';

export const LoginPage: React.FC = () => {
  const { login, isLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<'faculty' | 'admin' | 'student'>('faculty');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleTabChange = (tab: 'faculty' | 'admin' | 'student') => {
    setActiveTab(tab);
    setErrorMsg('');
    setIdentifier('');
    setPassword('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!identifier.trim() || !password.trim()) {
      setErrorMsg('Please enter your credentials to login.');
      return;
    }

    const res = await login(activeTab, identifier, password);
    if (!res.success) {
      setErrorMsg(res.error || 'Authentication failed. Please check your credentials.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-4 sm:p-6 lg:p-8 relative overflow-hidden font-sans text-slate-100 selection:bg-blue-600 selection:text-white">
      {/* Ambient background decoration */}
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 gap-8 items-center z-10">
        {/* Left Side: System Info & CCTV Live AI Highlights (5 Cols) */}
        <div className="lg:col-span-5 space-y-6 text-left">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-900/50 border border-blue-700/60 text-blue-300 text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>BME Semester 3 AI Attendance System</span>
            </div>

            <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight">
              Automated CCTV AI <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-300 to-emerald-400">
                Period-Wise Attendance
              </span>
            </h1>

            <p className="text-sm text-slate-400 leading-relaxed">
              Biomedical Engineering Department facial biometric attendance portal with TensorFlow.js vector matching and real-time period timetable synchronization.
            </p>
          </div>

          {/* Highlights List */}
          <div className="space-y-3">
            <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-900/60 border border-slate-800">
              <div className="p-2 rounded-lg bg-blue-600/20 text-blue-400 shrink-0">
                <Camera className="w-4 h-4" />
              </div>
              <div className="text-xs">
                <div className="font-bold text-slate-200">TensorFlow.js 128-D Biometric Engine</div>
                <div className="text-slate-400 mt-0.5">Strict Euclidean vector distance verification preventing unregistered attendance</div>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-900/60 border border-slate-800">
              <div className="p-2 rounded-lg bg-emerald-600/20 text-emerald-400 shrink-0">
                <Calendar className="w-4 h-4" />
              </div>
              <div className="text-xs">
                <div className="font-bold text-slate-200">Official BME 3rd Sem Timetable</div>
                <div className="text-slate-400 mt-0.5">Periods I–VII mapped to subjects (BHAP, NA, LICA, DE, ADC, EM-III)</div>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-900/60 border border-slate-800">
              <div className="p-2 rounded-lg bg-purple-600/20 text-purple-400 shrink-0">
                <KeyRound className="w-4 h-4" />
              </div>
              <div className="text-xs">
                <div className="font-bold text-slate-200">Multi-Role Security Portals</div>
                <div className="text-slate-400 mt-0.5">Role-based access control for Teachers, Students, and System Administrators</div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Login Card (7 Cols) */}
        <div className="lg:col-span-7 bg-white border border-slate-200 text-slate-900 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
          {/* Header & Tabs */}
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">
                  {activeTab === 'faculty'
                    ? 'Faculty / Teacher Login'
                    : activeTab === 'admin'
                    ? 'Administrator Login'
                    : 'Student Portal Login'}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {activeTab === 'faculty'
                    ? 'Sign in to access BME class timetables, CCTV cameras, and take live period attendance'
                    : activeTab === 'admin'
                    ? 'Sign in to manage student records, delete students, and configure camera streams'
                    : 'Enter your registered Roll Number to view your attendance history & timetable'}
                </p>
              </div>

              <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl border border-blue-100">
                {activeTab === 'faculty' ? (
                  <Sparkles className="w-6 h-6 text-blue-600" />
                ) : activeTab === 'admin' ? (
                  <Shield className="w-6 h-6 text-indigo-600" />
                ) : (
                  <GraduationCap className="w-6 h-6 text-emerald-600" />
                )}
              </div>
            </div>

            {/* Role Switch Tabs (3 Separate Portals) */}
            <div className="grid grid-cols-3 p-1.5 mt-5 bg-slate-100 rounded-2xl border border-slate-200 gap-1 text-xs">
              <button
                type="button"
                id="login-page-tab-faculty"
                onClick={() => handleTabChange('faculty')}
                className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl font-bold transition ${
                  activeTab === 'faculty'
                    ? 'bg-white text-blue-600 shadow-sm border border-slate-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Faculty / Teacher</span>
              </button>

              <button
                type="button"
                id="login-page-tab-admin"
                onClick={() => handleTabChange('admin')}
                className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl font-bold transition ${
                  activeTab === 'admin'
                    ? 'bg-white text-indigo-600 shadow-sm border border-slate-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Shield className="w-3.5 h-3.5" />
                <span>Admin</span>
              </button>

              <button
                type="button"
                id="login-page-tab-student"
                onClick={() => handleTabChange('student')}
                className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl font-bold transition ${
                  activeTab === 'student'
                    ? 'bg-white text-emerald-600 shadow-sm border border-slate-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <GraduationCap className="w-3.5 h-3.5" />
                <span>Student</span>
              </button>
            </div>
          </div>

          {/* Error Banner */}
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2.5 animate-fade-in">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            <div>
              <label className="block text-slate-700 font-semibold mb-1.5">
                {activeTab === 'faculty'
                  ? 'Teacher Username'
                  : activeTab === 'admin'
                  ? 'Admin Username'
                  : 'Student Roll Number'}
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 pointer-events-none">
                  <User className="w-4 h-4" />
                </span>
                <input
                  id="input-login-identifier"
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder={
                    activeTab === 'faculty'
                      ? 'Enter teacher username'
                      : activeTab === 'admin'
                      ? 'Enter admin username'
                      : 'Enter student roll number'
                  }
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs font-medium focus:outline-none focus:border-blue-500 focus:bg-white transition"
                  required
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-slate-700 font-semibold">Password</label>
                <span className="text-[11px] text-blue-600 font-medium">Encrypted Login</span>
              </div>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 pointer-events-none">
                  <Lock className="w-4 h-4" />
                </span>
                <input
                  id="input-login-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs font-medium focus:outline-none focus:border-blue-500 focus:bg-white transition"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {/* Password Strength Indicator */}
              <PasswordStrengthMeter password={password} showRequirements={false} />
            </div>

            <button
              id="btn-login-submit"
              type="submit"
              disabled={isLoading}
              className={`w-full py-3 text-white rounded-xl font-bold shadow-md transition flex items-center justify-center gap-2 mt-2 ${
                activeTab === 'faculty'
                  ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/20'
                  : activeTab === 'admin'
                  ? 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-500/20'
                  : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20'
              }`}
            >
              {isLoading ? (
                <span>Authenticating...</span>
              ) : (
                <>
                  <span>
                    Sign In as {activeTab === 'faculty' ? 'Teacher' : activeTab === 'admin' ? 'Admin' : 'Student'}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

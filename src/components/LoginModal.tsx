import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Shield, GraduationCap, Lock, User, AlertCircle, CheckCircle2, ArrowRight, X } from 'lucide-react';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose }) => {
  const { login, isLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<'faculty' | 'admin' | 'student'>('faculty');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleTabChange = (tab: 'faculty' | 'admin' | 'student') => {
    setActiveTab(tab);
    setErrorMsg('');
    setIdentifier('');
    setPassword('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    const res = await login(activeTab, identifier, password);
    if (res.success) {
      onClose();
    } else {
      setErrorMsg(res.error || 'Authentication failed');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden text-slate-900">
        {/* Header */}
        <div className="p-6 bg-slate-50 border-b border-slate-200 text-center relative">
          <button
            id="btn-close-login-modal"
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200 transition"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="inline-flex p-3 rounded-2xl bg-blue-50 border border-blue-200 text-blue-600 mb-3">
            {activeTab === 'faculty' ? <Shield className="w-7 h-7 text-blue-600" /> : activeTab === 'admin' ? <Shield className="w-7 h-7 text-indigo-600" /> : <GraduationCap className="w-7 h-7 text-emerald-600" />}
          </div>
          <h2 className="text-xl font-bold text-slate-900">
            {activeTab === 'faculty' ? 'Teacher / Faculty Portal' : activeTab === 'admin' ? 'Administrator Portal' : 'Student Attendance Portal'}
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            {activeTab === 'faculty'
              ? 'Access BME timetable periods, live CCTV monitoring & attendance'
              : activeTab === 'admin'
              ? 'Manage student records, delete students, and configure camera settings'
              : 'Login with Roll Number to view monthly calendar and period attendance'}
          </p>
        </div>

        {/* Role Switch Tabs */}
        <div className="grid grid-cols-3 p-1 m-4 bg-slate-100 rounded-xl border border-slate-200 gap-1 text-xs">
          <button
            type="button"
            id="tab-login-faculty"
            onClick={() => handleTabChange('faculty')}
            className={`flex items-center justify-center gap-1 py-2 rounded-lg font-bold transition ${
              activeTab === 'faculty'
                ? 'bg-white text-blue-600 shadow-sm border border-slate-200'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>Teacher</span>
          </button>
          <button
            type="button"
            id="tab-login-admin"
            onClick={() => handleTabChange('admin')}
            className={`flex items-center justify-center gap-1 py-2 rounded-lg font-bold transition ${
              activeTab === 'admin'
                ? 'bg-white text-indigo-600 shadow-sm border border-slate-200'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>Admin</span>
          </button>
          <button
            type="button"
            id="tab-login-student"
            onClick={() => handleTabChange('student')}
            className={`flex items-center justify-center gap-1 py-2 rounded-lg font-bold transition ${
              activeTab === 'student'
                ? 'bg-white text-emerald-600 shadow-sm border border-slate-200'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>Student</span>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 pb-6 space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              {activeTab === 'faculty' ? 'Teacher Username' : activeTab === 'admin' ? 'Admin Username' : 'Student Roll Number'}
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <User className="w-4 h-4" />
              </div>
              <input
                id="input-login-identifier"
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder={activeTab === 'faculty' ? 'Enter teacher username' : activeTab === 'admin' ? 'Enter admin username' : 'Enter student roll number'}
                required
                className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">Password</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Lock className="w-4 h-4" />
              </div>
              <input
                id="input-login-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                required
                className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
              />
            </div>
          </div>

          <button
            id="btn-login-submit"
            type="submit"
            disabled={isLoading}
            className={`w-full py-2.5 px-4 rounded-xl font-bold text-xs uppercase tracking-wider text-white shadow-sm transition flex items-center justify-center gap-2 ${
              activeTab === 'faculty'
                ? 'bg-blue-600 hover:bg-blue-700'
                : activeTab === 'admin'
                ? 'bg-indigo-600 hover:bg-indigo-700'
                : 'bg-emerald-600 hover:bg-emerald-700'
            } disabled:opacity-50`}
          >
            <span>{isLoading ? 'Verifying...' : `Sign In as ${activeTab === 'faculty' ? 'Teacher' : activeTab === 'admin' ? 'Admin' : 'Student'}`}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};

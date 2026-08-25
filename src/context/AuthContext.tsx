import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserSession } from '../types';

interface AuthContextType {
  user: UserSession | null;
  isLoading: boolean;
  login: (role: 'admin' | 'faculty' | 'student', identifier: string, password?: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  switchRoleQuick: (role: 'admin' | 'faculty' | 'student', studentRoll?: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserSession | null>(() => {
    const saved = localStorage.getItem('cctv_auth_user');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return null;
      }
    }
    // Initially show the Login page first upon loading the application
    return null;
  });

  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (user) {
      localStorage.setItem('cctv_auth_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('cctv_auth_user');
    }
  }, [user]);

  const login = async (role: 'admin' | 'student', identifier: string, password = '') => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role,
          username: role === 'admin' ? identifier : undefined,
          roll_number: role === 'student' ? identifier : undefined,
          password,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || 'Login failed' };
      }

      setUser({
        id: data.user.id,
        role: data.user.role,
        name: data.user.name,
        rollNumber: data.user.rollNumber,
        className: data.user.className,
        section: data.user.section,
        token: data.token,
      });

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error' };
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
  };

  const switchRoleQuick = async (role: 'admin' | 'student', studentRoll = 'CS2026001') => {
    if (role === 'admin') {
      await login('admin', 'admin', 'admin123');
    } else {
      await login('student', studentRoll, 'student123');
    }
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, switchRoleQuick }}>
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

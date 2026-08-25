// Client API helper with automatic retry, exponential backoff, and local fallback caching

import { Student, Period, ConsecutiveAbsenceAlert } from '../types';

// Fallback seed periods if dev server is spinning up
const FALLBACK_PERIODS: Period[] = [
  { id: 1, period_number: 1, start_time: '09:30', end_time: '10:20', label: 'Period 1 (09:30 - 10:20)', active: 1 },
  { id: 2, period_number: 2, start_time: '10:20', end_time: '11:10', label: 'Period 2 (10:20 - 11:10)', active: 1 },
  { id: 3, period_number: 3, start_time: '11:10', end_time: '12:00', label: 'Period 3 (11:10 - 12:00)', active: 1 },
  { id: 4, period_number: 4, start_time: '12:00', end_time: '12:50', label: 'Period 4 (12:00 - 12:50)', active: 1 },
  { id: 5, period_number: 5, start_time: '13:30', end_time: '14:20', label: 'Period 5 (13:30 - 14:20)', active: 1 },
  { id: 6, period_number: 6, start_time: '14:20', end_time: '15:10', label: 'Period 6 (14:20 - 15:10)', active: 1 },
  { id: 7, period_number: 7, start_time: '15:10', end_time: '16:00', label: 'Period 7 (15:10 - 16:00)', active: 1 },
];

// Fallback seed students so UI never crashes or shows broken state if dev server is cold-starting
const FALLBACK_STUDENTS: Student[] = [
  { id: 1, roll_number: 'BME2026001', name: 'Aditi Sharma', class_name: 'B.Tech BME - Semester 3', section: 'A', active: 1, has_face_registered: true, face_embeddings_count: 5, created_at: '2026-08-01T09:00:00.000Z' },
  { id: 2, roll_number: 'BME2026002', name: 'Karthik Raja', class_name: 'B.Tech BME - Semester 3', section: 'A', active: 1, has_face_registered: true, face_embeddings_count: 5, created_at: '2026-08-01T09:00:00.000Z' },
  { id: 3, roll_number: 'BME2026003', name: 'Sneha Reddy', class_name: 'B.Tech BME - Semester 3', section: 'A', active: 1, has_face_registered: true, face_embeddings_count: 5, created_at: '2026-08-01T09:00:00.000Z' },
  { id: 4, roll_number: 'BME2026004', name: 'Mohammed Zaid', class_name: 'B.Tech BME - Semester 3', section: 'A', active: 1, has_face_registered: true, face_embeddings_count: 5, created_at: '2026-08-01T09:00:00.000Z' },
  { id: 5, roll_number: 'BME2026005', name: 'Pooja Hegde', class_name: 'B.Tech BME - Semester 3', section: 'B', active: 1, has_face_registered: true, face_embeddings_count: 5, created_at: '2026-08-01T09:00:00.000Z' },
  { id: 6, roll_number: 'BME2026006', name: 'Vikram Sundaram', class_name: 'B.Tech BME - Semester 3', section: 'B', active: 1, has_face_registered: true, face_embeddings_count: 5, created_at: '2026-08-01T09:00:00.000Z' },
];

/**
 * Resilient fetch with automatic retries and exponential backoff
 */
export async function resilientFetch<T = any>(
  url: string,
  options?: RequestInit,
  retries = 3,
  delayMs = 400
): Promise<T> {
  let lastError: any = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, options);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      const data = await res.json();
      return data as T;
    } catch (err: any) {
      lastError = err;
      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, delayMs * Math.pow(2, attempt)));
      }
    }
  }

  throw lastError || new Error(`Failed to fetch ${url}`);
}

/**
 * Fetch all students with automatic caching & fallback
 */
export async function getStudentsList(): Promise<Student[]> {
  try {
    const data = await resilientFetch<Student[]>('/api/students', undefined, 2, 300);
    if (Array.isArray(data) && data.length > 0) {
      try {
        localStorage.setItem('cctv_cached_students', JSON.stringify(data));
      } catch {}
      return data;
    }
  } catch (err) {
    console.warn('API /api/students unreachable, checking local cache...', err);
  }

  // Fallback to cache
  try {
    const cached = localStorage.getItem('cctv_cached_students');
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch {}

  return FALLBACK_STUDENTS;
}

/**
 * Fetch biometric embeddings with cache fallback
 */
export async function getStudentEmbeddingsList(): Promise<any[]> {
  try {
    const data = await resilientFetch<any[]>('/api/students/embeddings', undefined, 2, 300);
    if (Array.isArray(data)) {
      try {
        localStorage.setItem('cctv_cached_embeddings', JSON.stringify(data));
      } catch {}
      return data;
    }
  } catch (err) {
    console.warn('API /api/students/embeddings unreachable, checking local cache...', err);
  }

  try {
    const cached = localStorage.getItem('cctv_cached_embeddings');
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}

  return [];
}

/**
 * Fetch periods with cache and fallback
 */
export async function getPeriodsList(): Promise<Period[]> {
  try {
    const data = await resilientFetch<Period[]>('/api/periods', undefined, 2, 300);
    if (Array.isArray(data) && data.length > 0) {
      try {
        localStorage.setItem('cctv_cached_periods', JSON.stringify(data));
      } catch {}
      return data;
    }
  } catch (err) {
    console.warn('API /api/periods unreachable, checking local cache...', err);
  }

  try {
    const cached = localStorage.getItem('cctv_cached_periods');
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}

  return FALLBACK_PERIODS;
}

/**
 * Fetch consecutive absence alerts with error resilience
 */
export async function getConsecutiveAbsences(date: string, minStreak = 3): Promise<ConsecutiveAbsenceAlert[]> {
  try {
    const data = await resilientFetch<{ alerts: ConsecutiveAbsenceAlert[] }>(
      `/api/attendance/consecutive-absences?date=${encodeURIComponent(date)}&minStreak=${minStreak}&streak=${minStreak}`,
      undefined,
      2,
      300
    );
    if (data && Array.isArray(data.alerts)) {
      return data.alerts;
    }
  } catch (err) {
    // Non-fatal notice if backend is momentarily restarting
    console.debug('Consecutive absences endpoint query notice:', err);
  }
  return [];
}


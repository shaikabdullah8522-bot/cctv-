export type UserRole = 'super_admin' | 'admin' | 'operator' | 'faculty' | 'teacher' | 'student' | 'viewer';

export interface UserSession {
  id: number;
  role: UserRole;
  name: string;
  email?: string;
  rollNumber?: string;
  className?: string;
  section?: string;
  token: string;
  permissions?: string[];
}

export interface SystemUser {
  id: number;
  name: string;
  email: string;
  role: 'super_admin' | 'admin' | 'operator' | 'faculty' | 'viewer' | 'student';
  department?: string;
  created_at: string;
  last_login?: string;
  active: number;
  permissions: string[];
}

export interface CameraFeed {
  id: string;
  name: string;
  stream_url: string;
  location: string;
  status: 'online' | 'offline' | 'warning';
  fps: number;
  resolution: string;
  total_detections_today: number;
  last_ping: string;
  ip_address?: string;
  description?: string;
}

export interface RecognitionLog {
  id: string;
  person_id?: number;
  person_name: string;
  unique_id: string;
  confidence: number;
  timestamp: string;
  date: string;
  time: string;
  camera_id: string;
  camera_name: string;
  is_unknown: boolean;
  snapshot_url?: string;
  bounding_box?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  status: 'PRESENT' | 'LATE' | 'UNKNOWN';
}

export interface Student {
  id: number;
  roll_number: string;
  name: string;
  class_name: string;
  section: string;
  department?: string;
  role?: string;
  email?: string;
  phone?: string;
  profile_image?: string;
  active: number; // 1 or 0
  created_at: string;
  has_face_registered?: boolean;
  face_embeddings_count?: number;
}

export interface Period {
  id: number;
  period_number: number;
  start_time: string; // "HH:MM" e.g. "09:30"
  end_time: string;   // "HH:MM" e.g. "10:20"
  active: number;     // 1 or 0
  label?: string;     // e.g. "I", "II", "III", "IV", "VI", "VII"
}

export interface TimetableSlot {
  id: number;
  day_of_week: 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT';
  period_number: number;
  period_label: string; // "I", "II", "III", "IV", "VI", "VII"
  start_time: string;
  end_time: string;
  subject_code: string;
  subject_name: string;
  teacher_code: string;
  teacher_name: string;
  room_or_lab: string;
  is_lab: boolean;
}

export interface FacultyMember {
  code: string;
  name: string;
  workload: string;
  department: string;
}

export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'LATE';
export type AIResultStatus = 'PRESENT' | 'ABSENT' | 'LATE' | 'UNKNOWN';

export interface AttendanceRecord {
  id: number;
  student_id: number;
  roll_number?: string;
  student_name?: string;
  class_name?: string;
  section?: string;
  date: string; // "YYYY-MM-DD"
  period_id: number;
  period_number?: number;
  period_start_time?: string;
  period_end_time?: string;
  status: AttendanceStatus;
  first_seen?: string;
  last_seen?: string;
  ai_result: AIResultStatus;
  final_result: AttendanceStatus;
  modified_by?: string;
  modified_at?: string;
  modification_reason?: string;
  confidence?: number;
  match_count?: number;
  is_manual?: boolean;
}

export interface AttendanceAuditLog {
  id: number;
  attendance_id: number;
  student_name?: string;
  roll_number?: string;
  date?: string;
  period_number?: number;
  old_status: AttendanceStatus;
  new_status: AttendanceStatus;
  changed_by: string;
  reason: string;
  changed_at: string;
}

export interface SystemSettings {
  min_attendance_percentage: number;
  late_threshold_minutes: number;
  confidence_threshold: number;
  observation_frames_required: number;
  cctv_rtsp_url: string;
  camera_mode: 'test_video' | 'webcam' | 'rtsp';
  attendance_closing_minutes: number;
  data_retention_days?: number;
  storage_mode?: string;
}

export interface DataRetentionStatus {
  storage_location: string;
  storage_mode: string;
  is_cloud_storage_disabled: boolean;
  retention_days: number;
  cutoff_date: string;
  total_attendance_records: number;
  total_audit_logs: number;
  total_students: number;
  total_face_embeddings: number;
  oldest_record_date: string | null;
  latest_record_date: string | null;
  expired_records_pending_purge: number;
  last_retention_check: string;
}

export interface FaceEmbeddingRecord {
  id: number;
  student_id: number;
  embedding: number[];
  created_at: string;
}

export interface LiveRecognitionEvent {
  studentId?: number;
  studentName: string;
  rollNumber?: string;
  status: 'PRESENT' | 'LATE' | 'UNKNOWN';
  confidence: number;
  consecutiveDetections: number;
  timestamp: string;
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface StudentAttendanceSummary {
  student: Student;
  total_periods: number;
  present_periods: number;
  absent_periods: number;
  late_periods: number;
  attendance_percentage: number;
  is_low_attendance: boolean;
  min_required_percentage: number;
  calendar_dates: Record<string, {
    date: string;
    total: number;
    present: number;
    absent: number;
    late: number;
    status: 'PRESENT' | 'ABSENT' | 'PARTIAL' | 'NO_CLASS';
    periods: Array<{
      period_number: number;
      start_time: string;
      end_time: string;
      status: AttendanceStatus;
      ai_result: AIResultStatus;
      is_manual: boolean;
      modified_by?: string;
      modification_reason?: string;
    }>;
  }>;
}

export interface DetectedAnomaly {
  studentName: string;
  rollNumber: string;
  anomalyType: 'MID_DAY_ABSENCE' | 'MANUAL_OVERRIDE_DISCREPANCY' | 'LOW_CONFIDENCE_DETECTION' | 'CONSECUTIVE_ABSENCE' | 'PUNCTUALITY_ISSUE';
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  description: string;
}

export interface PeriodAIInsights {
  success: boolean;
  executiveSummary: string;
  anomalyScore: number;
  attendanceHealth: 'EXCELLENT' | 'GOOD' | 'ATTENTION_REQUIRED' | 'CRITICAL';
  detectedAnomalies: DetectedAnomaly[];
  bunkingPatternInsights: string;
  cameraAccuracyScore: string;
  recommendations: string[];
}

export interface CCTVFrameAnalysis {
  success: boolean;
  estimatedHeadcount: number;
  classroomDensity: 'LOW' | 'MEDIUM' | 'HIGH' | 'FULL';
  lightingQuality: 'OPTIMAL' | 'SLIGHT_GLARE' | 'POOR_LIGHTING' | 'SHADOWED';
  viabilityScore: number;
  cameraAngleAssessment: string;
  occlusionsDetected: string[];
  observations: string[];
  recommendations: string[];
}

export interface StudentAdvisoryResult {
  success: boolean;
  student: {
    id: number;
    name: string;
    roll_number: string;
    class_name: string;
  };
  currentRate: number;
  totalPeriods: number;
  presentCount: number;
  absentCount: number;
  lateCount: number;
  needed75: number;
  needed80: number;
  needed85: number;
  safeBuffer: number;
  statusCategory: 'SAFE' | 'MODERATE_RISK' | 'CRITICAL_DEBARMENT_RISK';
  personalizedGuidance: string;
  aiTips: string[];
}

export interface ExcuseAnalysisResult {
  success: boolean;
  credibilityScore: number;
  category: 'MEDICAL' | 'COLLEGE_DUTY' | 'FAMILY_EMERGENCY' | 'SPORTS_EVENT' | 'UNVERIFIED';
  recommendedAction: 'APPROVE_PRESENT' | 'APPROVE_LATE' | 'REQUEST_OFFICIAL_CERTIFICATE' | 'REJECT';
  extractedPeriods: string;
  summaryAnalysis: string;
  suggestedAdminRemark: string;
  policyNotice: string;
}

export interface ConsecutiveAbsenceAlert {
  student_id: number;
  student_name: string;
  roll_number: string;
  class_name: string;
  section: string;
  photo_url?: string;
  consecutive_count: number;
  date: string;
  consecutive_periods: Array<{
    period_id: number;
    period_number: number;
    start_time: string;
    end_time: string;
    subject_name?: string;
    date: string;
    status: AttendanceStatus;
  }>;
  reviewed?: boolean;
}

export type CalendarDayType = 'HOLIDAY' | 'EXAM_DAY' | 'SEMESTER_BREAK' | 'COLLEGE_FEST' | 'INSTRUCTIONAL';

export interface AcademicCalendarEvent {
  id: number;
  date: string; // "YYYY-MM-DD"
  day_type: CalendarDayType;
  title: string;
  description?: string;
  created_by?: string;
  created_at?: string;
}

export interface PeriodAttendanceStats {
  period_id: number;
  period_number: number;
  start_time: string;
  end_time: string;
  subject?: string;
  room_number?: string;
  present_count: number;
  late_count: number;
  absent_count: number;
  total_students: number;
  percentage: number;
}

export interface TodayAttendanceData {
  date: string;
  current_period: Period | null;
  selected_period: Period | null;
  is_live: boolean;
  total_students: number;
  present_today: number;
  late_today: number;
  absent_today: number;
  attendance_percentage: number;
  period_stats?: PeriodAttendanceStats[];
  calendar_event?: AcademicCalendarEvent | null;
  is_non_instructional?: boolean;
  records: AttendanceRecord[];
}







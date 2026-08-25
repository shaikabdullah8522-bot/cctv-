import bcrypt from 'bcryptjs';

export interface StudentRecord {
  id: number;
  roll_number: string;
  name: string;
  class_name: string;
  section: string;
  password_hash: string;
  active: number;
  created_at: string;
}

export interface FaceEmbeddingRecord {
  id: number;
  student_id: number;
  embedding: string;
  created_at: string;
}

export interface PeriodRecord {
  id: number;
  period_number: number;
  start_time: string;
  end_time: string;
  label?: string;
  active: number;
}

export interface TimetableSlotRecord {
  id: number;
  day_of_week: string;
  period_number: number;
  period_label: string;
  start_time: string;
  end_time: string;
  subject_code: string;
  subject_name: string;
  teacher_code: string;
  teacher_name: string;
  room_or_lab: string;
  is_lab: number;
}

export interface FacultyRecord {
  id: number;
  code: string;
  name: string;
  workload: string;
  department: string;
}

export interface AttendanceRecord {
  id: number;
  student_id: number;
  date: string;
  period_id: number;
  status: 'PRESENT' | 'ABSENT' | 'LATE';
  first_seen?: string | null;
  last_seen?: string | null;
  ai_result: 'PRESENT' | 'ABSENT' | 'LATE';
  final_result: 'PRESENT' | 'ABSENT' | 'LATE';
  modified_by?: string | null;
  modified_at?: string | null;
  modification_reason?: string | null;
  confidence: number;
  match_count: number;
}

export interface AttendanceAuditLogRecord {
  id: number;
  attendance_id: number;
  old_status: 'PRESENT' | 'ABSENT' | 'LATE';
  new_status: 'PRESENT' | 'ABSENT' | 'LATE';
  changed_by: string;
  reason: string;
  changed_at: string;
}

export interface AcademicCalendarRecord {
  id: number;
  date: string;
  day_type: 'HOLIDAY' | 'EXAM_DAY' | 'SEMESTER_BREAK' | 'COLLEGE_FEST' | 'INSTRUCTIONAL';
  title: string;
  description?: string;
  created_by?: string;
  created_at: string;
}

export interface SystemUserRecord {
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

export interface CameraFeedRecord {
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

class InMemoryStore {
  public students: StudentRecord[] = [];
  public face_embeddings: FaceEmbeddingRecord[] = [];
  public periods: PeriodRecord[] = [];
  public timetable: TimetableSlotRecord[] = [];
  public faculty: FacultyRecord[] = [];
  public attendance: AttendanceRecord[] = [];
  public audit_logs: AttendanceAuditLogRecord[] = [];
  public calendar: AcademicCalendarRecord[] = [];
  public users: SystemUserRecord[] = [];
  public cameras: CameraFeedRecord[] = [];
  public settings: Record<string, string> = {
    min_attendance_percentage: '75',
    late_threshold_minutes: '15',
    confidence_threshold: '0.65',
    observation_frames_required: '3',
    cctv_rtsp_url: 'rtsp://admin:cam_secure_pass@192.168.1.120:554/live/ch0',
    camera_mode: 'test_video',
    attendance_closing_minutes: '50',
    data_retention_days: '90',
    storage_mode: 'IN_MEMORY_STORE',
  };

  private nextStudentId = 1;
  private nextEmbeddingId = 1;
  private nextPeriodId = 1;
  private nextTimetableId = 1;
  private nextFacultyId = 1;
  private nextAttendanceId = 1;
  private nextAuditLogId = 1;
  private nextCalendarId = 1;
  private nextUserId = 1;

  constructor() {
    this.seedDefaultData();
  }

  private seedDefaultData() {
    const now = new Date().toISOString();
    const defaultPasswordHash = bcrypt.hashSync('student123', 8);

    // 1. Seed BME Periods (Semester 3)
    const bmePeriods = [
      { num: 1, label: 'I', start: '09:30', end: '10:20' },
      { num: 2, label: 'II', start: '10:20', end: '11:10' },
      { num: 3, label: 'III', start: '11:10', end: '12:00' },
      { num: 4, label: 'IV', start: '12:00', end: '12:50' },
      { num: 5, label: 'VI', start: '13:30', end: '14:20' },
      { num: 6, label: 'VII', start: '14:20', end: '15:10' },
    ];

    for (const p of bmePeriods) {
      this.periods.push({
        id: this.nextPeriodId++,
        period_number: p.num,
        start_time: p.start,
        end_time: p.end,
        label: p.label,
        active: 1,
      });
    }

    // 2. Seed Faculty Directory
    const facultyList = [
      { code: 'AJ', name: 'A Ajay Teja', workload: 'T(EC-105, BM-306, BM-506A), L(EC-108)', dept: 'Biomedical Engineering' },
      { code: 'KT', name: 'K Thirupathanna', workload: 'T(EC-302, BM-504), L(EC-307, BM-508)', dept: 'Electronics & BME' },
      { code: 'PC', name: 'Y Poornachandra', workload: 'T(EC-106, EV-303), L(EC-110)', dept: 'Electronics & Circuits' },
      { code: 'RR', name: 'Rathod Rameshwar', workload: 'T(EC-304,305), L(EC-309, BM-509, ME-107)', dept: 'Integrated Circuits' },
      { code: 'VJ', name: 'Prof. V. J. Rao', workload: 'Engineering Mathematics', dept: 'Mathematics' },
      { code: 'PKC', name: 'P Kishen & K Chandrika', workload: 'L(BM-308, BM-508)', dept: 'Biomedical Networks' },
      { code: 'HU-310', name: 'Dr. S. Mukherjee', workload: 'English Communication & Soft Skills Lab', dept: 'Humanities' },
      { code: 'P', name: 'P Jyothi / P Kishen', workload: 'T(BM-501,503)', dept: 'Biomedical Engineering' },
      { code: 'KC', name: 'K Chandrika', workload: 'T(BM-502, CS-505A), L(BM-508, 507)', dept: 'Electronics & Computing' },
    ];

    for (const f of facultyList) {
      this.faculty.push({
        id: this.nextFacultyId++,
        code: f.code,
        name: f.name,
        workload: f.workload,
        department: f.dept,
      });
    }

    // 3. Seed Timetable Matrix
    const scheduleMatrix = [
      // MON
      { day: 'MON', p: 1, label: 'I', start: '09:30', end: '10:20', code: 'BHAP (AJ)', name: 'Basic Human Anatomy & Physiology', teacherCode: 'AJ', teacherName: 'A Ajay Teja', room: 'EC-105', isLab: 0 },
      { day: 'MON', p: 2, label: 'II', start: '10:20', end: '11:10', code: 'Eng. Lab (HU-310)', name: 'English Language & Communication Lab', teacherCode: 'HU-310', teacherName: 'Dr. S. Mukherjee', room: 'HU-310 Lab', isLab: 1 },
      { day: 'MON', p: 3, label: 'III', start: '11:10', end: '12:00', code: 'Eng. Lab (HU-310)', name: 'English Language & Communication Lab', teacherCode: 'HU-310', teacherName: 'Dr. S. Mukherjee', room: 'HU-310 Lab', isLab: 1 },
      { day: 'MON', p: 4, label: 'IV', start: '12:00', end: '12:50', code: 'Eng. Lab (HU-310)', name: 'English Language & Communication Lab', teacherCode: 'HU-310', teacherName: 'Dr. S. Mukherjee', room: 'HU-310 Lab', isLab: 1 },
      { day: 'MON', p: 5, label: 'VI', start: '13:30', end: '14:20', code: 'NA (RR)', name: 'Network Analysis', teacherCode: 'RR', teacherName: 'Rathod Rameshwar', room: 'EC-304', isLab: 0 },
      { day: 'MON', p: 6, label: 'VII', start: '14:20', end: '15:10', code: 'LICA (RR)', name: 'Linear Integrated Circuits & Applications', teacherCode: 'RR', teacherName: 'Rathod Rameshwar', room: 'EC-305', isLab: 0 },

      // TUE
      { day: 'TUE', p: 1, label: 'I', start: '09:30', end: '10:20', code: 'DE (KT)', name: 'Digital Electronics', teacherCode: 'KT', teacherName: 'K Thirupathanna', room: 'EC-302', isLab: 0 },
      { day: 'TUE', p: 2, label: 'II', start: '10:20', end: '11:10', code: 'DE (KT)', name: 'Digital Electronics', teacherCode: 'KT', teacherName: 'K Thirupathanna', room: 'EC-302', isLab: 0 },
      { day: 'TUE', p: 3, label: 'III', start: '11:10', end: '12:00', code: 'DE LAB(KT)', name: 'Digital Electronics Laboratory', teacherCode: 'KT', teacherName: 'K Thirupathanna', room: 'EC-307 / BM-508', isLab: 1 },
      { day: 'TUE', p: 4, label: 'IV', start: '12:00', end: '12:50', code: 'DE LAB(KT)', name: 'Digital Electronics Laboratory', teacherCode: 'KT', teacherName: 'K Thirupathanna', room: 'EC-307 / BM-508', isLab: 1 },
      { day: 'TUE', p: 5, label: 'VI', start: '13:30', end: '14:20', code: '(EC-309) LICA LAB(RR)', name: 'Linear Integrated Circuits Laboratory', teacherCode: 'RR', teacherName: 'Rathod Rameshwar', room: 'EC-309 / BM-509', isLab: 1 },
      { day: 'TUE', p: 6, label: 'VII', start: '14:20', end: '15:10', code: '(EC-309) LICA LAB(RR)', name: 'Linear Integrated Circuits Laboratory', teacherCode: 'RR', teacherName: 'Rathod Rameshwar', room: 'EC-309 / BM-509', isLab: 1 },

      // WED
      { day: 'WED', p: 1, label: 'I', start: '09:30', end: '10:20', code: 'ADC(PC)', name: 'Analog & Digital Circuits', teacherCode: 'PC', teacherName: 'Y Poornachandra', room: 'EC-106', isLab: 0 },
      { day: 'WED', p: 2, label: 'II', start: '10:20', end: '11:10', code: 'ADC(PC)', name: 'Analog & Digital Circuits', teacherCode: 'PC', teacherName: 'Y Poornachandra', room: 'EC-106', isLab: 0 },
      { day: 'WED', p: 3, label: 'III', start: '11:10', end: '12:00', code: 'DE (KT)', name: 'Digital Electronics', teacherCode: 'KT', teacherName: 'K Thirupathanna', room: 'EC-302', isLab: 0 },
      { day: 'WED', p: 4, label: 'IV', start: '12:00', end: '12:50', code: 'DE (KT)', name: 'Digital Electronics', teacherCode: 'KT', teacherName: 'K Thirupathanna', room: 'EC-302', isLab: 0 },
      { day: 'WED', p: 5, label: 'VI', start: '13:30', end: '14:20', code: 'MATHS (VJ)', name: 'Engineering Mathematics - III', teacherCode: 'VJ', teacherName: 'Prof. V. J. Rao', room: 'BM-504', isLab: 0 },
      { day: 'WED', p: 6, label: 'VII', start: '14:20', end: '15:10', code: 'NA (RR)', name: 'Network Analysis', teacherCode: 'RR', teacherName: 'Rathod Rameshwar', room: 'EC-304', isLab: 0 },

      // THU
      { day: 'THU', p: 1, label: 'I', start: '09:30', end: '10:20', code: 'BHAP (AJ)', name: 'Basic Human Anatomy & Physiology', teacherCode: 'AJ', teacherName: 'A Ajay Teja', room: 'EC-105', isLab: 0 },
      { day: 'THU', p: 2, label: 'II', start: '10:20', end: '11:10', code: 'BHAP (AJ)', name: 'Basic Human Anatomy & Physiology', teacherCode: 'AJ', teacherName: 'A Ajay Teja', room: 'EC-105', isLab: 0 },
      { day: 'THU', p: 3, label: 'III', start: '11:10', end: '12:00', code: 'MATHS (VJ)', name: 'Engineering Mathematics - III', teacherCode: 'VJ', teacherName: 'Prof. V. J. Rao', room: 'BM-504', isLab: 0 },
      { day: 'THU', p: 4, label: 'IV', start: '12:00', end: '12:50', code: 'MATHS (VJ)', name: 'Engineering Mathematics - III', teacherCode: 'VJ', teacherName: 'Prof. V. J. Rao', room: 'BM-504', isLab: 0 },
      { day: 'THU', p: 5, label: 'VI', start: '13:30', end: '14:20', code: 'NA (RR)', name: 'Network Analysis', teacherCode: 'RR', teacherName: 'Rathod Rameshwar', room: 'EC-304', isLab: 0 },
      { day: 'THU', p: 6, label: 'VII', start: '14:20', end: '15:10', code: 'BHAP (AJ)', name: 'Basic Human Anatomy & Physiology', teacherCode: 'AJ', teacherName: 'A Ajay Teja', room: 'EC-105', isLab: 0 },

      // FRI
      { day: 'FRI', p: 1, label: 'I', start: '09:30', end: '10:20', code: 'LICA (RR)', name: 'Linear Integrated Circuits & Applications', teacherCode: 'RR', teacherName: 'Rathod Rameshwar', room: 'EC-305', isLab: 0 },
      { day: 'FRI', p: 2, label: 'II', start: '10:20', end: '11:10', code: 'LICA (RR)', name: 'Linear Integrated Circuits & Applications', teacherCode: 'RR', teacherName: 'Rathod Rameshwar', room: 'EC-305', isLab: 0 },
      { day: 'FRI', p: 3, label: 'III', start: '11:10', end: '12:00', code: 'DE (KT)', name: 'Digital Electronics', teacherCode: 'KT', teacherName: 'K Thirupathanna', room: 'EC-302', isLab: 0 },
      { day: 'FRI', p: 4, label: 'IV', start: '12:00', end: '12:50', code: 'DE (KT)', name: 'Digital Electronics', teacherCode: 'KT', teacherName: 'K Thirupathanna', room: 'EC-302', isLab: 0 },
      { day: 'FRI', p: 5, label: 'VI', start: '13:30', end: '14:20', code: '(BM-308) CHN LAB (PKC)', name: 'Circuit & Health Networks Laboratory', teacherCode: 'PKC', teacherName: 'P Kishen & K Chandrika', room: 'BM-308', isLab: 1 },
      { day: 'FRI', p: 6, label: 'VII', start: '14:20', end: '15:10', code: '(BM-308) CHN LAB (PKC)', name: 'Circuit & Health Networks Laboratory', teacherCode: 'PKC', teacherName: 'P Kishen & K Chandrika', room: 'BM-308', isLab: 1 },

      // SAT
      { day: 'SAT', p: 1, label: 'I', start: '09:30', end: '10:20', code: 'BHAP (AJ)', name: 'Basic Human Anatomy & Physiology', teacherCode: 'AJ', teacherName: 'A Ajay Teja', room: 'EC-105', isLab: 0 },
      { day: 'SAT', p: 2, label: 'II', start: '10:20', end: '11:10', code: 'ADC (PC)', name: 'Analog & Digital Circuits', teacherCode: 'PC', teacherName: 'Y Poornachandra', room: 'EC-106', isLab: 0 },
      { day: 'SAT', p: 3, label: 'III', start: '11:10', end: '12:00', code: 'LICA (RR)', name: 'Linear Integrated Circuits & Applications', teacherCode: 'RR', teacherName: 'Rathod Rameshwar', room: 'EC-305', isLab: 0 },
      { day: 'SAT', p: 4, label: 'IV', start: '12:00', end: '12:50', code: 'LICA (RR)', name: 'Linear Integrated Circuits & Applications', teacherCode: 'RR', teacherName: 'Rathod Rameshwar', room: 'EC-305', isLab: 0 },
      { day: 'SAT', p: 5, label: 'VI', start: '13:30', end: '14:20', code: 'MATHS (VJ)', name: 'Engineering Mathematics - III', teacherCode: 'VJ', teacherName: 'Prof. V. J. Rao', room: 'BM-504', isLab: 0 },
      { day: 'SAT', p: 6, label: 'VII', start: '14:20', end: '15:10', code: 'ADC (PC)', name: 'Analog & Digital Circuits', teacherCode: 'PC', teacherName: 'Y Poornachandra', room: 'EC-106', isLab: 0 },
    ];

    for (const s of scheduleMatrix) {
      this.timetable.push({
        id: this.nextTimetableId++,
        day_of_week: s.day,
        period_number: s.p,
        period_label: s.label,
        start_time: s.start,
        end_time: s.end,
        subject_code: s.code,
        subject_name: s.name,
        teacher_code: s.teacherCode,
        teacher_name: s.teacherName,
        room_or_lab: s.room,
        is_lab: s.isLab,
      });
    }

    // 4. Seed Academic Calendar Events
    const defaultEvents = [
      { date: '2026-08-15', type: 'HOLIDAY' as const, title: 'Independence Day', description: 'National Public Holiday • Non-instructional day across university' },
      { date: '2026-08-25', type: 'HOLIDAY' as const, title: 'Janmashtami Festival', description: 'Institutional Holiday • No regular classroom lectures conducted' },
      { date: '2026-09-05', type: 'COLLEGE_FEST' as const, title: "Teachers' Day & BME Symposium", description: 'Special Departmental Event • Standard lecture attendance exempt' },
      { date: '2026-09-21', type: 'EXAM_DAY' as const, title: 'Mid-Semester Examination: Day 1 (Digital Electronics & Anatomy)', description: 'Scheduled University Hall Exam • Automated CCTV lecture scan suspended' },
      { date: '2026-09-22', type: 'EXAM_DAY' as const, title: 'Mid-Semester Examination: Day 2 (Network Analysis & Maths)', description: 'Scheduled University Hall Exam • Automated CCTV lecture scan suspended' },
      { date: '2026-10-02', type: 'HOLIDAY' as const, title: 'Gandhi Jayanti', description: 'National Public Holiday' },
      { date: '2026-10-20', type: 'HOLIDAY' as const, title: 'Dussehra / Vijayadashami', description: 'Festival Holiday • University Closed' },
    ];

    for (const ev of defaultEvents) {
      this.calendar.push({
        id: this.nextCalendarId++,
        date: ev.date,
        day_type: ev.type,
        title: ev.title,
        description: ev.description,
        created_by: 'System Admin',
        created_at: now,
      });
    }

    // 5. Seed BME Department Students
    const bmeStudents = [
      { roll: 'BME2026001', name: 'Aditi Sharma', class: 'B.Tech BME - Semester 3', section: 'A' },
      { roll: 'BME2026002', name: 'Karthik Raja', class: 'B.Tech BME - Semester 3', section: 'A' },
      { roll: 'BME2026003', name: 'Sneha Reddy', class: 'B.Tech BME - Semester 3', section: 'A' },
      { roll: 'BME2026004', name: 'Mohammed Zaid', class: 'B.Tech BME - Semester 3', section: 'A' },
      { roll: 'BME2026005', name: 'Pooja Hegde', class: 'B.Tech BME - Semester 3', section: 'B' },
      { roll: 'BME2026006', name: 'Vikram Sundaram', class: 'B.Tech BME - Semester 3', section: 'B' },
    ];

    for (const s of bmeStudents) {
      this.students.push({
        id: this.nextStudentId++,
        roll_number: s.roll,
        name: s.name,
        class_name: s.class,
        section: s.section,
        password_hash: defaultPasswordHash,
        active: 1,
        created_at: now,
      });
    }

    // 6. Seed Face Embeddings for facial recognition scanner
    const generateMockEmbedding = (seed: number) => {
      const total = 128;
      const vec: number[] = [];
      for (let i = 0; i < total; i++) {
        const hash = (seed * 9301 + (i + 1) * 49297) % 233280;
        vec.push((hash / 233280) * 2 - 1);
      }
      const mean = vec.reduce((a, b) => a + b, 0) / total;
      const centered = vec.map((v) => v - mean);
      const norm = Math.sqrt(centered.reduce((a, b) => a + b * b, 0)) || 1;
      return centered.map((v) => v / norm);
    };

    for (const stu of this.students) {
      this.face_embeddings.push({
        id: this.nextEmbeddingId++,
        student_id: stu.id,
        embedding: JSON.stringify(generateMockEmbedding(stu.id)),
        created_at: now,
      });
    }

    // 7. Seed System Users (Role-Based Access Control)
    const defaultUsers: Omit<SystemUserRecord, 'id'>[] = [
      {
        name: 'Prof. Sharma (Admin)',
        email: 'admin@bme.university.edu',
        role: 'super_admin',
        department: 'Biomedical Engineering',
        created_at: '2026-08-01T09:00:00Z',
        last_login: new Date().toISOString(),
        active: 1,
        permissions: ['all_access', 'manage_users', 'manage_cctv', 'export_reports', 'override_attendance', 'system_config'],
      },
      {
        name: 'A Ajay Teja (Faculty)',
        email: 'ajay.teja@bme.university.edu',
        role: 'faculty',
        department: 'Biomedical Engineering',
        created_at: '2026-08-01T09:00:00Z',
        last_login: new Date().toISOString(),
        active: 1,
        permissions: ['view_attendance', 'override_attendance', 'export_reports', 'view_cctv'],
      },
      {
        name: 'K Thirupathanna (Faculty)',
        email: 'thirupathanna@bme.university.edu',
        role: 'faculty',
        department: 'Electronics & BME',
        created_at: '2026-08-01T09:00:00Z',
        last_login: '2026-08-18T14:20:00Z',
        active: 1,
        permissions: ['view_attendance', 'override_attendance', 'export_reports', 'view_cctv'],
      },
      {
        name: 'Campus Security Operator',
        email: 'security.gate@bme.university.edu',
        role: 'operator',
        department: 'Campus Surveillance & IT',
        created_at: '2026-08-05T08:30:00Z',
        last_login: new Date().toISOString(),
        active: 1,
        permissions: ['view_cctv', 'manage_cctv', 'view_attendance'],
      },
      {
        name: 'Academic Audit Viewer',
        email: 'dean.office@bme.university.edu',
        role: 'viewer',
        department: 'Academic Affairs',
        created_at: '2026-08-10T10:00:00Z',
        last_login: '2026-08-19T08:00:00Z',
        active: 1,
        permissions: ['view_attendance', 'export_reports'],
      },
    ];

    for (const u of defaultUsers) {
      this.users.push({
        id: this.nextUserId++,
        ...u,
      });
    }

    // 8. Seed CCTV Camera Feeds
    this.cameras = [
      {
        id: 'cam-01',
        name: 'Main Classroom Entrance (Front)',
        stream_url: 'rtsp://192.168.1.101:554/live/ch0',
        location: 'Hall BME-304 Entrance Gate',
        status: 'online',
        fps: 30,
        resolution: '1920x1080 (1080p FHD)',
        total_detections_today: 48,
        last_ping: 'Just now',
        ip_address: '192.168.1.101',
        description: 'High-speed AI face recognition camera at front doorway',
      },
      {
        id: 'cam-02',
        name: 'Lecture Hall Overhead 360',
        stream_url: 'rtsp://192.168.1.102:554/live/ch1',
        location: 'Hall BME-304 Ceiling Center',
        status: 'online',
        fps: 25,
        resolution: '2560x1440 (2K QHD)',
        total_detections_today: 92,
        last_ping: 'Just now',
        ip_address: '192.168.1.102',
        description: 'Panoramic wide-angle surveillance monitoring seating rows',
      },
      {
        id: 'cam-03',
        name: 'Biomedical Circuits Lab (EC-307)',
        stream_url: 'rtsp://192.168.1.103:554/live/ch0',
        location: 'Lab EC-307 Workstation Corridor',
        status: 'online',
        fps: 30,
        resolution: '1920x1080 (1080p FHD)',
        total_detections_today: 34,
        last_ping: '1 min ago',
        ip_address: '192.168.1.103',
        description: 'Multi-face biometric attendance camera for laboratory practical sessions',
      },
      {
        id: 'cam-04',
        name: 'Human Anatomy Lab & Corridor (EC-105)',
        stream_url: 'rtsp://192.168.1.104:554/live/ch0',
        location: 'Lab EC-105 Entryway',
        status: 'online',
        fps: 30,
        resolution: '1920x1080 (1080p FHD)',
        total_detections_today: 28,
        last_ping: 'Just now',
        ip_address: '192.168.1.104',
        description: 'Biometric checkpoint for Anatomy & Physiology laboratory',
      },
    ];

    // 9. Seed August 2026 Attendance Records
    const augDays = [3, 4, 5, 6, 7, 10, 11, 12, 13, 14, 17, 18, 19];
    for (const day of augDays) {
      const dayStr = day < 10 ? `0${day}` : `${day}`;
      const dateStr = `2026-08-${dayStr}`;

      for (const student of this.students) {
        for (const period of this.periods) {
          let status: 'PRESENT' | 'ABSENT' | 'LATE' = 'PRESENT';
          let aiResult: 'PRESENT' | 'ABSENT' | 'LATE' = 'PRESENT';
          let isManual = false;
          let reason = '';

          if (dateStr === '2026-08-19' && student.id === 2) {
            // Student 2 has consecutive absence on Aug 19
            status = 'ABSENT';
            aiResult = 'ABSENT';
          } else if (dateStr === '2026-08-19' && student.id === 1) {
            if (period.period_number === 2) {
              status = 'PRESENT';
              aiResult = 'ABSENT';
              isManual = true;
              reason = 'Student was present in classroom; verified by teacher override';
            } else {
              status = 'PRESENT';
              aiResult = 'PRESENT';
            }
          } else {
            const pseudoRand = (student.id * 17 + day * 13 + period.period_number * 7) % 100;
            if (pseudoRand < 80) {
              status = 'PRESENT';
              aiResult = 'PRESENT';
            } else if (pseudoRand < 90) {
              status = 'LATE';
              aiResult = 'LATE';
            } else {
              status = 'ABSENT';
              aiResult = 'ABSENT';
            }
          }

          const modifiedBy = isManual ? 'Admin (Prof. Sharma)' : null;
          const modifiedAt = isManual ? `${dateStr}T10:15:00Z` : null;
          const firstSeen = status !== 'ABSENT' ? '09:34:12' : null;
          const lastSeen = status !== 'ABSENT' ? '10:18:30' : null;
          const confidence = status !== 'ABSENT' ? 0.94 : 0.0;
          const matchCount = status !== 'ABSENT' ? 5 : 0;

          const recId = this.nextAttendanceId++;
          this.attendance.push({
            id: recId,
            student_id: student.id,
            date: dateStr,
            period_id: period.id,
            status,
            first_seen: firstSeen,
            last_seen: lastSeen,
            ai_result: aiResult,
            final_result: status,
            modified_by: modifiedBy,
            modified_at: modifiedAt,
            modification_reason: reason || null,
            confidence,
            match_count: matchCount,
          });

          if (isManual) {
            this.audit_logs.push({
              id: this.nextAuditLogId++,
              attendance_id: recId,
              old_status: 'ABSENT',
              new_status: 'PRESENT',
              changed_by: 'Admin (Prof. Sharma)',
              reason,
              changed_at: modifiedAt!,
            });
          }
        }
      }
    }
  }

  // --- Users & Roles Management ---
  public getUsers(): SystemUserRecord[] {
    return [...this.users].sort((a, b) => a.id - b.id);
  }

  public getUserById(id: number): SystemUserRecord | null {
    return this.users.find((u) => u.id === id) || null;
  }

  public addUser(data: Omit<SystemUserRecord, 'id' | 'created_at'>): SystemUserRecord {
    const newUser: SystemUserRecord = {
      id: this.nextUserId++,
      ...data,
      created_at: new Date().toISOString(),
    };
    this.users.push(newUser);
    return newUser;
  }

  public updateUser(id: number, data: Partial<SystemUserRecord>): SystemUserRecord | null {
    const idx = this.users.findIndex((u) => u.id === id);
    if (idx === -1) return null;
    this.users[idx] = { ...this.users[idx], ...data };
    return this.users[idx];
  }

  public deleteUser(id: number): boolean {
    const idx = this.users.findIndex((u) => u.id === id);
    if (idx === -1) return false;
    this.users.splice(idx, 1);
    return true;
  }

  // --- Cameras Management ---
  public getCameras(): CameraFeedRecord[] {
    return [...this.cameras];
  }

  public addCamera(data: CameraFeedRecord): CameraFeedRecord {
    this.cameras.push(data);
    return data;
  }

  public updateCamera(id: string, data: Partial<CameraFeedRecord>): CameraFeedRecord | null {
    const idx = this.cameras.findIndex((c) => c.id === id);
    if (idx === -1) return null;
    this.cameras[idx] = { ...this.cameras[idx], ...data };
    return this.cameras[idx];
  }

  // --- Student operations ---
  public getStudents(includeInactive = true): (StudentRecord & { face_embeddings_count: number })[] {
    return this.students
      .filter((s) => (includeInactive ? true : s.active === 1))
      .map((s) => {
        const count = this.face_embeddings.filter((fe) => fe.student_id === s.id).length;
        return { ...s, face_embeddings_count: count };
      })
      .sort((a, b) => a.roll_number.localeCompare(b.roll_number));
  }

  public getStudentById(id: number): (StudentRecord & { face_embeddings_count: number }) | null {
    const s = this.students.find((stu) => stu.id === id);
    if (!s) return null;
    const count = this.face_embeddings.filter((fe) => fe.student_id === s.id).length;
    return { ...s, face_embeddings_count: count };
  }

  public getStudentByRoll(roll: string): StudentRecord | null {
    return this.students.find((s) => s.roll_number.toLowerCase() === roll.trim().toLowerCase()) || null;
  }

  public addStudent(data: Omit<StudentRecord, 'id' | 'created_at'>): StudentRecord {
    const newStudent: StudentRecord = {
      id: this.nextStudentId++,
      ...data,
      created_at: new Date().toISOString(),
    };
    this.students.push(newStudent);
    return newStudent;
  }

  public updateStudent(id: number, data: Partial<StudentRecord>): StudentRecord | null {
    const index = this.students.findIndex((s) => s.id === id);
    if (index === -1) return null;
    this.students[index] = { ...this.students[index], ...data };
    return this.students[index];
  }

  public deleteStudent(id: number): boolean {
    const idx = this.students.findIndex((s) => s.id === id);
    if (idx === -1) return false;
    this.students.splice(idx, 1);
    this.face_embeddings = this.face_embeddings.filter((fe) => fe.student_id !== id);
    this.attendance = this.attendance.filter((a) => a.student_id !== id);
    return true;
  }

  // --- Face Embeddings ---
  public getFaceEmbeddings() {
    return this.face_embeddings.map((fe) => {
      const student = this.students.find((s) => s.id === fe.student_id);
      return {
        id: fe.id,
        student_id: fe.student_id,
        roll_number: student?.roll_number || '',
        name: student?.name || '',
        class_name: student?.class_name || '',
        section: student?.section || '',
        embedding: fe.embedding,
      };
    });
  }

  public addFaceEmbedding(studentId: number, embedding: string) {
    const rec: FaceEmbeddingRecord = {
      id: this.nextEmbeddingId++,
      student_id: studentId,
      embedding,
      created_at: new Date().toISOString(),
    };
    this.face_embeddings.push(rec);
    return rec;
  }

  // --- Periods ---
  public getPeriods(includeAll = false): PeriodRecord[] {
    if (includeAll) {
      return [...this.periods].sort((a, b) => a.period_number - b.period_number);
    }
    return this.periods.filter((p) => p.active === 1).sort((a, b) => a.period_number - b.period_number);
  }

  public addPeriod(data: { period_number: number; start_time: string; end_time: string; label?: string }): PeriodRecord {
    const newPeriod: PeriodRecord = {
      id: this.nextPeriodId++,
      period_number: data.period_number,
      start_time: data.start_time,
      end_time: data.end_time,
      label: data.label || `P${data.period_number}`,
      active: 1,
    };
    this.periods.push(newPeriod);
    return newPeriod;
  }

  public updatePeriod(id: number, data: Partial<PeriodRecord>): PeriodRecord | null {
    const idx = this.periods.findIndex((p) => p.id === id);
    if (idx === -1) return null;
    this.periods[idx] = { ...this.periods[idx], ...data };
    return this.periods[idx];
  }

  public deletePeriod(id: number): boolean {
    const idx = this.periods.findIndex((p) => p.id === id);
    if (idx === -1) return false;
    this.periods.splice(idx, 1);
    return true;
  }

  // --- Timetable ---
  public getTimetable(): TimetableSlotRecord[] {
    return this.timetable;
  }

  public updateTimetableSlot(data: Omit<TimetableSlotRecord, 'id'>): TimetableSlotRecord {
    const idx = this.timetable.findIndex(
      (t) => t.day_of_week === data.day_of_week && t.period_number === data.period_number
    );
    if (idx >= 0) {
      this.timetable[idx] = { id: this.timetable[idx].id, ...data };
      return this.timetable[idx];
    } else {
      const newSlot: TimetableSlotRecord = { id: this.nextTimetableId++, ...data };
      this.timetable.push(newSlot);
      return newSlot;
    }
  }

  // --- Academic Calendar ---
  public getCalendar(): AcademicCalendarRecord[] {
    return this.calendar.sort((a, b) => a.date.localeCompare(b.date));
  }

  public getCalendarEvent(date: string): AcademicCalendarRecord | null {
    return this.calendar.find((c) => c.date === date) || null;
  }

  public addCalendarEvent(data: { date: string; day_type: AcademicCalendarRecord['day_type']; title: string; description?: string }) {
    const existingIdx = this.calendar.findIndex((c) => c.date === data.date);
    const now = new Date().toISOString();
    if (existingIdx >= 0) {
      this.calendar[existingIdx] = {
        ...this.calendar[existingIdx],
        ...data,
      };
      return this.calendar[existingIdx];
    }
    const newEvent: AcademicCalendarRecord = {
      id: this.nextCalendarId++,
      date: data.date,
      day_type: data.day_type,
      title: data.title,
      description: data.description || '',
      created_by: 'System Admin',
      created_at: now,
    };
    this.calendar.push(newEvent);
    return newEvent;
  }

  public deleteCalendarEvent(id: number): boolean {
    const idx = this.calendar.findIndex((c) => c.id === id);
    if (idx === -1) return false;
    this.calendar.splice(idx, 1);
    return true;
  }

  // --- Attendance Records ---
  public getAttendance(filters?: { date?: string; period_id?: number; student_id?: number; start_date?: string; end_date?: string; status?: string }) {
    return this.attendance.filter((a) => {
      if (filters?.date && a.date !== filters.date) return false;
      if (filters?.period_id && a.period_id !== filters.period_id) return false;
      if (filters?.student_id && a.student_id !== filters.student_id) return false;
      if (filters?.start_date && a.date < filters.start_date) return false;
      if (filters?.end_date && a.date > filters.end_date) return false;
      if (filters?.status && filters.status !== 'ALL' && a.final_result !== filters.status) return false;
      return true;
    });
  }

  public findAttendanceRecord(studentId: number, date: string, periodId: number): AttendanceRecord | null {
    return this.attendance.find((a) => a.student_id === studentId && a.date === date && a.period_id === periodId) || null;
  }

  public upsertAttendanceRecord(data: Omit<AttendanceRecord, 'id'>): AttendanceRecord {
    const idx = this.attendance.findIndex(
      (a) => a.student_id === data.student_id && a.date === data.date && a.period_id === data.period_id
    );
    if (idx >= 0) {
      this.attendance[idx] = {
        ...this.attendance[idx],
        ...data,
      };
      return this.attendance[idx];
    }
    const newRec: AttendanceRecord = {
      id: this.nextAttendanceId++,
      ...data,
    };
    this.attendance.push(newRec);
    return newRec;
  }

  // --- Audit Log ---
  public getAuditLogs() {
    return this.audit_logs
      .map((l) => {
        const att = this.attendance.find((a) => a.id === l.attendance_id);
        const stu = att ? this.students.find((s) => s.id === att.student_id) : null;
        const period = att ? this.periods.find((p) => p.id === att.period_id) : null;
        return {
          ...l,
          student_name: stu?.name || 'Unknown Student',
          roll_number: stu?.roll_number || '',
          date: att?.date || '',
          period_number: period?.period_number || 1,
        };
      })
      .sort((a, b) => b.changed_at.localeCompare(a.changed_at));
  }

  public addAuditLog(log: Omit<AttendanceAuditLogRecord, 'id'>) {
    const rec: AttendanceAuditLogRecord = {
      id: this.nextAuditLogId++,
      ...log,
    };
    this.audit_logs.push(rec);
    return rec;
  }

  // --- Data Retention Cleanup ---
  public pruneExpiredAttendanceRecords(retentionDays: number = 90) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - retentionDays);
    const cutoffDateStr = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, '0')}-${String(cutoff.getDate()).padStart(2, '0')}`;

    const beforeCount = this.attendance.length;
    this.attendance = this.attendance.filter((a) => a.date >= cutoffDateStr);
    const purgedCount = beforeCount - this.attendance.length;

    return {
      success: true,
      storageMode: 'IN_MEMORY_STORE',
      retentionDays,
      cutoffDate: cutoffDateStr,
      purgedCount,
      timestamp: new Date().toISOString(),
    };
  }
}

export const store = new InMemoryStore();

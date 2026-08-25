"""
=============================================================================
AI-Based CCTV Automated Period-Wise Student Attendance System
Stage 1: SQLite Database Initialization & Schema Definition
=============================================================================
Module: database.py
Description: Initializes 'attendance.db' SQLite database with all core tables:
  - students (id, roll_number, name, class_name, section, password_hash, active, created_at)
  - face_embeddings (id, student_id, embedding, created_at)
  - periods (id, period_number, start_time, end_time, active)
  - attendance (id, student_id, date, period_id, status, first_seen, last_seen,
                ai_result, final_result, modified_by, modified_at, modification_reason)
  - attendance_audit_log (id, attendance_id, old_status, new_status, changed_by, reason, changed_at)
  - admins (id, username, full_name, password_hash, role, created_at)
  - system_settings (key, value)

Unique Constraints:
  - UNIQUE(student_id, date, period_id) on attendance table
  - UNIQUE(roll_number) on students table
  - UNIQUE(period_number) on periods table
=============================================================================
"""

import sqlite3
import os
import json
import hashlib
import binascii
from datetime import datetime

# Database file location
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "attendance.db")


def get_db_connection(db_path=DB_PATH):
    """
    Establishes and returns a connection to the SQLite attendance database.
    Row factory is set to sqlite3.Row for dict-like access.
    """
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn


def hash_password_fallback(password: str, salt: str = None) -> str:
    """
    Secure password hashing using PBKDF2-HMAC-SHA256 with 100,000 iterations.
    Compatible with pure Python standard library.
    """
    if salt is None:
        salt = binascii.hexlify(os.urandom(16)).decode('utf-8')
    pwd_hash = hashlib.pbkdf2_hmac(
        'sha256',
        password.encode('utf-8'),
        salt.encode('utf-8'),
        100000
    )
    return f"pbkdf2:sha256:100000${salt}${binascii.hexlify(pwd_hash).decode('utf-8')}"


def init_db(db_path=DB_PATH, drop_existing=False):
    """
    Initializes all database tables with strict schema definitions and constraints.
    """
    conn = get_db_connection(db_path)
    cursor = conn.cursor()

    if drop_existing:
        print("[DATABASE] Dropping existing tables...")
        cursor.executescript("""
            DROP TABLE IF EXISTS attendance_audit_log;
            DROP TABLE IF EXISTS attendance;
            DROP TABLE IF EXISTS face_embeddings;
            DROP TABLE IF EXISTS students;
            DROP TABLE IF EXISTS periods;
            DROP TABLE IF EXISTS admins;
            DROP TABLE IF EXISTS system_settings;
        """)

    print(f"[DATABASE] Creating tables in {db_path}...")

    # 1. Admins Table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS admins (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            full_name TEXT NOT NULL,
            password_hash TEXT NOT NULL,
            role TEXT DEFAULT 'admin',
            created_at TEXT NOT NULL
        );
    """)

    # 2. Students Table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS students (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            roll_number TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            class_name TEXT NOT NULL,
            section TEXT NOT NULL,
            password_hash TEXT NOT NULL,
            active INTEGER DEFAULT 1,
            created_at TEXT NOT NULL
        );
    """)

    # 3. Face Embeddings Table (Stores 128-d or 512-d feature vectors as JSON array or BLOB)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS face_embeddings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            student_id INTEGER NOT NULL,
            embedding TEXT NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY (student_id) REFERENCES students (id) ON DELETE CASCADE
        );
    """)

    # 4. Periods Timetable Table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS periods (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            period_number INTEGER UNIQUE NOT NULL,
            start_time TEXT NOT NULL,
            end_time TEXT NOT NULL,
            active INTEGER DEFAULT 1
        );
    """)

    # 5. Attendance Table (with UNIQUE constraint on student_id, date, period_id)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS attendance (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            student_id INTEGER NOT NULL,
            date TEXT NOT NULL,
            period_id INTEGER NOT NULL,
            status TEXT NOT NULL CHECK(status IN ('PRESENT', 'ABSENT', 'LATE')),
            first_seen TEXT,
            last_seen TEXT,
            ai_result TEXT,
            final_result TEXT NOT NULL,
            modified_by TEXT,
            modified_at TEXT,
            modification_reason TEXT,
            FOREIGN KEY (student_id) REFERENCES students (id) ON DELETE CASCADE,
            FOREIGN KEY (period_id) REFERENCES periods (id) ON DELETE CASCADE,
            UNIQUE (student_id, date, period_id)
        );
    """)

    # 6. Attendance Audit Log Table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS attendance_audit_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            attendance_id INTEGER NOT NULL,
            old_status TEXT NOT NULL,
            new_status TEXT NOT NULL,
            changed_by TEXT NOT NULL,
            reason TEXT NOT NULL,
            changed_at TEXT NOT NULL,
            FOREIGN KEY (attendance_id) REFERENCES attendance (id) ON DELETE CASCADE
        );
    """)

    # 7. System Settings & Thresholds Table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS system_settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );
    """)

    conn.commit()
    print("[DATABASE] All tables created successfully.")
    conn.close()


def seed_default_data(db_path=DB_PATH):
    """
    Seeds default administrative users, sample timetable periods, student records,
    and system settings into the database.
    """
    conn = get_db_connection(db_path)
    cursor = conn.cursor()
    now = datetime.now().isoformat()

    print("[DATABASE] Seeding initial dataset...")

    # Seed Admin User
    admin_check = cursor.execute("SELECT id FROM admins WHERE username = ?", ("admin",)).fetchone()
    if not admin_check:
        admin_pwd_hash = hash_password_fallback("admin123")
        cursor.execute("""
            INSERT INTO admins (username, full_name, password_hash, role, created_at)
            VALUES (?, ?, ?, ?, ?)
        """, ("admin", "Prof. R. Sharma (HOD / System Admin)", admin_pwd_hash, "admin", now))
        print("[DATABASE] Seeded admin user (username: admin, password: admin123)")

    # Seed Periods Timetable (5 standard class periods)
    default_periods = [
        (1, "09:00", "10:00", 1),
        (2, "10:00", "11:00", 1),
        (3, "11:15", "12:15", 1),
        (4, "13:00", "14:00", 1),
        (5, "14:00", "15:00", 1),
    ]
    for p_num, start, end, active in default_periods:
        cursor.execute("""
            INSERT OR IGNORE INTO periods (period_number, start_time, end_time, active)
            VALUES (?, ?, ?, ?)
        """, (p_num, start, end, active))

    # Seed Initial Authorized Students
    default_students = [
        ("CS2026001", "Aarav Patel", "B.Tech CSE - Final Year", "A", "student123"),
        ("CS2026002", "Priya Sharma", "B.Tech CSE - Final Year", "A", "student123"),
        ("CS2026003", "Rohan Verma", "B.Tech CSE - Final Year", "A", "student123"),
        ("CS2026004", "Ananya Iyer", "B.Tech CSE - Final Year", "A", "student123"),
        ("CS2026005", "Vikram Malhotra", "B.Tech CSE - Final Year", "A", "student123"),
    ]

    for roll, name, cls, sec, pwd in default_students:
        pwd_hash = hash_password_fallback(pwd)
        cursor.execute("""
            INSERT OR IGNORE INTO students (roll_number, name, class_name, section, password_hash, active, created_at)
            VALUES (?, ?, ?, ?, ?, 1, ?)
        """, (roll, name, cls, sec, pwd_hash, now))

    # Seed System Settings
    default_settings = {
        "min_attendance_percentage": "75",
        "late_threshold_minutes": "15",
        "confidence_threshold": "0.65",
        "observation_frames_required": "3",
        "cctv_rtsp_url": "rtsp://admin:cctv_secure@192.168.1.120:554/live/ch0",
        "camera_mode": "test_video",
        "attendance_closing_minutes": "50",
    }
    for key, val in default_settings.items():
        cursor.execute("""
            INSERT OR REPLACE INTO system_settings (key, value)
            VALUES (?, ?)
        """, (key, val))

    conn.commit()
    print("[DATABASE] Default dataset seeding complete.")
    conn.close()


if __name__ == "__main__":
    print("=" * 70)
    print("AI-Based CCTV Attendance System - Database Setup (Stage 1)")
    print("=" * 70)
    init_db(drop_existing=False)
    seed_default_data()
    print(f"\nDatabase initialized at: {DB_PATH}")
    print("Run `python auth.py` to test authentication flows.")
    print("=" * 70)

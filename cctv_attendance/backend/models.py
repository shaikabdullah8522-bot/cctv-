"""
=============================================================================
AI-Based CCTV Automated Period-Wise Student Attendance System
SQLAlchemy ORM Models
=============================================================================
Module: models.py
Description: Defines SQLAlchemy ORM data models corresponding to the SQLite
database schema:
  - Student: Registered student records with credentials
  - FaceEmbedding: Biometric feature vector embeddings
  - Period: Class timetable schedule periods
  - Attendance: Period-wise attendance status with UNIQUE(student_id, date, period_id)
  - AttendanceAuditLog: Traceability log for manual attendance overrides
  - Admin: System administrator and faculty accounts
  - SystemSetting: Configurable system parameters and thresholds
=============================================================================
"""

from datetime import datetime
from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    ForeignKey,
    UniqueConstraint,
    CheckConstraint,
    DateTime,
)
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()


class Admin(Base):
    """
    Administrator and Faculty user accounts.
    """
    __tablename__ = "admins"

    id = Column(Integer, primary_key=True, autoincrement=True)
    username = Column(String(50), unique=True, nullable=False, index=True)
    full_name = Column(String(100), nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(20), default="admin", nullable=False)
    created_at = Column(String(50), default=lambda: datetime.now().isoformat(), nullable=False)

    def to_dict(self):
        return {
            "id": self.id,
            "username": self.username,
            "full_name": self.full_name,
            "role": self.role,
            "created_at": self.created_at,
        }


class Student(Base):
    """
    Enrolled students subject to automated CCTV period-wise attendance.
    """
    __tablename__ = "students"

    id = Column(Integer, primary_key=True, autoincrement=True)
    roll_number = Column(String(50), unique=True, nullable=False, index=True)
    name = Column(String(100), nullable=False)
    class_name = Column(String(100), nullable=False)
    section = Column(String(20), nullable=False)
    password_hash = Column(String(255), nullable=False)
    active = Column(Integer, default=1, nullable=False)
    created_at = Column(String(50), default=lambda: datetime.now().isoformat(), nullable=False)

    # Relationships
    embeddings = relationship("FaceEmbedding", back_populates="student", cascade="all, delete-orphan")
    attendance_records = relationship("Attendance", back_populates="student", cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "id": self.id,
            "roll_number": self.roll_number,
            "name": self.name,
            "class_name": self.class_name,
            "section": self.section,
            "active": bool(self.active),
            "created_at": self.created_at,
        }


class FaceEmbedding(Base):
    """
    Biometric feature embeddings extracted from student facial photographs.
    """
    __tablename__ = "face_embeddings"

    id = Column(Integer, primary_key=True, autoincrement=True)
    student_id = Column(Integer, ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True)
    embedding = Column(Text, nullable=False)  # JSON-serialized float array or base64 blob
    created_at = Column(String(50), default=lambda: datetime.now().isoformat(), nullable=False)

    # Relationship
    student = relationship("Student", back_populates="embeddings")

    def to_dict(self):
        return {
            "id": self.id,
            "student_id": self.student_id,
            "created_at": self.created_at,
        }


class Period(Base):
    """
    Institutional timetable periods defining time windows for attendance.
    """
    __tablename__ = "periods"

    id = Column(Integer, primary_key=True, autoincrement=True)
    period_number = Column(Integer, unique=True, nullable=False, index=True)
    start_time = Column(String(10), nullable=False)  # Format: "HH:MM" (e.g., "09:00")
    end_time = Column(String(10), nullable=False)    # Format: "HH:MM" (e.g., "10:00")
    active = Column(Integer, default=1, nullable=False)

    # Relationship
    attendance_records = relationship("Attendance", back_populates="period", cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "id": self.id,
            "period_number": self.period_number,
            "start_time": self.start_time,
            "end_time": self.end_time,
            "active": bool(self.active),
        }


class Attendance(Base):
    """
    Period-wise attendance entry recorded via CCTV AI or manual teacher override.
    Enforces the composite unique constraint: UNIQUE(student_id, date, period_id).
    """
    __tablename__ = "attendance"

    id = Column(Integer, primary_key=True, autoincrement=True)
    student_id = Column(Integer, ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True)
    date = Column(String(20), nullable=False, index=True)  # Format: "YYYY-MM-DD"
    period_id = Column(Integer, ForeignKey("periods.id", ondelete="CASCADE"), nullable=False, index=True)
    status = Column(String(20), nullable=False)  # 'PRESENT', 'ABSENT', 'LATE'
    first_seen = Column(String(50), nullable=True)
    last_seen = Column(String(50), nullable=True)
    ai_result = Column(String(50), nullable=True)
    final_result = Column(String(50), nullable=False)
    modified_by = Column(String(100), nullable=True)
    modified_at = Column(String(50), nullable=True)
    modification_reason = Column(Text, nullable=True)

    # Table constraints
    __table_args__ = (
        UniqueConstraint("student_id", "date", "period_id", name="uq_student_date_period"),
        CheckConstraint("status IN ('PRESENT', 'ABSENT', 'LATE')", name="chk_attendance_status"),
    )

    # Relationships
    student = relationship("Student", back_populates="attendance_records")
    period = relationship("Period", back_populates="attendance_records")
    audit_logs = relationship("AttendanceAuditLog", back_populates="attendance", cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "id": self.id,
            "student_id": self.student_id,
            "date": self.date,
            "period_id": self.period_id,
            "status": self.status,
            "first_seen": self.first_seen,
            "last_seen": self.last_seen,
            "ai_result": self.ai_result,
            "final_result": self.final_result,
            "modified_by": self.modified_by,
            "modified_at": self.modified_at,
            "modification_reason": self.modification_reason,
        }


class AttendanceAuditLog(Base):
    """
    Immutable audit trail logging every manual change to attendance records.
    """
    __tablename__ = "attendance_audit_log"

    id = Column(Integer, primary_key=True, autoincrement=True)
    attendance_id = Column(Integer, ForeignKey("attendance.id", ondelete="CASCADE"), nullable=False, index=True)
    old_status = Column(String(20), nullable=False)
    new_status = Column(String(20), nullable=False)
    changed_by = Column(String(100), nullable=False)
    reason = Column(Text, nullable=False)
    changed_at = Column(String(50), default=lambda: datetime.now().isoformat(), nullable=False)

    # Relationship
    attendance = relationship("Attendance", back_populates="audit_logs")

    def to_dict(self):
        return {
            "id": self.id,
            "attendance_id": self.attendance_id,
            "old_status": self.old_status,
            "new_status": self.new_status,
            "changed_by": self.changed_by,
            "reason": self.reason,
            "changed_at": self.changed_at,
        }


class SystemSetting(Base):
    """
    Key-value pairs for global application and AI detection parameters.
    """
    __tablename__ = "system_settings"

    key = Column(String(100), primary_key=True)
    value = Column(Text, nullable=False)

    def to_dict(self):
        return {self.key: self.value}

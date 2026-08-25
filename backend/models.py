"""
=============================================================================
AI-Based CCTV Automated Period-Wise Student Attendance System
SQLAlchemy ORM Models
=============================================================================
Module: models.py
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
)
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()


class Admin(Base):
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
    __tablename__ = "students"

    id = Column(Integer, primary_key=True, autoincrement=True)
    roll_number = Column(String(50), unique=True, nullable=False, index=True)
    name = Column(String(100), nullable=False)
    class_name = Column(String(100), nullable=False)
    section = Column(String(20), nullable=False)
    password_hash = Column(String(255), nullable=False)
    active = Column(Integer, default=1, nullable=False)
    created_at = Column(String(50), default=lambda: datetime.now().isoformat(), nullable=False)

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
    __tablename__ = "face_embeddings"

    id = Column(Integer, primary_key=True, autoincrement=True)
    student_id = Column(Integer, ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True)
    embedding = Column(Text, nullable=False)
    created_at = Column(String(50), default=lambda: datetime.now().isoformat(), nullable=False)

    student = relationship("Student", back_populates="embeddings")


class Period(Base):
    __tablename__ = "periods"

    id = Column(Integer, primary_key=True, autoincrement=True)
    period_number = Column(Integer, unique=True, nullable=False, index=True)
    start_time = Column(String(10), nullable=False)
    end_time = Column(String(10), nullable=False)
    active = Column(Integer, default=1, nullable=False)

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
    __tablename__ = "attendance"

    id = Column(Integer, primary_key=True, autoincrement=True)
    student_id = Column(Integer, ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True)
    date = Column(String(20), nullable=False, index=True)
    period_id = Column(Integer, ForeignKey("periods.id", ondelete="CASCADE"), nullable=False, index=True)
    status = Column(String(20), nullable=False)
    first_seen = Column(String(50), nullable=True)
    last_seen = Column(String(50), nullable=True)
    ai_result = Column(String(50), nullable=True)
    final_result = Column(String(50), nullable=False)
    modified_by = Column(String(100), nullable=True)
    modified_at = Column(String(50), nullable=True)
    modification_reason = Column(Text, nullable=True)

    __table_args__ = (
        UniqueConstraint("student_id", "date", "period_id", name="uq_student_date_period"),
        CheckConstraint("status IN ('PRESENT', 'ABSENT', 'LATE')", name="chk_attendance_status"),
    )

    student = relationship("Student", back_populates="attendance_records")
    period = relationship("Period", back_populates="attendance_records")
    audit_logs = relationship("AttendanceAuditLog", back_populates="attendance", cascade="all, delete-orphan")


class AttendanceAuditLog(Base):
    __tablename__ = "attendance_audit_log"

    id = Column(Integer, primary_key=True, autoincrement=True)
    attendance_id = Column(Integer, ForeignKey("attendance.id", ondelete="CASCADE"), nullable=False, index=True)
    old_status = Column(String(20), nullable=False)
    new_status = Column(String(20), nullable=False)
    changed_by = Column(String(100), nullable=False)
    reason = Column(Text, nullable=False)
    changed_at = Column(String(50), default=lambda: datetime.now().isoformat(), nullable=False)

    attendance = relationship("Attendance", back_populates="audit_logs")


class SystemSetting(Base):
    __tablename__ = "system_settings"

    key = Column(String(100), primary_key=True)
    value = Column(Text, nullable=False)

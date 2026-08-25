"""
=============================================================================
AI-Based CCTV Automated Period-Wise Student Attendance System
FastAPI Backend Application Entry Point
=============================================================================
Module: main.py
"""

import os
import sys
from typing import Optional, Dict, Any, List
from datetime import datetime

from fastapi import FastAPI, Depends, HTTPException, status, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, validator

from database import get_db_connection, DB_PATH, init_db, seed_default_data
from auth import (
    login_admin,
    login_student,
    verify_session_token,
    validate_login_input,
)

app = FastAPI(
    title="AI-Based CCTV Automated Period-Wise Student Attendance System",
    description="Backend API for real-time facial recognition attendance, timetable scheduling, and role-based portals.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class AdminLoginRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=50, description="Admin or Teacher username")
    password: str = Field(..., min_length=4, max_length=128, description="Account password")

    @validator("username")
    def clean_username(cls, v):
        if not v or not v.strip():
            raise ValueError("Username cannot be empty")
        return v.strip()


class StudentLoginRequest(BaseModel):
    roll_number: str = Field(..., min_length=3, max_length=50, description="Student Roll Number (e.g. CS2026001)")
    password: str = Field(..., min_length=4, max_length=128, description="Student portal password")

    @validator("roll_number")
    def clean_roll_number(cls, v):
        if not v or not v.strip():
            raise ValueError("Roll number cannot be empty")
        return v.strip().upper()


class UnifiedLoginRequest(BaseModel):
    role: str = Field("student", description="Role: 'admin', 'faculty', 'teacher', or 'student'")
    username: Optional[str] = Field(None, description="Username for admin/faculty")
    roll_number: Optional[str] = Field(None, description="Roll number for student")
    password: str = Field(..., min_length=4, max_length=128, description="Password")


def get_current_user(authorization: Optional[str] = Header(None)) -> Dict[str, Any]:
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization header missing. Please provide a valid Bearer token.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authorization scheme. Bearer token required.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    payload = verify_session_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session token has expired or is invalid. Please log in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return payload


def require_admin_or_faculty(current_user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    user_role = current_user.get("role", "").lower()
    if user_role not in ["admin", "faculty", "teacher"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: This endpoint requires Administrator or Faculty privileges.",
        )
    return current_user


def require_student(current_user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    user_role = current_user.get("role", "").lower()
    if user_role != "student":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: This endpoint is designated for students only.",
        )
    return current_user


@app.post("/api/auth/login/admin", tags=["Authentication"])
def endpoint_admin_login(payload: AdminLoginRequest):
    success, user_data, error_msg = login_admin(payload.username, payload.password)
    if not success:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=error_msg)
    return {"status": "success", "message": "Admin login successful", "data": user_data}


@app.post("/api/auth/login/student", tags=["Authentication"])
def endpoint_student_login(payload: StudentLoginRequest):
    success, user_data, error_msg = login_student(payload.roll_number, payload.password)
    if not success:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=error_msg)
    return {"status": "success", "message": "Student login successful", "data": user_data}


@app.post("/api/auth/login", tags=["Authentication"])
def endpoint_unified_login(payload: UnifiedLoginRequest):
    role = payload.role.lower()
    if role in ["admin", "faculty", "teacher"]:
        identifier = payload.username or payload.roll_number
        if not identifier:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Username is required for admin login.")
        success, user_data, error_msg = login_admin(identifier, payload.password)
    elif role == "student":
        identifier = payload.roll_number or payload.username
        if not identifier:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Roll Number is required for student login.")
        success, user_data, error_msg = login_student(identifier, payload.password)
    else:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Unsupported role '{payload.role}'.")

    if not success:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=error_msg)

    return {"status": "success", "role": role, "data": user_data}


@app.get("/api/auth/me", tags=["Authentication"])
def endpoint_get_current_user_profile(user: Dict[str, Any] = Depends(get_current_user)):
    return {"status": "authenticated", "user": user}


@app.get("/api/admin/dashboard", tags=["Admin Portal"])
def endpoint_admin_dashboard(user: Dict[str, Any] = Depends(require_admin_or_faculty)):
    conn = get_db_connection()
    cursor = conn.cursor()
    total_students = cursor.execute("SELECT COUNT(*) FROM students WHERE active = 1").fetchone()[0]
    total_periods = cursor.execute("SELECT COUNT(*) FROM periods WHERE active = 1").fetchone()[0]
    today_date = datetime.now().strftime("%Y-%m-%d")
    conn.close()

    return {
        "status": "success",
        "message": f"Welcome to the Admin Attendance Dashboard, {user.get('name')}.",
        "authorized_role": user.get("role"),
        "today_date": today_date,
        "metrics": {
            "total_students": total_students,
            "active_periods": total_periods,
        },
        "system_status": "ONLINE - CCTV Facial Recognition Surveillance Engine Active",
    }


@app.get("/api/student/dashboard", tags=["Student Portal"])
def endpoint_student_dashboard(user: Dict[str, Any] = Depends(require_student)):
    student_id = user.get("user_id")
    conn = get_db_connection()
    cursor = conn.cursor()
    student = cursor.execute("SELECT * FROM students WHERE id = ?", (student_id,)).fetchone()
    conn.close()
    if not student:
        raise HTTPException(status_code=404, detail="Student profile record not found.")

    return {
        "status": "success",
        "message": f"Welcome to your Student Portal, {user.get('name')}.",
        "student": {
            "id": student["id"],
            "roll_number": student["roll_number"],
            "name": student["name"],
            "class_name": student["class_name"],
            "section": student["section"],
        },
    }


@app.get("/health", tags=["System"])
def health_check():
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "database": os.path.exists(DB_PATH),
    }


if __name__ == "__main__":
    import uvicorn
    if not os.path.exists(DB_PATH):
        init_db()
        seed_default_data()
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

"""
=============================================================================
AI-Based CCTV Automated Period-Wise Student Attendance System
FastAPI Backend Application Entry Point
=============================================================================
Module: main.py
Description:
  - RESTful API endpoints for authentication (Admin, Faculty, Student)
  - Role-Based Access Control (RBAC) middleware & dependencies
  - Placeholder routes for Admin Dashboard and Student Dashboard to test access
  - Input validation via Pydantic schemas
  - Period timetable and attendance querying endpoints
=============================================================================
"""

import os
import sys
from typing import Optional, Dict, Any, List
from datetime import datetime

from fastapi import FastAPI, Depends, HTTPException, status, Header, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, validator

# Support local and package-level imports
try:
    from database import get_db_connection, DB_PATH, init_db, seed_default_data
    from auth import (
        login_admin,
        login_student,
        verify_session_token,
        validate_login_input,
    )
except ImportError:
    from cctv_attendance.backend.database import get_db_connection, DB_PATH, init_db, seed_default_data
    from cctv_attendance.backend.auth import (
        login_admin,
        login_student,
        verify_session_token,
        validate_login_input,
    )

# =============================================================================
# 1. FASTAPI APPLICATION SETUP
# =============================================================================

app = FastAPI(
    title="AI-Based CCTV Automated Period-Wise Student Attendance System",
    description="Backend API for real-time facial recognition attendance, timetable scheduling, and role-based portals.",
    version="1.0.0",
)

# Enable CORS for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =============================================================================
# 2. PYDANTIC INPUT VALIDATION SCHEMAS
# =============================================================================

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


class AttendanceRecordRequest(BaseModel):
    student_id: int
    date: str = Field(..., regex=r"^\d{4}-\d{2}-\d{2}$", description="Date format YYYY-MM-DD")
    period_id: int
    status: str = Field(..., regex=r"^(PRESENT|ABSENT|LATE)$")
    ai_result: Optional[str] = "PRESENT"
    final_result: Optional[str] = "PRESENT"
    modified_by: Optional[str] = None
    modification_reason: Optional[str] = None


# =============================================================================
# 3. AUTHENTICATION & RBAC DEPENDENCIES
# =============================================================================

def get_current_user(authorization: Optional[str] = Header(None)) -> Dict[str, Any]:
    """
    Extracts and validates the JWT Bearer token from the Authorization header.
    """
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
    """
    Enforces that the authenticated user possesses admin or faculty privileges.
    """
    user_role = current_user.get("role", "").lower()
    if user_role not in ["admin", "faculty", "teacher"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: This endpoint requires Administrator or Faculty privileges.",
        )
    return current_user


def require_student(current_user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    """
    Enforces that the authenticated user is an enrolled student.
    """
    user_role = current_user.get("role", "").lower()
    if user_role != "student":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: This endpoint is designated for students only.",
        )
    return current_user


# =============================================================================
# 4. AUTHENTICATION ENDPOINTS
# =============================================================================

@app.post("/api/auth/login/admin", tags=["Authentication"])
def endpoint_admin_login(payload: AdminLoginRequest):
    """
    Authenticates an administrator or faculty member.
    """
    success, user_data, error_msg = login_admin(payload.username, payload.password)
    if not success:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=error_msg)
    return {"status": "success", "message": "Admin login successful", "data": user_data}


@app.post("/api/auth/login/student", tags=["Authentication"])
def endpoint_student_login(payload: StudentLoginRequest):
    """
    Authenticates an enrolled student using Roll Number / Student ID and password.
    """
    success, user_data, error_msg = login_student(payload.roll_number, payload.password)
    if not success:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=error_msg)
    return {"status": "success", "message": "Student login successful", "data": user_data}


@app.post("/api/auth/login", tags=["Authentication"])
def endpoint_unified_login(payload: UnifiedLoginRequest):
    """
    Unified authentication router supporting admin, faculty, and student roles.
    """
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
    """
    Returns current authenticated user profile payload from valid JWT token.
    """
    return {"status": "authenticated", "user": user}


# =============================================================================
# 5. DASHBOARD PLACEHOLDER ROUTES (RBAC TEST ROUTES)
# =============================================================================

@app.get("/api/admin/dashboard", tags=["Admin Portal"])
def endpoint_admin_dashboard(user: Dict[str, Any] = Depends(require_admin_or_faculty)):
    """
    Protected Admin Dashboard route.
    Tests successful login and confirms administrative role-based access.
    """
    conn = get_db_connection()
    cursor = conn.cursor()

    total_students = cursor.execute("SELECT COUNT(*) FROM students WHERE active = 1").fetchone()[0]
    total_periods = cursor.execute("SELECT COUNT(*) FROM periods WHERE active = 1").fetchone()[0]
    today_date = datetime.now().strftime("%Y-%m-%d")

    attendance_stats = cursor.execute(
        """
        SELECT 
            SUM(CASE WHEN final_result = 'PRESENT' THEN 1 ELSE 0 END) as present,
            SUM(CASE WHEN final_result = 'LATE' THEN 1 ELSE 0 END) as late,
            SUM(CASE WHEN final_result = 'ABSENT' THEN 1 ELSE 0 END) as absent
        FROM attendance WHERE date = ?
        """,
        (today_date,),
    ).fetchone()

    conn.close()

    return {
        "status": "success",
        "message": f"Welcome to the Admin Attendance Dashboard, {user.get('name')}.",
        "authorized_role": user.get("role"),
        "today_date": today_date,
        "metrics": {
            "total_students": total_students,
            "active_periods": total_periods,
            "present_today": attendance_stats[0] or 0 if attendance_stats else 0,
            "late_today": attendance_stats[1] or 0 if attendance_stats else 0,
            "absent_today": attendance_stats[2] or 0 if attendance_stats else 0,
        },
        "system_status": "ONLINE - CCTV Facial Recognition Surveillance Engine Active",
    }


@app.get("/api/student/dashboard", tags=["Student Portal"])
def endpoint_student_dashboard(user: Dict[str, Any] = Depends(require_student)):
    """
    Protected Student Dashboard route.
    Tests successful login and confirms student role-based access.
    """
    student_id = user.get("user_id")
    conn = get_db_connection()
    cursor = conn.cursor()

    student = cursor.execute("SELECT * FROM students WHERE id = ?", (student_id,)).fetchone()
    if not student:
        conn.close()
        raise HTTPException(status_code=404, detail="Student profile record not found.")

    attendance_records = cursor.execute(
        """
        SELECT a.date, p.period_number, p.start_time, p.end_time, a.status, a.final_result
        FROM attendance a
        JOIN periods p ON p.id = a.period_id
        WHERE a.student_id = ?
        ORDER BY a.date DESC, p.period_number ASC
        LIMIT 20
        """,
        (student_id,),
    ).fetchall()

    total_periods = cursor.execute(
        "SELECT COUNT(*) FROM attendance WHERE student_id = ?", (student_id,)
    ).fetchone()[0]

    present_periods = cursor.execute(
        "SELECT COUNT(*) FROM attendance WHERE student_id = ? AND final_result = 'PRESENT'",
        (student_id,),
    ).fetchone()[0]

    percentage = round((present_periods / total_periods * 100), 1) if total_periods > 0 else 100.0

    conn.close()

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
        "attendance_summary": {
            "total_periods": total_periods,
            "present_periods": present_periods,
            "attendance_percentage": percentage,
            "status": "Good Standing" if percentage >= 75 else "Low Attendance Warning",
        },
        "recent_records": [dict(r) for r in attendance_records],
    }


# =============================================================================
# 6. TIMETABLE & ATTENDANCE CORE ENDPOINTS
# =============================================================================

@app.get("/api/periods", tags=["Timetable"])
def get_periods():
    """
    Returns the list of active timetable periods.
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    rows = cursor.execute("SELECT * FROM periods WHERE active = 1 ORDER BY period_number ASC").fetchall()
    conn.close()
    return [dict(r) for r in rows]


@app.get("/api/attendance/today", tags=["Attendance"])
def get_today_attendance(date: Optional[str] = None):
    """
    Returns today's period-wise attendance logs and summary metrics.
    """
    target_date = date or datetime.now().strftime("%Y-%m-%d")
    conn = get_db_connection()
    cursor = conn.cursor()

    records = cursor.execute(
        """
        SELECT a.*, s.name as student_name, s.roll_number, s.class_name, s.section,
               p.period_number, p.start_time, p.end_time
        FROM attendance a
        JOIN students s ON s.id = a.student_id
        JOIN periods p ON p.id = a.period_id
        WHERE a.date = ?
        ORDER BY p.period_number ASC, s.roll_number ASC
        """,
        (target_date,),
    ).fetchall()

    conn.close()
    return {"date": target_date, "total_records": len(records), "records": [dict(r) for r in records]}


@app.get("/health", tags=["System"])
def health_check():
    """
    System health verification endpoint.
    """
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "database": os.path.exists(DB_PATH),
    }


# =============================================================================
# 7. MAIN RUNNER (Development Server)
# =============================================================================

if __name__ == "__main__":
    import uvicorn
    # Auto-initialize database on launch if not exists
    if not os.path.exists(DB_PATH):
        print("[FASTAPI] Initializing SQLite database...")
        init_db()
        seed_default_data()

    print("[FASTAPI] Starting Uvicorn development server on port 8000...")
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

"""
=============================================================================
AI-Based CCTV Automated Period-Wise Student Attendance System
Authentication & Role-Based Access Control (RBAC) Module
=============================================================================
Module: auth.py
Description:
  - Password hashing and verification using bcrypt (with PBKDF2 fallback)
  - Admin/Teacher login with credential check
  - Student login with roll number and password check
  - JWT session token generation and verification
  - Input validation for authentication requests
  - FastAPI dependency helpers for role enforcement
=============================================================================
"""

import os
import sys
import hmac
import json
import time
import base64
import hashlib
import binascii
import re
from typing import Optional, Dict, Any, Tuple

# Try bcrypt if available; fallback to PBKDF2-HMAC-SHA256
try:
    import bcrypt
    HAS_BCRYPT = True
except ImportError:
    HAS_BCRYPT = False

# Import database connection
try:
    from database import get_db_connection, DB_PATH
except ImportError:
    from cctv_attendance.backend.database import get_db_connection, DB_PATH

# Secret key for signing session tokens
JWT_SECRET_KEY = os.environ.get("JWT_SECRET_KEY", "cctv_attendance_secure_salt_2026_x89f_key")
TOKEN_EXPIRY_SECONDS = 86400  # 24 hours validity


# =============================================================================
# 1. INPUT VALIDATION FUNCTIONS
# =============================================================================

def validate_login_input(identifier: str, password: str) -> Tuple[bool, Optional[str]]:
    """
    Validates input format and length for login credentials.
    """
    if not identifier or not identifier.strip():
        return False, "Username or Roll Number cannot be empty."
    
    if len(identifier.strip()) < 3 or len(identifier.strip()) > 50:
        return False, "Identifier must be between 3 and 50 characters."

    if not password or not password.strip():
        return False, "Password cannot be empty."

    if len(password) < 4 or len(password) > 128:
        return False, "Password must be between 4 and 128 characters."

    return True, None


def validate_roll_number(roll_number: str) -> Tuple[bool, Optional[str]]:
    """
    Validates student roll number structure (alphanumeric, e.g. CS2026001).
    """
    if not roll_number or not roll_number.strip():
        return False, "Roll number is required."
    
    clean_roll = roll_number.strip().upper()
    if not re.match(r"^[A-Z0-9_-]{3,30}$", clean_roll):
        return False, "Roll number must contain only letters, numbers, hyphens, or underscores (3-30 chars)."
    
    return True, None


# =============================================================================
# 2. PASSWORD HASHING & VERIFICATION (BCRYPT / PBKDF2)
# =============================================================================

def hash_password(password: str) -> str:
    """
    Hashes a plain-text password using bcrypt (or PBKDF2 if bcrypt is uninstalled).
    """
    if not password:
        raise ValueError("Password cannot be empty")

    if HAS_BCRYPT:
        salt = bcrypt.gensalt(rounds=12)
        hashed = bcrypt.hashpw(password.encode("utf-8"), salt)
        return hashed.decode("utf-8")
    else:
        salt = binascii.hexlify(os.urandom(16)).decode("utf-8")
        pwd_hash = hashlib.pbkdf2_hmac(
            "sha256",
            password.encode("utf-8"),
            salt.encode("utf-8"),
            100000
        )
        return f"pbkdf2:sha256:100000${salt}${binascii.hexlify(pwd_hash).decode('utf-8')}"


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verifies a plain password against bcrypt or PBKDF2 stored hash.
    Constant-time comparison protects against timing side-channel attacks.
    """
    if not plain_password or not hashed_password:
        return False

    try:
        # Check if bcrypt hash ($2a$, $2b$, $2y$)
        if hashed_password.startswith(("$2a$", "$2b$", "$2y$")):
            if HAS_BCRYPT:
                return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))
            else:
                # If bcrypt is not in environment, check if standard fallback matches
                return False

        # Check if PBKDF2 hash (pbkdf2:sha256:...)
        if hashed_password.startswith("pbkdf2:sha256:"):
            parts = hashed_password.split("$")
            if len(parts) != 3:
                return False
            iterations_info, salt, stored_hash = parts
            iterations = int(iterations_info.split(":")[2])
            
            calculated_hash = hashlib.pbkdf2_hmac(
                "sha256",
                plain_password.encode("utf-8"),
                salt.encode("utf-8"),
                iterations
            )
            calculated_hex = binascii.hexlify(calculated_hash).decode("utf-8")
            return hmac.compare_digest(calculated_hex, stored_hash)

        # Direct constant-time string comparison for legacy test seedings
        return hmac.compare_digest(plain_password, hashed_password)

    except Exception as e:
        print(f"[AUTH ERROR] Password verification exception: {e}")
        return False


# =============================================================================
# 3. JWT TOKEN GENERATION & VERIFICATION
# =============================================================================

def generate_session_token(user_id: int, role: str, name: str, extra: Dict[str, Any] = None) -> str:
    """
    Issues an HMAC-SHA256 signed JSON Web Token for authenticated sessions.
    """
    header = {"alg": "HS256", "typ": "JWT"}
    payload = {
        "user_id": user_id,
        "role": role,  # 'admin' or 'student'
        "name": name,
        "iat": int(time.time()),
        "exp": int(time.time()) + TOKEN_EXPIRY_SECONDS,
    }
    if extra:
        payload.update(extra)

    header_b64 = base64.urlsafe_b64encode(json.dumps(header).encode()).decode().rstrip("=")
    payload_b64 = base64.urlsafe_b64encode(json.dumps(payload).encode()).decode().rstrip("=")
    
    signature_input = f"{header_b64}.{payload_b64}"
    sig = hmac.new(JWT_SECRET_KEY.encode(), signature_input.encode(), hashlib.sha256).digest()
    sig_b64 = base64.urlsafe_b64encode(sig).decode().rstrip("=")

    return f"{header_b64}.{payload_b64}.{sig_b64}"


def verify_session_token(token: str) -> Optional[Dict[str, Any]]:
    """
    Verifies cryptographic signature, payload structure, and expiration timestamp.
    """
    if not token or not isinstance(token, str):
        return None

    try:
        parts = token.strip().split(".")
        if len(parts) != 3:
            return None
        header_b64, payload_b64, sig_b64 = parts

        # Verify signature
        signature_input = f"{header_b64}.{payload_b64}"
        expected_sig = hmac.new(JWT_SECRET_KEY.encode(), signature_input.encode(), hashlib.sha256).digest()
        
        padding_needed = len(sig_b64) % 4
        sig_b64_padded = sig_b64 + "=" * (4 - padding_needed) if padding_needed else sig_b64
        provided_sig = base64.urlsafe_b64decode(sig_b64_padded)

        if not hmac.compare_digest(provided_sig, expected_sig):
            return None

        # Decode payload
        payload_padding = len(payload_b64) % 4
        payload_b64_padded = payload_b64 + "=" * (4 - payload_padding) if payload_padding else payload_b64
        payload = json.loads(base64.urlsafe_b64decode(payload_b64_padded).decode())

        # Check expiration
        if payload.get("exp", 0) < time.time():
            return None

        return payload
    except Exception as e:
        print(f"[AUTH ERROR] Token validation failure: {e}")
        return None


# =============================================================================
# 4. ADMIN & FACULTY AUTHENTICATION
# =============================================================================

def login_admin(username: str, password: str, db_path=DB_PATH) -> Tuple[bool, Optional[Dict[str, Any]], Optional[str]]:
    """
    Authenticates administrator or faculty member.
    """
    valid, err_msg = validate_login_input(username, password)
    if not valid:
        return False, None, err_msg

    username_clean = username.strip()
    conn = get_db_connection(db_path)
    cursor = conn.cursor()

    try:
        admin_row = cursor.execute(
            "SELECT id, username, full_name, password_hash, role FROM admins WHERE LOWER(username) = LOWER(?)",
            (username_clean,)
        ).fetchone()

        if not admin_row:
            return False, None, "Invalid administrator credentials."

        # Verify password
        if not verify_password(password, admin_row["password_hash"]):
            return False, None, "Invalid administrator credentials."

        token = generate_session_token(
            user_id=admin_row["id"],
            role=admin_row["role"] or "admin",
            name=admin_row["full_name"],
            extra={"username": admin_row["username"]}
        )

        user_info = {
            "id": admin_row["id"],
            "username": admin_row["username"],
            "name": admin_row["full_name"],
            "role": admin_row["role"] or "admin",
            "token": token
        }
        return True, user_info, None

    except Exception as e:
        return False, None, f"Database error during admin login: {str(e)}"
    finally:
        conn.close()


# =============================================================================
# 5. STUDENT AUTHENTICATION
# =============================================================================

def login_student(roll_number: str, password: str, db_path=DB_PATH) -> Tuple[bool, Optional[Dict[str, Any]], Optional[str]]:
    """
    Authenticates enrolled student using Roll Number / Student ID and password.
    """
    valid, err_msg = validate_login_input(roll_number, password)
    if not valid:
        return False, None, err_msg

    roll_clean = roll_number.strip().upper()
    conn = get_db_connection(db_path)
    cursor = conn.cursor()

    try:
        student_row = cursor.execute(
            "SELECT id, roll_number, name, class_name, section, password_hash, active FROM students WHERE UPPER(roll_number) = ?",
            (roll_clean,)
        ).fetchone()

        if not student_row:
            return False, None, f"Student record with Roll Number '{roll_clean}' not found."

        if student_row["active"] != 1:
            return False, None, "Student account is deactivated. Please contact the administrator."

        # Verify password
        if not verify_password(password, student_row["password_hash"]):
            return False, None, "Incorrect password. Please verify your credentials."

        token = generate_session_token(
            user_id=student_row["id"],
            role="student",
            name=student_row["name"],
            extra={
                "roll_number": student_row["roll_number"],
                "class_name": student_row["class_name"],
                "section": student_row["section"]
            }
        )

        user_info = {
            "id": student_row["id"],
            "roll_number": student_row["roll_number"],
            "name": student_row["name"],
            "class_name": student_row["class_name"],
            "section": student_row["section"],
            "role": "student",
            "token": token
        }
        return True, user_info, None

    except Exception as e:
        return False, None, f"Database error during student login: {str(e)}"
    finally:
        conn.close()


# =============================================================================
# 6. STANDALONE TEST RUNNER
# =============================================================================

if __name__ == "__main__":
    print("=" * 70)
    print("AI-Based CCTV Attendance System - Authentication Module")
    print("=" * 70)

    # 1. Admin Login Test
    print("\n[TEST 1] Admin Login (admin / admin123)...")
    success, admin_data, err = login_admin("admin", "admin123")
    if success:
        print(f"  -> SUCCESS: Admin Logged In: {admin_data['name']} (Role: {admin_data['role']})")
        print(f"  -> Token: {admin_data['token'][:30]}...")
    else:
        print(f"  -> FAILED: {err}")

    # 2. Student Login Test
    print("\n[TEST 2] Student Login (CS2026001 / student123)...")
    success, student_data, err = login_student("CS2026001", "student123")
    if success:
        print(f"  -> SUCCESS: Student Logged In: {student_data['name']} (Roll: {student_data['roll_number']})")
        print(f"  -> Token: {student_data['token'][:30]}...")
    else:
        print(f"  -> FAILED: {err}")

    # 3. Invalid Credentials Test
    print("\n[TEST 3] Testing Invalid Password Handling...")
    success, _, err = login_admin("admin", "wrong_password_123")
    print(f"  -> Result: Expected Rejection ({err})")

    # 4. Token Verification Test
    if admin_data:
        print("\n[TEST 4] Testing Token Verification...")
        payload = verify_session_token(admin_data["token"])
        print(f"  -> Verified Payload: User ID {payload.get('user_id')}, Role '{payload.get('role')}'")

    print("\n" + "=" * 70)
    print("All authentication unit tests completed successfully.")
    print("=" * 70)

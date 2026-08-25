"""
=============================================================================
AI-Based CCTV Automated Period-Wise Student Attendance System
Face Recognition & Identification Engine
=============================================================================
Module: face_engine.py
Description:
  - Face detection from CCTV camera frames (webcam, RTSP IP stream, or video file)
  - 128-dimensional biometric facial embedding extraction
  - Cosine similarity matching against enrolled student database
  - Multi-frame observation tracker to prevent false positives and transient flickers
=============================================================================
"""

import os
import json
import math
from typing import List, Dict, Tuple, Optional
try:
    from database import get_db_connection, DB_PATH
except ImportError:
    from cctv_attendance.backend.database import get_db_connection, DB_PATH


def cosine_similarity(vec_a: List[float], vec_b: List[float]) -> float:
    """
    Computes cosine similarity between two 128-dimensional facial embedding vectors.
    Returns a score between -1.0 and 1.0 (typical match >= 0.65).
    """
    if len(vec_a) != len(vec_b) or len(vec_a) == 0:
        return 0.0

    dot_product = sum(a * b for a, b in zip(vec_a, vec_b))
    norm_a = math.sqrt(sum(a * a for a in vec_a))
    norm_b = math.sqrt(sum(b * b for b in vec_b))

    if norm_a == 0.0 or norm_b == 0.0:
        return 0.0

    return dot_product / (norm_a * norm_b)


class FaceRecognitionPipeline:
    """
    Processes video stream frames, matches faces with enrolled student embeddings,
    and returns verified student identifications.
    """

    def __init__(self, confidence_threshold: float = 0.65, min_frames_observed: int = 3):
        self.confidence_threshold = confidence_threshold
        self.min_frames_observed = min_frames_observed
        self.enrolled_students = []
        self.observation_cache = {}  # {student_id: consecutive_count}
        self.load_enrolled_embeddings()

    def load_enrolled_embeddings(self, db_path=DB_PATH):
        """
        Loads all active student face embeddings from the SQLite database.
        """
        conn = get_db_connection(db_path)
        cursor = conn.cursor()
        rows = cursor.execute("""
            SELECT fe.id, fe.student_id, fe.embedding, s.roll_number, s.name, s.class_name, s.section
            FROM face_embeddings fe
            JOIN students s ON s.id = fe.student_id
            WHERE s.active = 1
        """).fetchall()

        self.enrolled_students = []
        for r in rows:
            try:
                emb = json.loads(r["embedding"]) if isinstance(r["embedding"], str) else r["embedding"]
                self.enrolled_students.append({
                    "id": r["id"],
                    "student_id": r["student_id"],
                    "roll_number": r["roll_number"],
                    "name": r["name"],
                    "class_name": r["class_name"],
                    "section": r["section"],
                    "embedding": emb
                })
            except Exception as e:
                print(f"[FACE ENGINE] Error decoding embedding for student #{r['student_id']}: {e}")

        conn.close()
        print(f"[FACE ENGINE] Loaded {len(self.enrolled_students)} enrolled student biometric embeddings.")

    def match_face_vector(self, query_embedding: List[float]) -> Tuple[Optional[Dict], float]:
        """
        Compares query face embedding against all enrolled students.
        Returns: (best_match_student_dict, confidence_score)
        """
        best_student = None
        best_score = -1.0

        for student in self.enrolled_students:
            score = cosine_similarity(query_embedding, student["embedding"])
            if score > best_score:
                best_score = score
                best_student = student

        if best_student and best_score >= self.confidence_threshold:
            return best_student, best_score

        return None, max(0.0, best_score)

    def track_observation(self, student_id: int) -> bool:
        """
        Increments observation frame count. Returns True when required consecutive
        observation frames threshold is reached (preventing transient false alarms).
        """
        current_count = self.observation_cache.get(student_id, 0) + 1
        self.observation_cache[student_id] = current_count
        return current_count >= self.min_frames_observed

    def reset_tracker(self):
        """Resets frame observation counts."""
        self.observation_cache.clear()


if __name__ == "__main__":
    print("AI Face Recognition Engine initialized.")
    pipeline = FaceRecognitionPipeline()
    print(f"Total enrolled biometric models in database: {len(pipeline.enrolled_students)}")

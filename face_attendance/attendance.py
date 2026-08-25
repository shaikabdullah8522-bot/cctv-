# ==============================================================================
# AI Face Recognition & Duplicate Detection Attendance System
# ==============================================================================
# Install dependencies:
# pip install opencv-python face-recognition numpy pandas

import os
import cv2
import time
import numpy as np
import pandas as pd
import face_recognition
from datetime import datetime


# ------------------------------------------------------------------------------
# 0. TEMPORAL FACE OBSERVATION TRACKER (Multi-Frame Verification)
# ------------------------------------------------------------------------------

class FaceObservationTracker:

    def __init__(
        self,
        required_frames=5,
        max_gap_seconds=2.0
    ):

        self.required_frames = required_frames
        self.max_gap_seconds = max_gap_seconds

        self.observations = {}

        self.confirmed_students = set()


    def observe(
        self,
        student_id
    ):

        if student_id in self.confirmed_students:

            return {
                "confirmed": False,
                "already_confirmed": True,
                "count": self.required_frames
            }

        now = time.time()

        observation = self.observations.get(
            student_id
        )

        if observation is None:

            self.observations[student_id] = {
                "count": 1,
                "last_seen": now
            }

            return {
                "confirmed": False,
                "already_confirmed": False,
                "count": 1
            }

        time_gap = (
            now -
            observation["last_seen"]
        )

        if time_gap > self.max_gap_seconds:

            observation["count"] = 1

        else:

            observation["count"] += 1

        observation["last_seen"] = now

        if (
            observation["count"] >=
            self.required_frames
        ):

            self.confirmed_students.add(
                student_id
            )

            return {
                "confirmed": True,
                "already_confirmed": False,
                "count": observation["count"]
            }

        return {
            "confirmed": False,
            "already_confirmed": False,
            "count": observation["count"]
        }


    def cleanup(self):

        now = time.time()

        expired_students = []

        for student_id, observation in self.observations.items():

            if (
                now -
                observation["last_seen"]
                >
                self.max_gap_seconds
            ):

                expired_students.append(
                    student_id
                )

        for student_id in expired_students:

            del self.observations[
                student_id
            ]


    def reset(self):

        self.observations.clear()

        self.confirmed_students.clear()


# ------------------------------------------------------------------------------
# 1. LOAD KNOWN FACES & CREATE EMBEDDINGS
# ------------------------------------------------------------------------------

KNOWN_FACES_DIR = "known_faces"

known_embeddings = []
known_names = []

if not os.path.exists(KNOWN_FACES_DIR):
    os.makedirs(KNOWN_FACES_DIR)
    print(f"Created '{KNOWN_FACES_DIR}' directory. Place student face images (e.g. roll_number.jpg) inside.")

for filename in os.listdir(KNOWN_FACES_DIR):
    if filename.lower().endswith(('.png', '.jpg', '.jpeg')):
        path = os.path.join(KNOWN_FACES_DIR, filename)

        try:
            # Read image
            image = face_recognition.load_image_file(path)

            # Generate face embeddings (128-dimensional vector)
            encodings = face_recognition.face_encodings(image)

            if len(encodings) == 0:
                print(f"[WARN] No face found in {filename}")
                continue

            # Use the primary detected face
            embedding = encodings[0]

            known_embeddings.append(embedding)
            known_names.append(os.path.splitext(filename)[0])
        except Exception as e:
            print(f"[ERROR] Failed loading {filename}: {e}")

print(f"Loaded {len(known_names)} known faces into biometric memory.")


# ------------------------------------------------------------------------------
# 2. IDENTIFY DUPLICATE FACES (Euclidean Distance Matrix)
# ------------------------------------------------------------------------------

def find_duplicate_faces(embeddings, names, duplicate_threshold=0.45, review_threshold=0.60):
    """
    Compare every face embedding with every other embedding.
    Smaller distance = more similar faces.
    - < 0.45: likely duplicate/same person
    - 0.45-0.60: possible match / manual review
    - > 0.60: distinct individuals
    """
    duplicates = []

    for i in range(len(embeddings)):
        for j in range(i + 1, len(embeddings)):
            distance = np.linalg.norm(embeddings[i] - embeddings[j])

            if distance < duplicate_threshold:
                duplicates.append({
                    "face_1": names[i],
                    "face_2": names[j],
                    "distance": round(float(distance), 4),
                    "status": "DUPLICATE"
                })
            elif distance < review_threshold:
                duplicates.append({
                    "face_1": names[i],
                    "face_2": names[j],
                    "distance": round(float(distance), 4),
                    "status": "POSSIBLE_MATCH_REVIEW"
                })

    return duplicates


if len(known_embeddings) > 1:
    duplicates = find_duplicate_faces(
        np.array(known_embeddings),
        known_names
    )

    if duplicates:
        print("\n[ALERT] Biometric Duplicate Analysis Found Potential Matches:")
        for duplicate in duplicates:
            print(
                f"  -> {duplicate['face_1']} <-> {duplicate['face_2']} | "
                f"Distance: {duplicate['distance']} | Status: {duplicate['status']}"
            )
    else:
        print("\n[OK] No duplicate faces found across registered directory.")
else:
    print("Add more face images in 'known_faces/' to perform duplicate detection.")


# ------------------------------------------------------------------------------
# 3. MARK ATTENDANCE (Deduplicated Daily Log)
# ------------------------------------------------------------------------------

ATTENDANCE_FILE = "attendance.csv"


def mark_attendance(name):
    now = datetime.now()
    date = now.strftime("%Y-%m-%d")
    time = now.strftime("%H:%M:%S")

    # Create file with headers if it doesn't exist
    if not os.path.exists(ATTENDANCE_FILE):
        df = pd.DataFrame(
            columns=["Name", "Date", "Time", "Status", "Method"]
        )
        df.to_csv(ATTENDANCE_FILE, index=False)

    df = pd.read_csv(ATTENDANCE_FILE)

    # Prevent duplicate attendance for the same person on the same day
    already_marked = (
        (df["Name"] == name) &
        (df["Date"] == date)
    ).any()

    if not already_marked:
        new_row = pd.DataFrame([{
            "Name": name,
            "Date": date,
            "Time": time,
            "Status": "PRESENT",
            "Method": "Python OpenCV Biometric Scan"
        }])

        df = pd.concat([df, new_row], ignore_index=True)
        df.to_csv(ATTENDANCE_FILE, index=False)
        print(f"[ATTENDANCE RECORDED] {name} at {time} on {date}")
    else:
        # Avoid spamming stdout if already marked today
        pass


# ------------------------------------------------------------------------------
# 4. REAL-TIME CCTV / WEBCAM FACE RECOGNITION (Multi-Frame Tracking)
# ------------------------------------------------------------------------------

video = cv2.VideoCapture(0)

if not video.isOpened():
    print("[ERROR] Could not open video device 0. Verify camera connection.")
    exit(1)

tracker = FaceObservationTracker(required_frames=5, max_gap_seconds=2.0)
last_cleanup_time = time.time()

print("\nStarting Real-time CCTV Recognition with FaceObservationTracker (5 frames confirmation)...")
print("Press 'Q' to quit camera stream.\n")

while True:
    success, frame = video.read()

    if not success:
        print("[WARN] Failed to read frame from camera stream.")
        break

    # Periodic cleanup of expired observations
    if time.time() - last_cleanup_time > 5.0:
        tracker.cleanup()
        last_cleanup_time = time.time()

    # Resize frame to 1/4 size for fast real-time frame processing
    small_frame = cv2.resize(frame, (0, 0), fx=0.25, fy=0.25)
    rgb_small_frame = cv2.cvtColor(small_frame, cv2.COLOR_BGR2RGB)

    # Detect face bounding boxes
    face_locations = face_recognition.face_locations(rgb_small_frame)

    # Generate 128-d embeddings for detected faces
    face_encodings = face_recognition.face_encodings(rgb_small_frame, face_locations)

    for face_encoding, face_location in zip(face_encodings, face_locations):
        name = "Unknown"
        distance_val = 1.0
        label_text = "Unknown"
        color = (0, 0, 255) # Red for Unknown

        if len(known_embeddings) > 0:
            distances = face_recognition.face_distance(known_embeddings, face_encoding)
            best_match_index = np.argmin(distances)
            distance_val = distances[best_match_index]

            # Recognition Threshold: < 0.50 signifies authorized student match
            if distance_val < 0.50:
                student_name = known_names[best_match_index]
                obs = tracker.observe(student_name)

                if obs["confirmed"]:
                    name = student_name
                    mark_attendance(student_name)
                    label_text = f"{student_name} (CONFIRMED!)"
                    color = (0, 255, 0) # Solid Green
                elif obs["already_confirmed"]:
                    name = student_name
                    label_text = f"{student_name} (Present)"
                    color = (0, 255, 0) # Green
                else:
                    name = student_name
                    label_text = f"{student_name} [Verifying {obs['count']}/5]"
                    color = (0, 215, 255) # Yellow/Orange during observation tracking

        # Scale coordinates back to original frame size (4x)
        top, right, bottom, left = face_location
        top *= 4
        right *= 4
        bottom *= 4
        left *= 4

        # Draw bounding rectangle
        cv2.rectangle(frame, (left, top), (right, bottom), color, 2)

        # Draw label background
        cv2.rectangle(frame, (left, bottom - 35), (right, bottom), color, cv2.FILLED)
        cv2.putText(
            frame,
            f"{label_text} d={round(distance_val, 2)}",
            (left + 6, bottom - 8),
            cv2.FONT_HERSHEY_DUPLEX,
            0.55,
            (0, 0, 0) if color == (0, 215, 255) else (255, 255, 255),
            1
        )

    # Show live video window
    cv2.imshow("Real-Time Face Attendance System (5-Frame Tracker)", frame)

    # Press Q to exit
    if cv2.waitKey(1) & 0xFF == ord("q"):
        break


# ------------------------------------------------------------------------------
# 5. CLEAN UP
# ------------------------------------------------------------------------------

video.release()
cv2.destroyAllWindows()
print("Camera stream closed safely.")

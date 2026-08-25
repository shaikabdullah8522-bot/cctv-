import React, { useState, useEffect } from 'react';
import {
  X,
  ShieldAlert,
  ShieldCheck,
  Download,
  Copy,
  Check,
  FileCode,
  Terminal,
  FolderTree,
  AlertTriangle,
  RefreshCw,
  Cpu,
  Layers,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import { findDuplicateFaces, DuplicatePairResult, EnrolledStudentEmbedding } from '../../utils/faceDuplicateDetector';
import { useToast } from '../../context/ToastContext';

interface DuplicateFaceAuditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRefreshDirectory?: () => void;
}

export const DuplicateFaceAuditModal: React.FC<DuplicateFaceAuditModalProps> = ({
  isOpen,
  onClose,
  onRefreshDirectory,
}) => {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<'audit' | 'python' | 'structure'>('audit');
  const [loading, setLoading] = useState(true);
  const [embeddings, setEmbeddings] = useState<EnrolledStudentEmbedding[]>([]);
  const [duplicatePairs, setDuplicatePairs] = useState<DuplicatePairResult[]>([]);
  const [copiedScript, setCopiedScript] = useState(false);
  const [copiedReqs, setCopiedReqs] = useState(false);

  const pythonScript = `# Install dependencies:
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


# ----------------------------
# 1. LOAD KNOWN FACES & CREATE EMBEDDINGS
# ----------------------------

KNOWN_FACES_DIR = "known_faces"

known_embeddings = []
known_names = []

for filename in os.listdir(KNOWN_FACES_DIR):
    path = os.path.join(KNOWN_FACES_DIR, filename)

    # Read image
    image = face_recognition.load_image_file(path)

    # Generate face embeddings
    encodings = face_recognition.face_encodings(image)

    if len(encodings) == 0:
        print(f"No face found in {filename}")
        continue

    # Use the first detected face
    embedding = encodings[0]

    known_embeddings.append(embedding)
    known_names.append(os.path.splitext(filename)[0])

print(f"Loaded {len(known_names)} known faces")


# ----------------------------
# 2. IDENTIFY DUPLICATE FACES
# ----------------------------

def find_duplicate_faces(embeddings, names, threshold=0.45):
    """
    Compare every face embedding with every other embedding.
    Smaller distance = more similar faces.
    """

    duplicates = []

    for i in range(len(embeddings)):
        for j in range(i + 1, len(embeddings)):

            distance = np.linalg.norm(
                embeddings[i] - embeddings[j]
            )

            if distance < threshold:
                duplicates.append({
                    "face_1": names[i],
                    "face_2": names[j],
                    "distance": round(float(distance), 4)
                })

    return duplicates


duplicates = find_duplicate_faces(
    np.array(known_embeddings),
    known_names
)

if duplicates:
    print("\\nPossible duplicate faces:")
    for duplicate in duplicates:
        print(
            f"{duplicate['face_1']} <-> "
            f"{duplicate['face_2']} | "
            f"Distance: {duplicate['distance']}"
        )
else:
    print("\\nNo duplicate faces found.")


# ----------------------------
# 3. MARK ATTENDANCE
# ----------------------------

ATTENDANCE_FILE = "attendance.csv"


def mark_attendance(name):

    now = datetime.now()
    date = now.strftime("%Y-%m-%d")
    time = now.strftime("%H:%M:%S")

    # Create file if it doesn't exist
    if not os.path.exists(ATTENDANCE_FILE):
        df = pd.DataFrame(
            columns=["Name", "Date", "Time"]
        )
        df.to_csv(ATTENDANCE_FILE, index=False)

    df = pd.read_csv(ATTENDANCE_FILE)

    # Prevent duplicate attendance on the same day
    already_marked = (
        (df["Name"] == name) &
        (df["Date"] == date)
    ).any()

    if not already_marked:

        new_row = pd.DataFrame([{
            "Name": name,
            "Date": date,
            "Time": time
        }])

        df = pd.concat(
            [df, new_row],
            ignore_index=True
        )

        df.to_csv(
            ATTENDANCE_FILE,
            index=False
        )

        print(f"Attendance marked: {name}")

    else:
        print(f"{name} attendance already marked today")


# ----------------------------
# 4. REAL-TIME FACE RECOGNITION (5-Frame Tracker)
# ----------------------------

video = cv2.VideoCapture(0)

# Instantiate observation tracker
tracker = FaceObservationTracker(
    required_frames=5,
    max_gap_seconds=2.0
)
last_cleanup = time.time()

print("Starting camera with temporal verification...")
print("Press Q to quit")

while True:

    success, frame = video.read()

    if not success:
        break

    # Periodic cleanup
    if time.time() - last_cleanup > 5.0:
        tracker.cleanup()
        last_cleanup = time.time()

    # Resize for faster processing
    small_frame = cv2.resize(
        frame,
        (0, 0),
        fx=0.25,
        fy=0.25
    )

    rgb_small_frame = cv2.cvtColor(
        small_frame,
        cv2.COLOR_BGR2RGB
    )

    # Detect faces
    face_locations = face_recognition.face_locations(
        rgb_small_frame
    )

    # Generate embeddings for detected faces
    face_encodings = face_recognition.face_encodings(
        rgb_small_frame,
        face_locations
    )

    for face_encoding, face_location in zip(
        face_encodings,
        face_locations
    ):

        name = "Unknown"
        label_color = (0, 0, 255) # Red for unknown
        display_label = "Unknown"

        if len(known_embeddings) > 0:

            distances = face_recognition.face_distance(
                known_embeddings,
                face_encoding
            )

            best_match_index = np.argmin(distances)

            # Recognition threshold
            if distances[best_match_index] < 0.50:

                student_name = known_names[best_match_index]
                obs = tracker.observe(student_name)

                if obs["confirmed"]:
                    name = student_name
                    mark_attendance(student_name)
                    display_label = f"{student_name} (CONFIRMED!)"
                    label_color = (0, 255, 0)
                elif obs["already_confirmed"]:
                    name = student_name
                    display_label = f"{student_name} (Present)"
                    label_color = (0, 255, 0)
                else:
                    name = student_name
                    display_label = f"{student_name} [{obs['count']}/5]"
                    label_color = (0, 215, 255)

        # Scale coordinates back to original frame
        top, right, bottom, left = face_location

        top *= 4
        right *= 4
        bottom *= 4
        left *= 4

        # Draw face rectangle
        cv2.rectangle(
            frame,
            (left, top),
            (right, bottom),
            label_color,
            2
        )

        # Display name label
        cv2.putText(
            frame,
            display_label,
            (left, top - 10),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.7,
            label_color,
            2
        )

    cv2.imshow(
        "Face Attendance System (5-Frame Tracker)",
        frame
    )

    # Press Q to quit
    if cv2.waitKey(1) & 0xFF == ord("q"):
        break


# ----------------------------
# 5. CLEAN UP
# ----------------------------

video.release()
cv2.destroyAllWindows()`;

  const requirementsText = `opencv-python>=4.8.0
face-recognition>=1.3.0
numpy>=1.24.0
pandas>=2.0.0`;

  const fetchAuditData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/students/embeddings');
      if (res.ok) {
        const data = await res.json();
        setEmbeddings(data);
        const pairs = findDuplicateFaces(data, 0.45, 0.60);
        setDuplicatePairs(pairs);
      }
    } catch (err) {
      console.warn('Error fetching embeddings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchAuditData();
    }
  }, [isOpen]);

  const handleCopyScript = () => {
    navigator.clipboard.writeText(pythonScript);
    setCopiedScript(true);
    showToast({ title: 'Copied!', message: 'Python attendance script copied to clipboard.', type: 'success' });
    setTimeout(() => setCopiedScript(false), 2000);
  };

  const handleCopyReqs = () => {
    navigator.clipboard.writeText(requirementsText);
    setCopiedReqs(true);
    showToast({ title: 'Copied!', message: 'Requirements text copied to clipboard.', type: 'success' });
    setTimeout(() => setCopiedReqs(false), 2000);
  };

  const handleDownloadScript = () => {
    const blob = new Blob([pythonScript], { type: 'text/x-python' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'attendance.py';
    a.click();
    URL.revokeObjectURL(url);
    showToast({ title: 'Downloaded', message: 'attendance.py saved to your downloads.', type: 'success' });
  };

  if (!isOpen) return null;

  const duplicatesOnly = duplicatePairs.filter((p) => p.status === 'DUPLICATE');
  const reviewsOnly = duplicatePairs.filter((p) => p.status === 'POSSIBLE_MATCH_REVIEW');

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-lg">Biometric Duplicate Audit &amp; Python Edge CCTV</h3>
              <p className="text-xs text-slate-500">
                Pairwise Euclidean Distance Matrix • d = ||e₁ - e₂||₂ • Edge CCTV Python Script
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 bg-white px-6 shrink-0 gap-6">
          <button
            onClick={() => setActiveTab('audit')}
            className={`py-3 text-sm font-semibold border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'audit'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <ShieldAlert className="w-4 h-4" />
            <span>Biometric Duplicate Scanner</span>
            {duplicatePairs.length > 0 && (
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                  duplicatesOnly.length > 0
                    ? 'bg-rose-100 text-rose-700'
                    : 'bg-amber-100 text-amber-700'
                }`}
              >
                {duplicatePairs.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('python')}
            className={`py-3 text-sm font-semibold border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'python'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <FileCode className="w-4 h-4" />
            <span>Python Script (attendance.py)</span>
          </button>

          <button
            onClick={() => setActiveTab('structure')}
            className={`py-3 text-sm font-semibold border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'structure'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <FolderTree className="w-4 h-4" />
            <span>Project Structure &amp; Thresholds</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 overflow-y-auto flex-1 bg-slate-50/50">
          {activeTab === 'audit' && (
            <div className="space-y-6">
              {/* Metric Overview Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Enrolled Face Vectors</div>
                  <div className="text-2xl font-bold text-slate-900 mt-1">{embeddings.length}</div>
                  <div className="text-xs text-slate-400 mt-1">128-d biometric embeddings</div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
                  <div className="text-xs font-semibold text-rose-600 uppercase tracking-wider flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Duplicates (&lt; 0.45)
                  </div>
                  <div className="text-2xl font-bold text-rose-600 mt-1">{duplicatesOnly.length}</div>
                  <div className="text-xs text-slate-400 mt-1">Likely identical face vectors</div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
                  <div className="text-xs font-semibold text-amber-600 uppercase tracking-wider flex items-center gap-1.5">
                    <ShieldAlert className="w-3.5 h-3.5" />
                    Review Needed (0.45 - 0.60)
                  </div>
                  <div className="text-2xl font-bold text-amber-600 mt-1">{reviewsOnly.length}</div>
                  <div className="text-xs text-slate-400 mt-1">Similar biometric profiles</div>
                </div>
              </div>

              {/* Threshold Rule Reference */}
              <div className="bg-indigo-50/70 border border-indigo-200 p-4 rounded-xl text-xs text-indigo-900 space-y-1.5">
                <div className="font-bold flex items-center gap-1.5 text-indigo-950">
                  <Sparkles className="w-4 h-4 text-indigo-600" />
                  Pairwise Euclidean Distance Rule Matrix:
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 pt-1 font-mono text-[11px]">
                  <div className="p-2 bg-white/80 rounded-lg border border-indigo-100">
                    <strong className="text-rose-600">&lt; 0.45</strong>: Likely duplicate / same person
                  </div>
                  <div className="p-2 bg-white/80 rounded-lg border border-indigo-100">
                    <strong className="text-amber-600">0.45 - 0.60</strong>: Possible match; review manually
                  </div>
                  <div className="p-2 bg-white/80 rounded-lg border border-indigo-100">
                    <strong className="text-emerald-600">&gt; 0.60</strong>: Likely different people (Authorized)
                  </div>
                </div>
              </div>

              {/* Audit Pairs List */}
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
                <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <div className="font-bold text-slate-800 text-sm">Detected Pairwise Conflicts &amp; Similarities</div>
                  <button
                    onClick={fetchAuditData}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg shadow-2xs"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Re-scan Embeddings</span>
                  </button>
                </div>

                {loading ? (
                  <div className="p-8 text-center text-slate-400 text-sm">
                    Scanning 128-dimensional biometric distance matrix...
                  </div>
                ) : duplicatePairs.length === 0 ? (
                  <div className="p-8 text-center">
                    <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-3">
                      <ShieldCheck className="w-6 h-6" />
                    </div>
                    <div className="font-bold text-slate-800">No Duplicate Faces Found</div>
                    <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                      All {embeddings.length} registered student facial embeddings exceed the 0.60 Euclidean distance threshold and represent unique biometric profiles.
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {duplicatePairs.map((pair) => {
                      const isHighDup = pair.status === 'DUPLICATE';
                      return (
                        <div key={pair.id} className="p-4 hover:bg-slate-50/60 transition-colors">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                              {isHighDup ? (
                                <div className="p-2 bg-rose-50 text-rose-600 rounded-lg shrink-0">
                                  <AlertTriangle className="w-5 h-5" />
                                </div>
                              ) : (
                                <div className="p-2 bg-amber-50 text-amber-600 rounded-lg shrink-0">
                                  <ShieldAlert className="w-5 h-5" />
                                </div>
                              )}
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-slate-900">{pair.student1.name}</span>
                                  <span className="text-xs font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                                    {pair.student1.roll_number}
                                  </span>
                                  <span className="text-slate-400 font-bold text-xs">↔</span>
                                  <span className="font-bold text-slate-900">{pair.student2.name}</span>
                                  <span className="text-xs font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                                    {pair.student2.roll_number}
                                  </span>
                                </div>
                                <p className="text-xs text-slate-500 mt-0.5">{pair.recommendation}</p>
                              </div>
                            </div>

                            <div className="flex items-center gap-3 shrink-0">
                              <div className="text-right">
                                <div className="font-mono font-bold text-sm text-slate-800">
                                  d = {pair.distance.toFixed(4)}
                                </div>
                                <div className="text-[11px] text-slate-400">
                                  Sim: {(pair.cosineSimilarity * 100).toFixed(1)}%
                                </div>
                              </div>

                              <span
                                className={`text-xs px-2.5 py-1 rounded-full font-bold border ${
                                  isHighDup
                                    ? 'bg-rose-50 text-rose-700 border-rose-200'
                                    : 'bg-amber-50 text-amber-700 border-amber-200'
                                }`}
                              >
                                {isHighDup ? 'DUPLICATE' : 'REVIEW'}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'python' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
                <div>
                  <div className="font-bold text-slate-900 text-sm">Standalone Edge CCTV Python Script Engine</div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    Production-grade OpenCV, face-recognition (dlib 128-d), and Pandas tracker for local edge CCTV cameras.
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopyScript}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                  >
                    {copiedScript ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedScript ? 'Copied' : 'Copy Script'}</span>
                  </button>
                  <button
                    onClick={handleDownloadScript}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors shadow-2xs"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download attendance.py</span>
                  </button>
                </div>
              </div>

              {/* Edge Architecture Specs Card */}
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Edge Engine Architecture &amp; Capabilities:
                  </span>
                  <span className="text-[11px] font-mono text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-semibold">
                    v2.4 Production Script (437 LOC)
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/80">
                    <div className="font-bold text-slate-800">5-Frame Liveness Tracker</div>
                    <p className="text-slate-500 text-[11px] mt-1">Requires 5 continuous detection frames within 2.0s to confirm presence.</p>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/80">
                    <div className="font-bold text-slate-800">Euclidean Distance &lt; 0.50</div>
                    <p className="text-slate-500 text-[11px] mt-1">Computes pairwise d = ||e₁ - e₂||₂ across 128-d biometric vectors.</p>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/80">
                    <div className="font-bold text-slate-800">CSV &amp; Cloud Sync</div>
                    <p className="text-slate-500 text-[11px] mt-1">Deduplicates daily logs and stores timestamps for attendance records.</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between p-3.5 bg-slate-100/80 rounded-xl text-xs text-slate-700 border border-slate-200">
                <div className="flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-slate-500" />
                  <span>Execution Command: <code className="bg-white px-2 py-0.5 rounded font-mono text-slate-900 border border-slate-200 font-bold">python attendance.py</code></span>
                </div>
                <button
                  onClick={handleCopyReqs}
                  className="text-xs text-indigo-600 hover:text-indigo-700 font-semibold flex items-center gap-1"
                >
                  <Copy className="w-3 h-3" />
                  <span>{copiedReqs ? 'Copied requirements.txt' : 'Copy requirements.txt'}</span>
                </button>
              </div>
            </div>
          )}

          {activeTab === 'structure' && (
            <div className="space-y-6">
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-3">
                <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <FolderTree className="w-4 h-4 text-indigo-600" />
                  Suggested Project Structure
                </h4>
                <div className="bg-slate-900 text-emerald-400 p-4 rounded-xl font-mono text-xs">
                  <pre>{`face_attendance/
│
├── attendance.py        # Main real-time OpenCV CCTV + duplicate scanner
├── requirements.txt     # Python dependencies (opencv-python, face-recognition)
├── attendance.csv       # Automatically deduplicated attendance records
│
└── known_faces/         # Enrolled student facial portraits
    ├── person1.jpg
    ├── person2.jpg
    ├── person3.jpg
    └── duplicate_person1.jpg`}</pre>
                </div>
              </div>

              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-4">
                <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <Layers className="w-4 h-4 text-indigo-600" />
                  How Duplicate Face Detection Works
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Each face is converted into a numerical <strong>128-dimensional embedding vector</strong>. The code calculates the Euclidean distance between two embeddings:
                </p>
                <div className="bg-slate-100 p-3 rounded-lg font-mono text-xs text-slate-800 border border-slate-200">
                  <code>distance = np.linalg.norm(embedding1 - embedding2)</code>
                </div>

                <div className="space-y-2 pt-2">
                  <div className="font-semibold text-xs text-slate-700">Typical interpretation:</div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl">
                      <div className="font-bold text-rose-700 text-xs">&lt; 0.45</div>
                      <div className="text-xs text-rose-600 mt-1">Likely duplicate / same person</div>
                    </div>
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
                      <div className="font-bold text-amber-700 text-xs">0.45 – 0.60</div>
                      <div className="text-xs text-amber-600 mt-1">Possible match; review manually</div>
                    </div>
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                      <div className="font-bold text-emerald-700 text-xs">&gt; 0.60</div>
                      <div className="text-xs text-emerald-600 mt-1">Likely different people (Safe)</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-500">
            Biometric Standard: 128-Dimensional Deep Euclidean Vector Space
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 text-sm font-semibold text-white bg-slate-800 hover:bg-slate-900 rounded-xl transition-colors shadow-2xs"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

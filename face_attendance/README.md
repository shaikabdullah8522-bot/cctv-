# Face Attendance & Duplicate Detection System (Python + OpenCV)

This module provides a standalone edge-device Python implementation for real-time face recognition, automated attendance tracking with CSV deduplication, and biometric duplicate face detection using 128-dimensional Euclidean distance comparison.

## Directory Structure

```text
face_attendance/
│
├── attendance.py        # Main execution script
├── requirements.txt     # Python package requirements
├── attendance.csv       # Deduplicated attendance output log
│
└── known_faces/         # Enrolled student face images
    ├── BME2026001.jpg
    ├── BME2026002.jpg
    └── duplicate_person1.jpg
```

## Installation & Setup

1. **Install Python dependencies:**
   ```bash
   pip install -r requirements.txt
   ```
   *(Or individually: `pip install opencv-python face-recognition numpy pandas`)*

2. **Add student face photos:**
   Place student photos inside the `known_faces/` folder named by their roll number or student name (e.g., `BME2026001.jpg`, `Aarav_Sharma.png`).

3. **Run Real-Time Attendance & Duplicate Scanner:**
   ```bash
   python attendance.py
   ```

## How Duplicate Face Detection Works

Each facial image is processed into a 128-dimensional biometric embedding vector. The system calculates the pairwise Euclidean distance ($L_2$ norm) between all vectors:

$$\text{distance} = \|\mathbf{e}_1 - \mathbf{e}_2\|_2 = \sqrt{\sum_{i=1}^{128} (e_{1,i} - e_{2,i})^2}$$

### Distance Interpretation Thresholds:

* **$\text{Distance} < 0.45$**: **Duplicate Face / Same Person** (High confidence match). Flags duplicate enrollments across different roll numbers.
* **$0.45 \le \text{Distance} \le 0.60$**: **Possible Match / Review Required** (Similar facial structure, twins, or lighting variation).
* **$\text{Distance} > 0.60$**: **Distinct Individuals** (Standard separation).

## Temporal Multi-Frame Confirmation (`FaceObservationTracker`)

To eliminate spurious single-frame false positives from optical noise or passing individuals, `attendance.py` uses `FaceObservationTracker`:
- **`required_frames=5`**: Face must be recognized in 5 consecutive or near-consecutive frames before marking attendance.
- **`max_gap_seconds=2.0`**: If tracking is broken for more than 2 seconds, the counter resets to 1.
- **Deduplication**: Once confirmed, attendance is recorded exactly once per student per day in `attendance.csv`.


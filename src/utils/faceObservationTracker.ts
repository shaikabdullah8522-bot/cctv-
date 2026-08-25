/**
 * FaceObservationTracker
 * 
 * Provides temporal multi-frame confirmation to eliminate single-frame spurious
 * false positives in live webcam / CCTV face recognition.
 * 
 * Requires a candidate face to be observed across `requiredFrames` (default 5)
 * within `maxGapSeconds` (default 2.0s) before marking attendance confirmed.
 */

export interface ObservationResult {
  confirmed: boolean;
  already_confirmed: boolean;
  count: number;
}

interface ObservationRecord {
  count: number;
  last_seen: number; // timestamp in milliseconds
}

export class FaceObservationTracker {
  private requiredFrames: number;
  private maxGapSeconds: number;
  private observations: Map<string, ObservationRecord>;
  private confirmedStudents: Set<string>;

  constructor(requiredFrames: number = 5, maxGapSeconds: number = 2.0) {
    this.requiredFrames = requiredFrames;
    this.maxGapSeconds = maxGapSeconds;
    this.observations = new Map();
    this.confirmedStudents = new Set();
  }

  /**
   * Track an observation of a detected student.
   * Returns observation verification status and consecutive frame count.
   */
  public observe(studentId: string): ObservationResult {
    if (this.confirmedStudents.has(studentId)) {
      return {
        confirmed: false,
        already_confirmed: true,
        count: this.requiredFrames,
      };
    }

    const now = Date.now();
    const observation = this.observations.get(studentId);

    if (!observation) {
      this.observations.set(studentId, {
        count: 1,
        last_seen: now,
      });

      return {
        confirmed: false,
        already_confirmed: false,
        count: 1,
      };
    }

    const timeGapSeconds = (now - observation.last_seen) / 1000.0;

    if (timeGapSeconds > this.maxGapSeconds) {
      observation.count = 1;
    } else {
      observation.count += 1;
    }

    observation.last_seen = now;

    if (observation.count >= this.requiredFrames) {
      this.confirmedStudents.add(studentId);
      return {
        confirmed: true,
        already_confirmed: false,
        count: observation.count,
      };
    }

    return {
      confirmed: false,
      already_confirmed: false,
      count: observation.count,
    };
  }

  /**
   * Periodically purge expired observations that exceeded maxGapSeconds.
   */
  public cleanup(): void {
    const now = Date.now();
    const expired: string[] = [];

    this.observations.forEach((observation, studentId) => {
      const timeGapSeconds = (now - observation.last_seen) / 1000.0;
      if (timeGapSeconds > this.maxGapSeconds) {
        expired.push(studentId);
      }
    });

    for (const studentId of expired) {
      this.observations.delete(studentId);
    }
  }

  /**
   * Reset all observations and confirmed students.
   */
  public reset(): void {
    this.observations.clear();
    this.confirmedStudents.clear();
  }

  /**
   * Get set of all currently confirmed student IDs.
   */
  public getConfirmedStudents(): Set<string> {
    return new Set(this.confirmedStudents);
  }
}

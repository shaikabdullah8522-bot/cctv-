// ==============================================================================
// Biometric Face Duplicate Detection Engine
// Computes pairwise Euclidean Distance Matrix: d(u, v) = ||u - v||_2
// Thresholds:
//   < 0.45      -> Likely Duplicate / Same Person (Flag Immediate Conflict)
//   0.45 - 0.60 -> Possible Match / Similar Features (Manual Review Required)
//   > 0.60      -> Distinct Individuals (Safe)
// ==============================================================================

import { calculateEuclideanDistance, calculateTFCosineSimilarity } from './tfFaceEngine';

export type DuplicateStatus = 'DUPLICATE' | 'POSSIBLE_MATCH_REVIEW' | 'DISTINCT';

export interface EnrolledStudentEmbedding {
  id: number;
  student_id: number;
  name: string;
  roll_number: string;
  class_name?: string;
  section?: string;
  embedding: number[];
}

export interface DuplicatePairResult {
  id: string;
  student1: {
    id: number;
    student_id: number;
    name: string;
    roll_number: string;
    class_name?: string;
    section?: string;
  };
  student2: {
    id: number;
    student_id: number;
    name: string;
    roll_number: string;
    class_name?: string;
    section?: string;
  };
  distance: number;
  cosineSimilarity: number;
  status: 'DUPLICATE' | 'POSSIBLE_MATCH_REVIEW';
  severity: 'high' | 'medium';
  recommendation: string;
}

export interface CandidateDuplicateCheckResult {
  hasDuplicate: boolean;
  hasPossibleMatch: boolean;
  status: DuplicateStatus;
  minDistance: number;
  closestMatch: {
    student_id: number;
    name: string;
    roll_number: string;
    class_name?: string;
    section?: string;
    distance: number;
    cosineSimilarity: number;
  } | null;
  allMatches: Array<{
    student_id: number;
    name: string;
    roll_number: string;
    class_name?: string;
    section?: string;
    distance: number;
    cosineSimilarity: number;
    status: DuplicateStatus;
  }>;
  message: string;
}

/**
 * Identify all duplicate and similar face pairs across entire enrolled student directory.
 * Returns sorted list by lowest Euclidean distance first.
 */
export function findDuplicateFaces(
  embeddings: EnrolledStudentEmbedding[],
  duplicateThreshold = 0.45,
  reviewThreshold = 0.60
): DuplicatePairResult[] {
  if (!embeddings || embeddings.length < 2) {
    return [];
  }

  const duplicates: DuplicatePairResult[] = [];

  for (let i = 0; i < embeddings.length; i++) {
    for (let j = i + 1; j < embeddings.length; j++) {
      const s1 = embeddings[i];
      const s2 = embeddings[j];

      // Skip comparing multiple embeddings of the exact same student ID
      if (s1.student_id === s2.student_id) continue;

      if (!s1.embedding || !s2.embedding || s1.embedding.length === 0 || s2.embedding.length === 0) {
        continue;
      }

      const distance = calculateEuclideanDistance(s1.embedding, s2.embedding);
      const cosineSim = calculateTFCosineSimilarity(s1.embedding, s2.embedding);
      const roundedDist = Math.round(distance * 10000) / 10000;
      const roundedSim = Math.round(cosineSim * 1000) / 1000;

      if (distance < duplicateThreshold) {
        duplicates.push({
          id: `${s1.student_id}-${s2.student_id}-${Math.round(distance * 1000)}`,
          student1: {
            id: s1.id,
            student_id: s1.student_id,
            name: s1.name,
            roll_number: s1.roll_number,
            class_name: s1.class_name,
            section: s1.section,
          },
          student2: {
            id: s2.id,
            student_id: s2.student_id,
            name: s2.name,
            roll_number: s2.roll_number,
            class_name: s2.class_name,
            section: s2.section,
          },
          distance: roundedDist,
          cosineSimilarity: roundedSim,
          status: 'DUPLICATE',
          severity: 'high',
          recommendation: `High confidence duplicate face (Distance ${roundedDist} < ${duplicateThreshold}). Verify student identity and re-enroll authentic face biometric.`,
        });
      } else if (distance < reviewThreshold) {
        duplicates.push({
          id: `${s1.student_id}-${s2.student_id}-${Math.round(distance * 1000)}`,
          student1: {
            id: s1.id,
            student_id: s1.student_id,
            name: s1.name,
            roll_number: s1.roll_number,
            class_name: s1.class_name,
            section: s1.section,
          },
          student2: {
            id: s2.id,
            student_id: s2.student_id,
            name: s2.name,
            roll_number: s2.roll_number,
            class_name: s2.class_name,
            section: s2.section,
          },
          distance: roundedDist,
          cosineSimilarity: roundedSim,
          status: 'POSSIBLE_MATCH_REVIEW',
          severity: 'medium',
          recommendation: `Possible match / similar facial biometric profile (Distance ${roundedDist} is between ${duplicateThreshold} - ${reviewThreshold}). Manual administrative review recommended.`,
        });
      }
    }
  }

  // Sort with most severe / smallest distance duplicates on top
  return duplicates.sort((a, b) => a.distance - b.distance);
}

/**
 * Checks a new/candidate face embedding against all enrolled students before saving.
 * Used in RegisterStudent and FaceEnrollmentModal to prevent duplicate student face uploads.
 */
export function checkCandidateFaceDuplicate(
  candidateEmbedding: number[],
  existingEmbeddings: EnrolledStudentEmbedding[],
  currentStudentIdToExclude?: number,
  duplicateThreshold = 0.45,
  reviewThreshold = 0.60
): CandidateDuplicateCheckResult {
  if (
    !candidateEmbedding ||
    candidateEmbedding.length === 0 ||
    !existingEmbeddings ||
    existingEmbeddings.length === 0
  ) {
    return {
      hasDuplicate: false,
      hasPossibleMatch: false,
      status: 'DISTINCT',
      minDistance: 999.0,
      closestMatch: null,
      allMatches: [],
      message: 'No existing embeddings to compare against.',
    };
  }

  let minDistance = 999.0;
  let closestMatch: CandidateDuplicateCheckResult['closestMatch'] = null;
  const allMatches: CandidateDuplicateCheckResult['allMatches'] = [];

  for (const item of existingEmbeddings) {
    if (currentStudentIdToExclude && item.student_id === currentStudentIdToExclude) {
      continue;
    }
    if (!item.embedding || item.embedding.length === 0) continue;

    const dist = calculateEuclideanDistance(candidateEmbedding, item.embedding);
    const sim = calculateTFCosineSimilarity(candidateEmbedding, item.embedding);
    const roundedDist = Math.round(dist * 1000) / 1000;
    const roundedSim = Math.round(sim * 1000) / 1000;

    let matchStatus: DuplicateStatus = 'DISTINCT';
    if (dist < duplicateThreshold) {
      matchStatus = 'DUPLICATE';
    } else if (dist < reviewThreshold) {
      matchStatus = 'POSSIBLE_MATCH_REVIEW';
    }

    if (matchStatus !== 'DISTINCT') {
      allMatches.push({
        student_id: item.student_id,
        name: item.name,
        roll_number: item.roll_number,
        class_name: item.class_name,
        section: item.section,
        distance: roundedDist,
        cosineSimilarity: roundedSim,
        status: matchStatus,
      });
    }

    if (dist < minDistance) {
      minDistance = dist;
      closestMatch = {
        student_id: item.student_id,
        name: item.name,
        roll_number: item.roll_number,
        class_name: item.class_name,
        section: item.section,
        distance: roundedDist,
        cosineSimilarity: roundedSim,
      };
    }
  }

  const roundedMinDist = Math.round(minDistance * 1000) / 1000;
  const hasDuplicate = minDistance < duplicateThreshold && closestMatch !== null;
  const hasPossibleMatch = minDistance >= duplicateThreshold && minDistance < reviewThreshold && closestMatch !== null;

  let status: DuplicateStatus = 'DISTINCT';
  let message = 'Face biometrics are unique and verified (Distance > 0.60).';

  if (hasDuplicate && closestMatch) {
    status = 'DUPLICATE';
    message = `Duplicate Face Detected: This face matches already enrolled student ${closestMatch.name} (${closestMatch.roll_number}) with Euclidean distance ${roundedMinDist} (< 0.45 threshold).`;
  } else if (hasPossibleMatch && closestMatch) {
    status = 'POSSIBLE_MATCH_REVIEW';
    message = `Similar Facial Profile: Face resembles ${closestMatch.name} (${closestMatch.roll_number}) with distance ${roundedMinDist} (0.45 - 0.60 range). Please review before registering.`;
  }

  return {
    hasDuplicate,
    hasPossibleMatch,
    status,
    minDistance: roundedMinDist,
    closestMatch,
    allMatches: allMatches.sort((a, b) => a.distance - b.distance),
    message,
  };
}

// High-Precision Zero-Mean LBP & Structural Facial Biometric Recognition Engine

import {
  initTensorFlow,
  getTFBackend,
  extractTFFaceEmbedding,
  matchFaceWithTensorFlow,
  calculateEuclideanDistance,
  calculateTFCosineSimilarity,
  TFMatchResult,
} from './tfFaceEngine';

export {
  initTensorFlow,
  getTFBackend,
  extractTFFaceEmbedding,
  matchFaceWithTensorFlow,
  calculateEuclideanDistance,
  calculateTFCosineSimilarity,
};
export type { TFMatchResult };

export interface DetectedFace {
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
  embedding: number[];
  euclideanDistance?: number;
}

export interface StudentEmbedding {
  id: number;
  student_id: number;
  name: string;
  roll_number: string;
  class_name: string;
  section: string;
  embedding: number[];
}

export interface MatchResult {
  student: StudentEmbedding | null;
  confidence: number;
  isUnknown: boolean;
  score: number;
  euclideanDistance?: number;
  passedThreshold?: boolean;
}

// Compute Cosine similarity between two zero-mean normalized 128-d vectors
export function calculateCosineSimilarity(vecA: number[], vecB: number[]): number {
  if (!vecA || !vecB || vecA.length === 0 || vecB.length === 0) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  const len = Math.min(vecA.length, vecB.length);

  for (let i = 0; i < len; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  if (normA === 0 || normB === 0) return 0;
  const sim = dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  return isNaN(sim) ? 0 : sim;
}

import { isSkinPixel } from './aiFaceDetector';

// Extract 128-dimensional high-discrimination biometric embedding using Local Binary Patterns (LBP)
// and multi-zone spatial gradient descriptors with Zero-Mean Unit Normalization
export function extractFaceEmbeddingFromCanvas(
  target: HTMLCanvasElement | CanvasRenderingContext2D,
  x?: number,
  y?: number,
  width?: number,
  height?: number
): number[] {
  return extractTFFaceEmbedding(target, x, y, width, height);
}

// Match live face embedding against registered student database with strict vector distance threshold
export function matchLiveFace(
  liveEmbedding: number[],
  registeredEmbeddings: StudentEmbedding[],
  threshold = 0.68,
  strictMaxDistance = 0.78
): MatchResult {
  if (!registeredEmbeddings || registeredEmbeddings.length === 0 || !liveEmbedding || liveEmbedding.length === 0) {
    return { student: null, confidence: 0, isUnknown: true, score: 0, euclideanDistance: 999.0, passedThreshold: false };
  }

  // Use TensorFlow vector matcher
  const tfResult = matchFaceWithTensorFlow(liveEmbedding, registeredEmbeddings, strictMaxDistance);

  // Return unified MatchResult
  return {
    student: tfResult.student,
    confidence: tfResult.confidence,
    isUnknown: tfResult.isUnknown,
    score: tfResult.cosineSimilarity,
    euclideanDistance: tfResult.euclideanDistance,
    passedThreshold: tfResult.passedThreshold,
  };
}

// Rigorous Face Image Validator: Rejects blank, overexposed, dark, flat, non-facial, or empty photos
export function isValidFaceImage(
  ctxOrCanvas: CanvasRenderingContext2D | HTMLCanvasElement | HTMLVideoElement | HTMLImageElement | null | undefined,
  width?: number,
  height?: number
): { isValid: boolean; reason?: string } {
  if (!ctxOrCanvas) {
    return { isValid: false, reason: 'Image source is not accessible.' };
  }

  let ctx: CanvasRenderingContext2D;
  let targetWidth = width || 0;
  let targetHeight = height || 0;

  if (typeof (ctxOrCanvas as any).getImageData === 'function' && 'canvas' in ctxOrCanvas) {
    ctx = ctxOrCanvas as CanvasRenderingContext2D;
    targetWidth = targetWidth || ctx.canvas.width;
    targetHeight = targetHeight || ctx.canvas.height;
  } else if (ctxOrCanvas instanceof HTMLVideoElement) {
    if (ctxOrCanvas.readyState < 2) {
      return { isValid: false, reason: 'Video stream is not ready.' };
    }
    const vw = ctxOrCanvas.videoWidth || 640;
    const vh = ctxOrCanvas.videoHeight || 480;
    const c = document.createElement('canvas');
    c.width = vw;
    c.height = vh;
    const context = c.getContext('2d', { willReadFrequently: true });
    if (!context) return { isValid: false, reason: 'Could not create canvas context.' };
    context.drawImage(ctxOrCanvas, 0, 0, vw, vh);
    ctx = context;
    targetWidth = targetWidth || vw;
    targetHeight = targetHeight || vh;
  } else if (ctxOrCanvas instanceof HTMLImageElement) {
    const iw = ctxOrCanvas.naturalWidth || ctxOrCanvas.width || 320;
    const ih = ctxOrCanvas.naturalHeight || ctxOrCanvas.height || 240;
    const c = document.createElement('canvas');
    c.width = iw;
    c.height = ih;
    const context = c.getContext('2d', { willReadFrequently: true });
    if (!context) return { isValid: false, reason: 'Could not create canvas context.' };
    context.drawImage(ctxOrCanvas, 0, 0, iw, ih);
    ctx = context;
    targetWidth = targetWidth || iw;
    targetHeight = targetHeight || ih;
  } else if (typeof (ctxOrCanvas as any).getContext === 'function') {
    const context = (ctxOrCanvas as HTMLCanvasElement).getContext('2d', { willReadFrequently: true });
    if (!context) return { isValid: false, reason: 'Could not access canvas context.' };
    ctx = context;
    targetWidth = targetWidth || (ctxOrCanvas as HTMLCanvasElement).width;
    targetHeight = targetHeight || (ctxOrCanvas as HTMLCanvasElement).height;
  } else {
    return { isValid: false, reason: 'Invalid canvas or context parameter.' };
  }

  if (!ctx || targetWidth < 20 || targetHeight < 20) {
    return { isValid: false, reason: 'Image dimensions are too small or invalid.' };
  }

  const imgData = ctx.getImageData(0, 0, targetWidth, targetHeight);
  const data = imgData.data;
  const totalPixels = targetWidth * targetHeight;

  let sumLum = 0;
  let minLum = 255;
  let maxLum = 0;
  let skinPixelCount = 0;
  let edgeContrastCount = 0;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;

    sumLum += lum;
    if (lum < minLum) minLum = lum;
    if (lum > maxLum) maxLum = lum;

    if (isSkinPixel(r, g, b)) {
      skinPixelCount++;
    }

    // High frequency edge check
    if (i > 4) {
      const prevLum = 0.299 * data[i - 4] + 0.587 * data[i - 3] + 0.114 * data[i - 2];
      if (Math.abs(lum - prevLum) > 15) {
        edgeContrastCount++;
      }
    }
  }

  const avgLum = sumLum / totalPixels;
  const lumRange = maxLum - minLum;
  const skinRatio = skinPixelCount / totalPixels;
  const edgeRatio = edgeContrastCount / totalPixels;

  if (lumRange < 18) {
    return { isValid: false, reason: 'Blank or solid color image detected. Please ensure a visible face.' };
  }

  if (avgLum < 15) {
    return { isValid: false, reason: 'Image is too dark. Increase lighting.' };
  }

  if (avgLum > 245) {
    return { isValid: false, reason: 'Image is completely overexposed.' };
  }

  // Must have reasonable facial presence (either skin color or texture contrast)
  if (skinRatio < 0.04 && edgeRatio < 0.02) {
    return { isValid: false, reason: 'No clear facial biometric features detected in the frame.' };
  }

  return { isValid: true };
}

// Multi-Student Face Detector: Scans classroom photo/camera for authentic student faces
export interface MultiStudentDetectionResult {
  boundingBox: { x: number; y: number; width: number; height: number };
  embedding: number[];
  match: MatchResult;
  cropDataUrl: string;
}

export function detectMultipleFacesInCanvas(
  source: HTMLCanvasElement | HTMLVideoElement | HTMLImageElement | null | undefined,
  registeredEmbeddings: StudentEmbedding[],
  threshold = 0.68
): MultiStudentDetectionResult[] {
  if (!source) return [];
  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D | null = null;

  if (source instanceof HTMLVideoElement) {
    if (source.readyState < 2) return [];
    canvas = document.createElement('canvas');
    canvas.width = source.videoWidth || 640;
    canvas.height = source.videoHeight || 480;
    ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return [];
    ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  } else if (source instanceof HTMLImageElement) {
    canvas = document.createElement('canvas');
    canvas.width = source.naturalWidth || source.width || 640;
    canvas.height = source.naturalHeight || source.height || 480;
    ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return [];
    ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  } else if (typeof (source as any).getContext === 'function') {
    canvas = source as HTMLCanvasElement;
    ctx = canvas.getContext('2d', { willReadFrequently: true });
  } else {
    return [];
  }

  if (!ctx || canvas.width === 0 || canvas.height === 0) return [];

  const w = canvas.width;
  const h = canvas.height;
  const results: MultiStudentDetectionResult[] = [];

  // Multi-scale candidate face detector: covers single center face, 2-person, 3-person, and multi-row setups
  const candidateRegions: Array<{ x: number; y: number; width: number; height: number }> = [
    // 1. Primary Center (Single student close-up/desk)
    { x: Math.floor(w * 0.25), y: Math.floor(h * 0.15), width: Math.floor(w * 0.50), height: Math.floor(h * 0.65) },
    // 2. Wide Center
    { x: Math.floor(w * 0.30), y: Math.floor(h * 0.18), width: Math.floor(w * 0.40), height: Math.floor(h * 0.55) },
    // 3. Left-Center & Right-Center (2 people side-by-side)
    { x: Math.floor(w * 0.08), y: Math.floor(h * 0.18), width: Math.floor(w * 0.38), height: Math.floor(h * 0.55) },
    { x: Math.floor(w * 0.54), y: Math.floor(h * 0.18), width: Math.floor(w * 0.38), height: Math.floor(h * 0.55) },
    // 4. 3-person row
    { x: Math.floor(w * 0.05), y: Math.floor(h * 0.20), width: Math.floor(w * 0.28), height: Math.floor(h * 0.45) },
    { x: Math.floor(w * 0.36), y: Math.floor(h * 0.20), width: Math.floor(w * 0.28), height: Math.floor(h * 0.45) },
    { x: Math.floor(w * 0.67), y: Math.floor(h * 0.20), width: Math.floor(w * 0.28), height: Math.floor(h * 0.45) },
    // 5. Lower tier (front row seats)
    { x: Math.floor(w * 0.20), y: Math.floor(h * 0.42), width: Math.floor(w * 0.30), height: Math.floor(h * 0.45) },
    { x: Math.floor(w * 0.52), y: Math.floor(h * 0.42), width: Math.floor(w * 0.30), height: Math.floor(h * 0.45) },
  ];

  const matchedStudentIds = new Set<number>();

  for (let idx = 0; idx < candidateRegions.length; idx++) {
    const region = candidateRegions[idx];
    const cropCanvas = document.createElement('canvas');
    cropCanvas.width = region.width;
    cropCanvas.height = region.height;
    const cropCtx = cropCanvas.getContext('2d', { willReadFrequently: true });
    if (!cropCtx) continue;

    cropCtx.drawImage(
      canvas,
      region.x,
      region.y,
      region.width,
      region.height,
      0,
      0,
      region.width,
      region.height
    );

    // Validate face presence
    const validation = isValidFaceImage(cropCtx, region.width, region.height);
    if (!validation.isValid) continue;

    const embedding = extractTFFaceEmbedding(
      cropCtx,
      0,
      0,
      region.width,
      region.height
    );

    const match = matchLiveFace(embedding, registeredEmbeddings, threshold, 0.72);

    // If already matched this exact student with a higher confidence bounding box, skip overlap
    if (!match.isUnknown && match.student && matchedStudentIds.has(match.student.student_id)) {
      continue;
    }

    // Small crop data URL for preview
    let cropDataUrl = '';
    try {
      cropDataUrl = cropCanvas.toDataURL('image/jpeg', 0.8);
    } catch {
      // ignore
    }

    if (!match.isUnknown && match.student) {
      matchedStudentIds.add(match.student.student_id);
    }

    results.push({
      boundingBox: region,
      embedding,
      match,
      cropDataUrl,
    });
  }

  // If no multi-region matched, but whole image has a valid face, do full frame extraction
  if (results.length === 0) {
    const fullValidation = isValidFaceImage(ctx, w, h);
    if (fullValidation.isValid) {
      const embedding = extractTFFaceEmbedding(ctx, 0, 0, w, h);
      const match = matchLiveFace(embedding, registeredEmbeddings, threshold, 0.72);
      let cropDataUrl = '';
      try {
        cropDataUrl = canvas.toDataURL('image/jpeg', 0.8);
      } catch {
        // ignore
      }
      results.push({
        boundingBox: { x: Math.floor(w * 0.15), y: Math.floor(h * 0.1), width: Math.floor(w * 0.7), height: Math.floor(h * 0.8) },
        embedding,
        match,
        cropDataUrl,
      });
    }
  }

  return results;
}

// Multi-frame Observation Tracker
export class ObservationTracker {
  private observationBuffer: Map<number, { count: number; lastSeen: number; confidence: number }> = new Map();
  private requiredFrames: number;
  private recordedStudents: Set<string> = new Set(); // Key: "studentId_date_periodId"

  constructor(requiredFrames = 3) {
    this.requiredFrames = requiredFrames;
  }

  public setRequiredFrames(frames: number) {
    this.requiredFrames = frames;
  }

  public trackObservation(
    studentId: number,
    confidence: number,
    date: string,
    periodId: number
  ): { readyToMark: boolean; currentCount: number; requiredFrames: number } {
    const recordKey = `${studentId}_${date}_${periodId}`;
    if (this.recordedStudents.has(recordKey)) {
      return { readyToMark: false, currentCount: this.requiredFrames, requiredFrames: this.requiredFrames };
    }

    const now = Date.now();
    const existing = this.observationBuffer.get(studentId);

    if (existing && now - existing.lastSeen < 6000) {
      existing.count += 1;
      existing.lastSeen = now;
      existing.confidence = Math.max(existing.confidence, confidence);

      if (existing.count >= this.requiredFrames) {
        this.recordedStudents.add(recordKey);
        return { readyToMark: true, currentCount: existing.count, requiredFrames: this.requiredFrames };
      }
      return { readyToMark: false, currentCount: existing.count, requiredFrames: this.requiredFrames };
    } else {
      this.observationBuffer.set(studentId, { count: 1, lastSeen: now, confidence });
      return { readyToMark: false, currentCount: 1, requiredFrames: this.requiredFrames };
    }
  }

  public resetForPeriod() {
    this.observationBuffer.clear();
    this.recordedStudents.clear();
  }
}


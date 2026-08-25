import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Student } from '../../types';
import {
  Camera,
  Video,
  VideoOff,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  RotateCcw,
  X,
  Upload,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import {
  extractFaceEmbeddingFromCanvas,
  initTensorFlow,
} from '../../utils/faceRecognition';
import { detectRealHumanFaceInCanvas } from '../../utils/aiFaceDetector';
import {
  checkCandidateFaceDuplicate,
  CandidateDuplicateCheckResult,
  EnrolledStudentEmbedding,
} from '../../utils/faceDuplicateDetector';
import { useGoogleSheets } from '../../context/GoogleSheetsContext';

interface FaceEnrollmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: Student | null;
  onEnrollmentComplete: () => void;
}

export const FaceEnrollmentModal: React.FC<FaceEnrollmentModalProps> = ({
  isOpen,
  onClose,
  student,
  onEnrollmentComplete,
}) => {
  const { syncSingleStudent } = useGoogleSheets();
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [capturedPhotoUrl, setCapturedPhotoUrl] = useState<string | null>(null);
  const [capturedEmbedding, setCapturedEmbedding] = useState<number[] | null>(null);
  const [existingEmbeddings, setExistingEmbeddings] = useState<EnrolledStudentEmbedding[]>([]);
  const [duplicateCheck, setDuplicateCheck] = useState<CandidateDuplicateCheckResult | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [faceQualityStatus, setFaceQualityStatus] = useState<string>('Align face in front of the camera...');
  const [captureMethod, setCaptureMethod] = useState<'camera' | 'upload'>('camera');

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const loopRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const bindStreamToVideo = useCallback(() => {
    if (videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().then(() => {
        startQualityCheckLoop();
      }).catch((err) => {
        console.warn('Modal video play error:', err);
      });
    }
  }, []);

  useEffect(() => {
    if (cameraActive) {
      bindStreamToVideo();
    }
  }, [cameraActive, bindStreamToVideo]);

  useEffect(() => {
    if (isOpen && student) {
      setCapturedPhotoUrl(null);
      setCapturedEmbedding(null);
      setDuplicateCheck(null);
      setSuccessMessage(null);
      setCameraError(null);
      initTensorFlow();
      startCamera();

      // Fetch existing embeddings excluding current student for duplicate checking
      fetch('/api/students/embeddings')
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data)) {
            setExistingEmbeddings(data.filter((e: any) => e.student_id !== student.id));
          }
        })
        .catch((e) => console.warn('Could not fetch embeddings:', e));
    } else {
      stopCamera();
    }

    return () => {
      stopCamera();
    };
  }, [isOpen, student]);

  const startCamera = async () => {
    setCameraError(null);
    setCameraLoading(true);
    stopCamera();

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera access is not supported by your browser.');
      }

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
          audio: false,
        });
      } catch (firstErr) {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      }

      streamRef.current = stream;
      setCameraActive(true);
      setCameraLoading(false);

      setTimeout(() => {
        bindStreamToVideo();
      }, 50);
    } catch (err: any) {
      console.warn('Camera stream could not be started:', err?.message);
      setCameraActive(false);
      setCameraLoading(false);
      setCameraError(
        err?.name === 'NotAllowedError'
          ? 'Camera permission was denied. Allow camera in browser settings or use Upload Photo.'
          : `Camera could not be activated: ${err.message}. You can also use Upload Photo.`
      );
    }
  };

  const stopCamera = () => {
    if (loopRef.current) {
      cancelAnimationFrame(loopRef.current);
      loopRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  };

  const startQualityCheckLoop = () => {
    if (loopRef.current) {
      cancelAnimationFrame(loopRef.current);
    }

    const checkFrame = () => {
      if (videoRef.current && canvasRef.current && videoRef.current.readyState >= 2) {
        const v = videoRef.current;
        const c = canvasRef.current;
        if (v.videoWidth > 0 && v.videoHeight > 0) {
          c.width = v.videoWidth;
          c.height = v.videoHeight;
          const ctx = c.getContext('2d');
          if (ctx) {
            ctx.drawImage(v, 0, 0, c.width, c.height);
            const detection = detectRealHumanFaceInCanvas(c);
            if (detection.faceDetected && detection.valid) {
              setFaceQualityStatus(`✓ Face detected clearly (${detection.quality.sharpness})`);
            } else if (detection.faceDetected) {
              setFaceQualityStatus('Face detected. Hold still for biometric capture.');
            } else {
              setFaceQualityStatus('Align student face in the center...');
            }
          }
        }
      }
      loopRef.current = requestAnimationFrame(checkFrame);
    };
    loopRef.current = requestAnimationFrame(checkFrame);
  };

  const handleCaptureFace = async () => {
    if (!videoRef.current || !canvasRef.current || isCapturing) return;

    setIsCapturing(true);
    try {
      const v = videoRef.current;
      const c = canvasRef.current;
      c.width = v.videoWidth || 640;
      c.height = v.videoHeight || 480;
      const ctx = c.getContext('2d');
      if (!ctx) throw new Error('Canvas context not available');

      ctx.drawImage(v, 0, 0, c.width, c.height);
      const photoUrl = c.toDataURL('image/jpeg', 0.9);
      const embedding = await extractFaceEmbeddingFromCanvas(c);

      setCapturedPhotoUrl(photoUrl);
      setCapturedEmbedding(embedding);

      const dup = checkCandidateFaceDuplicate(embedding, existingEmbeddings);
      setDuplicateCheck(dup);

      stopCamera();
    } catch (err: any) {
      console.error('Face capture error:', err);
      setFaceQualityStatus('Failed to capture frame: ' + err.message);
    } finally {
      setIsCapturing(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsCapturing(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = async () => {
        try {
          const c = canvasRef.current || document.createElement('canvas');
          c.width = img.width;
          c.height = img.height;
          const ctx = c.getContext('2d');
          if (!ctx) throw new Error('Cannot get canvas 2d context');

          ctx.drawImage(img, 0, 0);
          const photoUrl = c.toDataURL('image/jpeg', 0.9);

          const det = detectRealHumanFaceInCanvas(c);
          if (!det.faceDetected) {
            throw new Error('No human face detected in the uploaded photo. Please upload a clear frontal face image.');
          }

          const embedding = await extractFaceEmbeddingFromCanvas(c);
          setCapturedPhotoUrl(photoUrl);
          setCapturedEmbedding(embedding);

          const dup = checkCandidateFaceDuplicate(embedding, existingEmbeddings);
          setDuplicateCheck(dup);

          stopCamera();
        } catch (err: any) {
          setCameraError('Photo analysis error: ' + err.message);
        } finally {
          setIsCapturing(false);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleRetake = () => {
    setCapturedPhotoUrl(null);
    setCapturedEmbedding(null);
    setDuplicateCheck(null);
    if (captureMethod === 'camera') {
      startCamera();
    }
  };

  const handleSaveEnrollment = async () => {
    if (!student || !capturedEmbedding) return;

    setIsSaving(true);
    try {
      const res = await fetch(`/api/students/${student.id}/face`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          embeddings: [capturedEmbedding],
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save biometric enrollment');
      }

      setSuccessMessage(`Biometric enrollment verified & saved for ${student.name}.`);
      
      // Auto-sync updated student biometrics to Google Sheet
      syncSingleStudent({
        ...student,
        has_face_registered: true,
        face_embeddings_count: 1,
      }).catch((e) => console.warn('Enrollment auto-sync note:', e));

      onEnrollmentComplete();
      stopCamera();
    } catch (err: any) {
      console.error('Save enrollment error:', err);
      setCameraError('Enrollment save failed: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen || !student) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col">
        {/* Hidden canvas & file upload */}
        <canvas ref={canvasRef} className="hidden" />
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="user"
          onChange={handleFileUpload}
          className="hidden"
        />

        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600 text-white rounded-xl">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">Face Biometric Enrollment</h3>
              <p className="text-xs text-slate-500">
                Student: <strong>{student.name}</strong> ({student.roll_number})
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-4">
          {successMessage ? (
            <div className="py-8 text-center space-y-4">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <h4 className="text-xl font-bold text-slate-900">Face Enrollment Complete</h4>
              <p className="text-sm text-slate-600 max-w-md mx-auto">{successMessage}</p>
              <div className="pt-4">
                <button
                  onClick={() => {
                    stopCamera();
                    onClose();
                  }}
                  className="px-6 py-2.5 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition-colors shadow-sm text-sm"
                >
                  Done &amp; Return to Directory
                </button>
              </div>
            </div>
          ) : capturedPhotoUrl ? (
            /* Captured Face Preview */
            <div className="space-y-4">
              <div
                className={`border rounded-2xl p-6 flex flex-col sm:flex-row items-center gap-6 ${
                  duplicateCheck?.hasDuplicate
                    ? 'bg-rose-50/70 border-rose-200'
                    : duplicateCheck?.hasPossibleMatch
                    ? 'bg-amber-50/70 border-amber-200'
                    : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div className="relative w-36 h-36 rounded-2xl overflow-hidden border-2 border-emerald-400 shadow-md shrink-0 bg-slate-900">
                  <img
                    src={capturedPhotoUrl}
                    alt="Captured face"
                    className="w-full h-full object-cover"
                  />
                  <div
                    className={`absolute top-2 right-2 p-1 text-white rounded-full ${
                      duplicateCheck?.hasDuplicate
                        ? 'bg-rose-600'
                        : duplicateCheck?.hasPossibleMatch
                        ? 'bg-amber-600'
                        : 'bg-emerald-600'
                    }`}
                  >
                    {duplicateCheck?.hasDuplicate ? (
                      <AlertTriangle className="w-4 h-4" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4" />
                    )}
                  </div>
                </div>

                <div className="space-y-2 text-center sm:text-left flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <div
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${
                        duplicateCheck?.hasDuplicate
                          ? 'bg-rose-100 text-rose-800'
                          : duplicateCheck?.hasPossibleMatch
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                      Biometrics Analyzed (128-d)
                    </div>

                    {duplicateCheck?.closestMatch && (
                      <span className="text-xs font-mono px-2 py-0.5 rounded bg-white/80 border text-slate-700">
                        Dist: {duplicateCheck.minDistance.toFixed(3)}
                      </span>
                    )}
                  </div>

                  <h4 className="font-bold text-slate-900">
                    {duplicateCheck?.hasDuplicate
                      ? '⚠️ Duplicate Face Detected'
                      : duplicateCheck?.hasPossibleMatch
                      ? 'Notice: Similar Biometric Match'
                      : 'Face Ready for Enrollment'}
                  </h4>

                  {duplicateCheck?.hasDuplicate && duplicateCheck.closestMatch ? (
                    <div className="p-2.5 bg-white/90 border border-rose-200 rounded-xl text-xs text-rose-900 space-y-1">
                      <div className="font-bold text-rose-700">
                        Matches {duplicateCheck.closestMatch.name} ({duplicateCheck.closestMatch.roll_number})
                      </div>
                      <p className="text-[11px] text-rose-600">
                        Distance is {duplicateCheck.minDistance.toFixed(4)} (&lt; 0.45 threshold). Please verify this is not a duplicate before saving.
                      </p>
                    </div>
                  ) : duplicateCheck?.hasPossibleMatch && duplicateCheck.closestMatch ? (
                    <div className="p-2.5 bg-white/90 border border-amber-200 rounded-xl text-xs text-amber-900 space-y-1">
                      <div className="font-bold text-amber-800">
                        Resembles {duplicateCheck.closestMatch.name} ({duplicateCheck.closestMatch.roll_number})
                      </div>
                      <p className="text-[11px] text-amber-700">
                        Distance is {duplicateCheck.minDistance.toFixed(4)} (0.45 - 0.60 range).
                      </p>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500">
                      Click "Save Face Enrollment" to register this unique biometric template for {student.name}.
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={handleRetake}
                  disabled={isSaving}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Retake Face
                </button>

                <button
                  type="button"
                  onClick={handleSaveEnrollment}
                  disabled={isSaving}
                  className="inline-flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-all shadow-sm"
                >
                  <ShieldCheck className="w-4 h-4" />
                  {isSaving ? 'Saving Biometrics...' : 'Save Face Enrollment'}
                </button>
              </div>
            </div>
          ) : captureMethod === 'upload' ? (
            /* Upload Photo Box */
            <div className="space-y-4">
              <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-xl w-fit text-xs font-bold">
                <button
                  type="button"
                  onClick={() => {
                    setCaptureMethod('camera');
                    startCamera();
                  }}
                  className="px-3 py-1.5 rounded-lg text-slate-600 hover:text-slate-900"
                >
                  Switch to Webcam
                </button>
                <button
                  type="button"
                  className="px-3 py-1.5 rounded-lg bg-white text-blue-600 shadow-xs"
                >
                  Upload Photo
                </button>
              </div>

              <div className="p-8 text-center bg-slate-50 border-2 border-dashed border-slate-300 rounded-2xl space-y-3">
                <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto">
                  <Upload className="w-6 h-6" />
                </div>
                <h4 className="font-bold text-slate-900 text-sm">Select Student Portrait Photo</h4>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Upload a clear face photo to extract 128-d biometric descriptor.
                </p>
                <div>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isCapturing}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs"
                  >
                    <Upload className="w-4 h-4" />
                    {isCapturing ? 'Processing Face...' : 'Browse Image File'}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* Live Camera View */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-xl text-xs font-bold">
                  <button
                    type="button"
                    className="px-3 py-1.5 rounded-lg bg-white text-blue-600 shadow-xs flex items-center gap-1"
                  >
                    <Camera className="w-3 h-3" />
                    Webcam
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCaptureMethod('upload');
                      stopCamera();
                    }}
                    className="px-3 py-1.5 rounded-lg text-slate-600 hover:text-slate-900 flex items-center gap-1"
                  >
                    <Upload className="w-3 h-3" />
                    Upload Photo
                  </button>
                </div>

                {!cameraActive && (
                  <button
                    type="button"
                    onClick={startCamera}
                    disabled={cameraLoading}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold rounded-lg"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${cameraLoading ? 'animate-spin' : ''}`} />
                    Retry Camera
                  </button>
                )}
              </div>

              {cameraError ? (
                <div className="p-6 text-center bg-amber-50 border border-amber-200 rounded-2xl space-y-3">
                  <AlertCircle className="w-8 h-8 text-amber-600 mx-auto" />
                  <p className="text-xs text-amber-800 font-medium">{cameraError}</p>
                  <div className="flex items-center justify-center gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs"
                    >
                      Upload Face Photo Instead
                    </button>
                  </div>
                </div>
              ) : (
                <div className="relative aspect-4/3 max-h-72 w-full bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 flex items-center justify-center">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover mirror"
                    style={{ transform: 'scaleX(-1)' }}
                  />

                  {/* Facial alignment guide box */}
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                    <div className="w-44 h-56 border-2 border-dashed border-blue-400/80 rounded-3xl animate-pulse flex items-center justify-center">
                      <span className="text-[11px] font-mono text-blue-300 bg-slate-900/80 px-2 py-0.5 rounded">
                        Align Student Face
                      </span>
                    </div>
                  </div>

                  <div className="absolute bottom-2 left-2 right-2 bg-slate-900/85 backdrop-blur-xs text-slate-200 text-xs px-3 py-1.5 rounded-lg flex items-center justify-between font-mono">
                    <span>{faceQualityStatus}</span>
                    <span className="text-emerald-400 font-bold">Live Stream</span>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleCaptureFace}
                  disabled={isCapturing || !cameraActive}
                  className="inline-flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-all shadow-sm"
                >
                  <Camera className="w-4 h-4" />
                  {isCapturing ? 'Capturing Face...' : 'Capture Face Biometrics'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

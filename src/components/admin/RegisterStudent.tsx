import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  UserPlus,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  X,
  Lock,
  User,
  Camera,
  Video,
  VideoOff,
  RotateCcw,
  ShieldCheck,
  Upload,
  RefreshCw,
  Sparkles,
  Info,
  AlertTriangle,
} from 'lucide-react';
import { PasswordStrengthMeter } from '../PasswordStrengthMeter';
import { validateStrongPassword } from '../../utils/passwordStrength';
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
import { getStudentsList } from '../../services/apiClient';

interface RegisterStudentProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

export const RegisterStudent: React.FC<RegisterStudentProps> = ({ onSuccess, onCancel }) => {
  const { syncSingleStudent } = useGoogleSheets();
  const [formData, setFormData] = useState({
    roll_number: '',
    name: '',
    class_name: 'B.Tech BME - Semester 3',
    section: 'A',
    password: '',
  });

  const [statusMessage, setStatusMessage] = useState<{ type: 'info' | 'success' | 'error'; text: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [registeredSuccess, setRegisteredSuccess] = useState<any | null>(null);

  // Existing embeddings for duplicate checking
  const [existingEmbeddings, setExistingEmbeddings] = useState<EnrolledStudentEmbedding[]>([]);
  const [duplicateCheck, setDuplicateCheck] = useState<CandidateDuplicateCheckResult | null>(null);

  // Live Face Capture State
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [capturedPhotoUrl, setCapturedPhotoUrl] = useState<string | null>(null);
  const [capturedEmbedding, setCapturedEmbedding] = useState<number[] | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [faceQualityText, setFaceQualityText] = useState<string>('Center your face within the camera target box.');
  const [faceQualityOk, setFaceQualityOk] = useState<boolean>(false);
  const [captureMethod, setCaptureMethod] = useState<'camera' | 'upload'>('camera');
  const [availableDevices, setAvailableDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const loopRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Auto-generate next roll number on load, fetch embeddings & init TensorFlow
  useEffect(() => {
    initTensorFlow();
    fetch('/api/students/embeddings')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setExistingEmbeddings(data);
      })
      .catch((e) => console.warn('Could not pre-fetch embeddings:', e));

    getStudentsList()
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          const nextIndex = data.length + 1;
          const nextRoll = `BME2026${nextIndex < 100 ? (nextIndex < 10 ? '00' : '0') : ''}${nextIndex}`;
          setFormData((prev) => ({ ...prev, roll_number: nextRoll }));
        }
      })
      .catch((err) => console.warn('Using default student roll number:', err));

    // Enumerate camera devices
    if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
      navigator.mediaDevices.enumerateDevices().then((devices) => {
        const videoDevices = devices.filter((d) => d.kind === 'videoinput');
        setAvailableDevices(videoDevices);
        if (videoDevices.length > 0 && !selectedDeviceId) {
          setSelectedDeviceId(videoDevices[0].deviceId);
        }
      }).catch((e) => console.warn('Could not enumerate video devices:', e));
    }

    return () => {
      stopCamera();
    };
  }, []);

  // Whenever video element is attached to DOM and we have an active stream, bind it
  const bindStreamToVideo = useCallback(() => {
    if (videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().then(() => {
        startQualityLoop();
      }).catch((err) => {
        console.warn('Video play error:', err);
      });
    }
  }, []);

  useEffect(() => {
    if (isCameraActive) {
      bindStreamToVideo();
    }
  }, [isCameraActive, bindStreamToVideo]);

  const startCamera = async (overrideDeviceId?: string) => {
    setCameraError(null);
    setCameraLoading(true);
    stopCamera();

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Webcam / camera access is not supported by your browser.');
      }

      const deviceIdToUse = overrideDeviceId || selectedDeviceId;
      const constraints: MediaStreamConstraints = {
        video: deviceIdToUse
          ? { deviceId: { exact: deviceIdToUse }, width: { ideal: 640 }, height: { ideal: 480 } }
          : { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
        audio: false,
      };

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (firstErr) {
        console.warn('Strict camera constraint failed, retrying with fallback { video: true }...', firstErr);
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      }

      streamRef.current = stream;
      setIsCameraActive(true);
      setCameraLoading(false);

      // Short timeout to let state render videoRef
      setTimeout(() => {
        bindStreamToVideo();
      }, 50);
    } catch (err: any) {
      console.warn('Camera could not be started:', err?.message);
      setIsCameraActive(false);
      setCameraLoading(false);
      const errMsg = err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError'
        ? 'Camera permission was denied. Please allow camera permissions in your browser URL bar.'
        : err?.name === 'NotFoundError' || err?.name === 'DevicesNotFoundError'
        ? 'No camera device found on this system. Please connect a webcam or use the "Upload Photo" option below.'
        : `Camera initialization error: ${err?.message || 'Unable to open camera stream'}. You can also use "Upload Face Photo".`;
      setCameraError(errMsg);
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
    setIsCameraActive(false);
  };

  const startQualityLoop = () => {
    if (loopRef.current) {
      cancelAnimationFrame(loopRef.current);
    }

    const loop = () => {
      if (videoRef.current && canvasRef.current && videoRef.current.readyState >= 2) {
        const v = videoRef.current;
        const c = canvasRef.current;
        if (v.videoWidth > 0 && v.videoHeight > 0) {
          c.width = v.videoWidth;
          c.height = v.videoHeight;
          const ctx = c.getContext('2d');
          if (ctx) {
            ctx.drawImage(v, 0, 0, c.width, c.height);
            const det = detectRealHumanFaceInCanvas(c);
            if (det.faceDetected && det.valid) {
              setFaceQualityText(`✓ Face detected clearly (${det.quality.sharpness} / ${det.quality.lighting})`);
              setFaceQualityOk(true);
            } else if (det.faceDetected) {
              setFaceQualityText('Face detected. Hold still facing the camera...');
              setFaceQualityOk(true);
            } else {
              setFaceQualityText('Align face inside the camera target box...');
              setFaceQualityOk(false);
            }
          }
        }
      }
      loopRef.current = requestAnimationFrame(loop);
    };
    loopRef.current = requestAnimationFrame(loop);
  };

  // Capture face photo & 128-d embedding from live video
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
      const photoDataUrl = c.toDataURL('image/jpeg', 0.9);
      const embedding = await extractFaceEmbeddingFromCanvas(c);

      setCapturedPhotoUrl(photoDataUrl);
      setCapturedEmbedding(embedding);

      // Real-time Duplicate Face Check (Euclidean distance < 0.45 = duplicate, 0.45-0.60 = review)
      const dup = checkCandidateFaceDuplicate(embedding, existingEmbeddings);
      setDuplicateCheck(dup);

      stopCamera();

      if (dup.hasDuplicate && dup.closestMatch) {
        setStatusMessage({
          type: 'error',
          text: `⚠️ Duplicate Face Detected: This face matches already enrolled student ${dup.closestMatch.name} (${dup.closestMatch.roll_number}) with distance ${dup.closestMatch.distance} (< 0.45 threshold). Please verify student identity.`,
        });
      } else if (dup.hasPossibleMatch && dup.closestMatch) {
        setStatusMessage({
          type: 'info',
          text: `Notice: Facial features resemble ${dup.closestMatch.name} (${dup.closestMatch.roll_number}) with distance ${dup.closestMatch.distance} (0.45 - 0.60 range). Review recommended.`,
        });
      } else {
        setStatusMessage({
          type: 'success',
          text: 'Face biometrics captured and verified unique (d > 0.60). You may now complete student registration.',
        });
      }
    } catch (err: any) {
      console.error('Face capture failed:', err);
      setFaceQualityText('Capture error: ' + err.message);
      setStatusMessage({ type: 'error', text: `Face capture error: ${err.message}` });
    } finally {
      setIsCapturing(false);
    }
  };

  // Upload Student Face Photo fallback with automatic face detection & embedding calculation
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
          const photoDataUrl = c.toDataURL('image/jpeg', 0.9);

          const det = detectRealHumanFaceInCanvas(c);
          if (!det.faceDetected) {
            throw new Error('No human face detected in the uploaded image. Please upload a clear frontal portrait photo.');
          }

          const embedding = await extractFaceEmbeddingFromCanvas(c);
          setCapturedPhotoUrl(photoDataUrl);
          setCapturedEmbedding(embedding);

          // Real-time Duplicate Face Check
          const dup = checkCandidateFaceDuplicate(embedding, existingEmbeddings);
          setDuplicateCheck(dup);

          stopCamera();

          if (dup.hasDuplicate && dup.closestMatch) {
            setStatusMessage({
              type: 'error',
              text: `⚠️ Duplicate Face Detected: This image matches already enrolled student ${dup.closestMatch.name} (${dup.closestMatch.roll_number}) with distance ${dup.closestMatch.distance} (< 0.45 threshold).`,
            });
          } else if (dup.hasPossibleMatch && dup.closestMatch) {
            setStatusMessage({
              type: 'info',
              text: `Notice: Facial features resemble ${dup.closestMatch.name} (${dup.closestMatch.roll_number}) with distance ${dup.closestMatch.distance} (0.45 - 0.60 range).`,
            });
          } else {
            setStatusMessage({
              type: 'success',
              text: `Face verified from photo (${det.quality.sharpness}, ${det.quality.lighting}). Biometrics are unique (d > 0.60)!`,
            });
          }
        } catch (err: any) {
          setStatusMessage({
            type: 'error',
            text: `Face photo processing error: ${err.message}`,
          });
        } finally {
          setIsCapturing(false);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Retake face
  const handleRetakeFace = () => {
    setCapturedPhotoUrl(null);
    setCapturedEmbedding(null);
    setDuplicateCheck(null);
    if (captureMethod === 'camera') {
      startCamera();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage(null);

    // 1. Mandatory Face Verification Check
    if (!capturedEmbedding || capturedEmbedding.length === 0) {
      setStatusMessage({
        type: 'error',
        text: 'Mandatory Requirement: You must capture or upload the student\'s face biometrics before registration. No student can be registered without a registered face.',
      });
      return;
    }

    // 2. Validate Credentials
    if (!formData.roll_number.trim() || !formData.name.trim()) {
      setStatusMessage({ type: 'error', text: 'Roll Number and Student Full Name are required.' });
      return;
    }

    if (!formData.password) {
      setStatusMessage({ type: 'error', text: 'Please enter a student login password.' });
      return;
    }

    const pwdCheck = validateStrongPassword(formData.password);
    if (!pwdCheck.isValid) {
      setStatusMessage({
        type: 'error',
        text: `Password requirement: ${pwdCheck.errors[0] || 'Must be at least 8 characters with uppercase, lowercase, number, and symbol.'}`,
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        roll_number: formData.roll_number.trim(),
        name: formData.name.trim(),
        class_name: formData.class_name.trim(),
        section: formData.section.trim(),
        password: formData.password,
        embeddings: [capturedEmbedding],
      };

      const res = await fetch('/api/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to register student');
      }

      setRegisteredSuccess(data);
      setStatusMessage({
        type: 'success',
        text: `Student ${formData.name} (${formData.roll_number}) registered with verified face biometrics!`,
      });

      // Auto-sync new student to Google Sheet if connected
      syncSingleStudent({
        id: data.id || data.student_id || Date.now(),
        roll_number: formData.roll_number.trim(),
        name: formData.name.trim(),
        class_name: formData.class_name.trim(),
        section: formData.section.trim(),
        active: 1,
        has_face_registered: true,
        face_embeddings_count: 1,
        created_at: new Date().toISOString().split('T')[0],
      }).catch((e) => console.warn('Google Sheet auto-sync background note:', e));

      stopCamera();

      if (onSuccess) {
        setTimeout(() => {
          onSuccess();
        }, 1800);
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Submission failed' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetForm = () => {
    setFormData({
      roll_number: `BME2026${Math.floor(Math.random() * 80 + 10)}`,
      name: '',
      class_name: 'B.Tech BME - Semester 3',
      section: 'A',
      password: '',
    });
    setCapturedPhotoUrl(null);
    setCapturedEmbedding(null);
    setRegisteredSuccess(null);
    setStatusMessage(null);
  };

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 lg:p-8">
      {/* Hidden processing canvas & file input */}
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
      <div className="flex items-center justify-between pb-6 mb-6 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-600 text-white rounded-xl shadow-sm">
              <UserPlus className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Register New Student</h1>
              <p className="text-sm text-slate-500 mt-0.5">
                Academic Registration &amp; Mandatory Face Biometric Enrollment
              </p>
            </div>
          </div>
        </div>
        {onCancel && (
          <button
            type="button"
            onClick={() => {
              stopCamera();
              onCancel();
            }}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Directory
          </button>
        )}
      </div>

      {statusMessage && (
        <div
          className={`mb-6 p-4 rounded-xl flex items-start gap-3 text-sm font-medium ${
            statusMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : statusMessage.type === 'error'
              ? 'bg-rose-50 text-rose-800 border border-rose-200'
              : 'bg-blue-50 text-blue-800 border border-blue-200'
          }`}
        >
          {statusMessage.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />}
          {statusMessage.type === 'error' && <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />}
          {statusMessage.type === 'info' && <ShieldCheck className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />}
          <div className="flex-1">{statusMessage.text}</div>
          <button onClick={() => setStatusMessage(null)} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {registeredSuccess ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center shadow-sm">
          <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-10 h-10" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Student Registered Successfully!</h2>
          <p className="text-slate-600 max-w-md mx-auto mb-6">
            <strong>{registeredSuccess.name}</strong> ({registeredSuccess.roll_number}) has been enrolled into the student directory with verified face biometrics.
          </p>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 max-w-lg mx-auto mb-6 text-left text-sm space-y-2">
            <div className="flex justify-between py-1 border-b border-slate-200">
              <span className="text-slate-500">Student Roll Number:</span>
              <span className="font-mono font-bold text-slate-900">{registeredSuccess.roll_number}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-200">
              <span className="text-slate-500">Student Name:</span>
              <span className="font-semibold text-slate-800">{registeredSuccess.name}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-500">Biometric Face Enrollment:</span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                Live Face Captured &amp; Active (128-d Vector)
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-4">
            <button
              onClick={handleResetForm}
              className="px-6 py-2.5 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition-colors shadow-sm"
            >
              Register Another Student
            </button>
            {onSuccess && (
              <button
                onClick={onSuccess}
                className="px-6 py-2.5 bg-slate-100 text-slate-700 font-medium rounded-xl hover:bg-slate-200 transition-colors"
              >
                Go to Student Directory
              </button>
            )}
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Academic Credentials */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
              <User className="w-5 h-5 text-blue-600" />
              <h2 className="text-lg font-bold text-slate-900">Student Credentials</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Roll Number / Student ID <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  name="roll_number"
                  value={formData.roll_number}
                  onChange={handleChange}
                  placeholder="e.g. BME2026001"
                  required
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Student Full Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="e.g. Aditi Sharma"
                  required
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Class / Program <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  name="class_name"
                  value={formData.class_name}
                  onChange={handleChange}
                  placeholder="e.g. B.Tech BME - Semester 3"
                  required
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Section <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  name="section"
                  value={formData.section}
                  onChange={handleChange}
                  placeholder="e.g. A"
                  required
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Student Portal Login Password <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="Min 8 chars with uppercase, lowercase, number, symbol (e.g. Student@2026!)"
                    required
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all font-mono"
                  />
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                </div>
                {formData.password && <PasswordStrengthMeter password={formData.password} />}
              </div>
            </div>
          </div>

          {/* Mandatory Face Biometric Capture */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-2">
              <div className="flex items-center gap-2">
                <Camera className="w-5 h-5 text-blue-600" />
                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    Face Biometric Capture <span className="text-rose-600 text-sm font-bold">* MANDATORY</span>
                  </h2>
                  <p className="text-xs text-slate-500">Without face biometrics, registration cannot be submitted.</p>
                </div>
              </div>
              <div>
                {capturedEmbedding ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    Face Enrolled &amp; Verified (128-d)
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
                    <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                    Biometrics Required
                  </span>
                )}
              </div>
            </div>

            {/* Mode selection tabs: Camera vs Upload */}
            {!capturedPhotoUrl && (
              <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-xl w-fit text-xs font-bold">
                <button
                  type="button"
                  onClick={() => {
                    setCaptureMethod('camera');
                    startCamera();
                  }}
                  className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition ${
                    captureMethod === 'camera'
                      ? 'bg-white text-blue-600 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>Live Webcam</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCaptureMethod('upload');
                    stopCamera();
                  }}
                  className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition ${
                    captureMethod === 'upload'
                      ? 'bg-white text-blue-600 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload Face Photo</span>
                </button>
              </div>
            )}

            {/* Captured Photo Preview Card */}
            {capturedPhotoUrl ? (
              <div className="space-y-3">
                <div
                  className={`rounded-2xl border p-6 flex flex-col sm:flex-row items-center gap-6 ${
                    duplicateCheck?.hasDuplicate
                      ? 'bg-rose-50/70 border-rose-200'
                      : duplicateCheck?.hasPossibleMatch
                      ? 'bg-amber-50/70 border-amber-200'
                      : 'bg-emerald-50/50 border-emerald-200'
                  }`}
                >
                  <div className="relative w-36 h-36 rounded-2xl overflow-hidden border-2 border-emerald-500 shadow-md shrink-0 bg-slate-900">
                    <img
                      src={capturedPhotoUrl}
                      alt="Captured Face"
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

                  <div className="space-y-3 text-center sm:text-left flex-1">
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
                        Biometrics Analyzed (128-d Vector)
                      </div>

                      {duplicateCheck?.closestMatch && (
                        <span className="text-xs font-mono px-2 py-0.5 rounded bg-white/80 border text-slate-700">
                          Euclidean Dist: {duplicateCheck.minDistance.toFixed(3)}
                        </span>
                      )}
                    </div>

                    <h3 className="text-base font-bold text-slate-900">
                      {duplicateCheck?.hasDuplicate
                        ? '⚠️ Duplicate Face Warning'
                        : duplicateCheck?.hasPossibleMatch
                        ? 'Notice: Similar Biometric Profile'
                        : 'Unique Face Verified for Automatic Attendance'}
                    </h3>

                    {duplicateCheck?.hasDuplicate && duplicateCheck.closestMatch ? (
                      <div className="p-3 bg-white/90 border border-rose-200 rounded-xl text-xs text-rose-900 space-y-1">
                        <div className="font-bold flex items-center gap-1.5 text-rose-700">
                          <AlertTriangle className="w-4 h-4" />
                          Matches existing student: {duplicateCheck.closestMatch.name} ({duplicateCheck.closestMatch.roll_number})
                        </div>
                        <p className="text-[11px] text-rose-700">
                          Distance {duplicateCheck.minDistance.toFixed(4)} is below the 0.45 duplicate threshold. If this is a different student, consider re-capturing.
                        </p>
                      </div>
                    ) : duplicateCheck?.hasPossibleMatch && duplicateCheck.closestMatch ? (
                      <div className="p-3 bg-white/90 border border-amber-200 rounded-xl text-xs text-amber-900 space-y-1">
                        <div className="font-bold text-amber-800">
                          Resembles {duplicateCheck.closestMatch.name} ({duplicateCheck.closestMatch.roll_number})
                        </div>
                        <p className="text-[11px] text-amber-700">
                          Distance {duplicateCheck.minDistance.toFixed(4)} is within the 0.45 - 0.60 manual review band.
                        </p>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-600">
                        This biometric template is unique (distance &gt; 0.60) and ready to link with{' '}
                        <strong>{formData.name || 'this student'}</strong> for CCTV facial recognition.
                      </p>
                    )}

                    <div>
                      <button
                        type="button"
                        onClick={handleRetakeFace}
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl border border-slate-300 shadow-xs transition"
                      >
                        <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                        Retake / Re-Capture Face
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : captureMethod === 'upload' ? (
              /* Upload Photo Box */
              <div className="bg-slate-50 border-2 border-dashed border-slate-300 rounded-2xl p-8 text-center space-y-4">
                <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto border border-blue-100">
                  <Upload className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Upload Clear Student Portrait Photo</h3>
                  <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                    Select a frontal face photo or capture using your device camera. Our neural detector will automatically validate the face and extract the 128-d biometric descriptor.
                  </p>
                </div>

                <div className="flex items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isCapturing}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-sm font-semibold shadow-sm transition"
                  >
                    <Upload className="w-4 h-4" />
                    {isCapturing ? 'Analyzing Face Photo...' : 'Select Face Photo File'}
                  </button>
                </div>
              </div>
            ) : isCameraActive ? (
              /* Live Camera Active View */
              <div className="space-y-4">
                {/* Device Selector */}
                {availableDevices.length > 1 && (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-slate-500 font-medium">Camera Device:</span>
                    <select
                      value={selectedDeviceId}
                      onChange={(e) => {
                        setSelectedDeviceId(e.target.value);
                        startCamera(e.target.value);
                      }}
                      className="px-2.5 py-1 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 text-xs"
                    >
                      {availableDevices.map((d, i) => (
                        <option key={d.deviceId || i} value={d.deviceId}>
                          {d.label || `Camera ${i + 1}`}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Live Video Camera Viewport */}
                <div className="relative rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 aspect-video max-h-[340px] flex items-center justify-center text-white">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover mirror-mode"
                    style={{ transform: 'scaleX(-1)' }}
                  />

                  {/* Face Target Frame Overlay */}
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                    <div
                      className={`w-48 h-56 rounded-3xl border-2 border-dashed transition-all ${
                        faceQualityOk
                          ? 'border-emerald-400 shadow-[0_0_20px_rgba(52,211,153,0.45)]'
                          : 'border-blue-400/80 shadow-[0_0_15px_rgba(96,165,250,0.25)]'
                      }`}
                    >
                      <div className="relative w-full h-full">
                        <div className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-white"></div>
                        <div className="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-white"></div>
                        <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-white"></div>
                        <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-white"></div>
                      </div>
                    </div>
                  </div>

                  {/* Status Overlay */}
                  <div className="absolute bottom-3 left-3 right-3 bg-slate-900/85 backdrop-blur-md px-3.5 py-2 rounded-xl border border-white/10 flex items-center justify-between text-xs">
                    <span className="truncate">{faceQualityText}</span>
                    <span className="font-mono text-emerald-400 font-bold ml-2 shrink-0 flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                      Live Stream
                    </span>
                  </div>
                </div>

                {/* Camera Action Buttons */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleCaptureFace}
                      disabled={isCapturing}
                      className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-sm font-bold shadow-sm transition"
                    >
                      <Camera className="w-4 h-4" />
                      {isCapturing ? 'Processing Biometrics...' : 'Capture Student Face'}
                    </button>

                    <button
                      type="button"
                      onClick={stopCamera}
                      className="flex items-center gap-1.5 px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-medium transition"
                    >
                      <VideoOff className="w-3.5 h-3.5" />
                      Stop Camera
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* Camera Inactive State */
              <div className="bg-slate-50 rounded-2xl border border-slate-200 p-6 text-center space-y-4">
                <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto border border-blue-100">
                  <Camera className="w-7 h-7" />
                </div>
                <div className="max-w-md mx-auto">
                  <h3 className="font-bold text-slate-900 text-base">Capture Student Face with Camera</h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Click the button below to activate your webcam and capture face biometrics.
                  </p>
                </div>

                <div className="flex items-center justify-center gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => startCamera()}
                    disabled={cameraLoading}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-sm font-semibold shadow-sm transition"
                  >
                    {cameraLoading ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Connecting Camera...
                      </>
                    ) : (
                      <>
                        <Video className="w-4 h-4" />
                        Start Live Camera
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-medium transition"
                  >
                    <Upload className="w-4 h-4" />
                    Upload Photo Instead
                  </button>
                </div>

                {cameraError && (
                  <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 p-3 rounded-xl max-w-lg mx-auto text-left space-y-1">
                    <div className="font-bold flex items-center gap-1.5">
                      <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                      Camera Notice
                    </div>
                    <div>{cameraError}</div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Mandatory notice warning if no face captured */}
          {!capturedEmbedding && (
            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-2.5 text-xs text-amber-800 font-medium">
              <Info className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Face capture is mandatory. The "Register Student" button is disabled until a face is captured.</span>
            </div>
          )}

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            {onCancel && (
              <button
                type="button"
                onClick={() => {
                  stopCamera();
                  onCancel();
                }}
                className="px-5 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl transition-colors"
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              disabled={isSubmitting || !capturedEmbedding}
              className={`flex items-center gap-2 px-6 py-2.5 text-sm font-semibold rounded-xl transition-all shadow-sm ${
                !capturedEmbedding
                  ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                  : 'text-white bg-blue-600 hover:bg-blue-700'
              }`}
            >
              <UserPlus className="w-4 h-4" />
              {isSubmitting ? 'Registering Student...' : 'Register Student'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

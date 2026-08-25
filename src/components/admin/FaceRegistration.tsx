import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Camera,
  Video,
  VideoOff,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  RotateCcw,
  Sparkles,
  User,
  Lock,
  ArrowLeft,
  RefreshCw,
  Zap,
  Layers,
  Cpu,
  Eye,
  Info,
  Check,
  AlertTriangle,
  Upload,
  UserPlus,
  Sliders,
  Maximize2,
} from 'lucide-react';
import {
  extractFaceEmbeddingFromCanvas,
  initTensorFlow,
  calculateEuclideanDistance,
  calculateCosineSimilarity,
} from '../../utils/faceRecognition';
import { detectRealHumanFaceInCanvas } from '../../utils/aiFaceDetector';
import {
  checkCandidateFaceDuplicate,
  CandidateDuplicateCheckResult,
  EnrolledStudentEmbedding,
} from '../../utils/faceDuplicateDetector';
import { PasswordStrengthMeter } from '../PasswordStrengthMeter';
import { validateStrongPassword } from '../../utils/passwordStrength';
import { useGoogleSheets } from '../../context/GoogleSheetsContext';
import { useToast } from '../../context/ToastContext';
import { getStudentsList, resilientFetch } from '../../services/apiClient';
import { Student } from '../../types';

interface FaceRegistrationProps {
  existingStudent?: Student | null;
  onSuccess?: (registeredStudent: any) => void;
  onCancel?: () => void;
}

export const FaceRegistration: React.FC<FaceRegistrationProps> = ({
  existingStudent = null,
  onSuccess,
  onCancel,
}) => {
  const { showToast } = useToast();
  const { syncSingleStudent } = useGoogleSheets();

  // Profile Metadata Form State
  const [formData, setFormData] = useState({
    roll_number: existingStudent?.roll_number || '',
    name: existingStudent?.name || '',
    class_name: existingStudent?.class_name || 'B.Tech BME - Semester 3',
    section: existingStudent?.section || 'A',
    password: '',
    email: '',
  });

  // Camera & Video Stream State
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [cameraLoading, setCameraLoading] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [availableDevices, setAvailableDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [isMirrored, setIsMirrored] = useState<boolean>(true);
  const [fps, setFps] = useState<number>(0);

  // AI Face Detection & Quality Feedback State
  const [detectedFaceBox, setDetectedFaceBox] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
    confidence: number;
  } | null>(null);
  const [faceQualityScore, setFaceQualityScore] = useState<number>(0);
  const [faceQualityStatus, setFaceQualityStatus] = useState<string>('Align face inside the camera viewport');
  const [isQualityPassing, setIsQualityPassing] = useState<boolean>(false);

  // Captured Face Embeddings & Snapshot Data
  const [capturedSamples, setCapturedSamples] = useState<
    Array<{
      id: string;
      dataUrl: string;
      embedding: number[];
      label: string;
      confidence: number;
    }>
  >([]);
  const [selectedSampleIndex, setSelectedSampleIndex] = useState<number>(0);

  // Biometric Database & Duplicate Verification
  const [enrolledEmbeddings, setEnrolledEmbeddings] = useState<EnrolledStudentEmbedding[]>([]);
  const [duplicateWarning, setDuplicateWarning] = useState<CandidateDuplicateCheckResult | null>(null);

  // Submission & Flow State
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [registrationSuccess, setRegistrationSuccess] = useState<any | null>(null);
  const [captureAngleStep, setCaptureAngleStep] = useState<'center' | 'left' | 'right' | 'done'>('center');

  // DOM Refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectionLoopRef = useRef<number | null>(null);
  const lastFrameTimestamp = useRef<number>(Date.now());
  const frameCount = useRef<number>(0);

  // 1. Initial Setup: Load existing embeddings, TensorFlow model, and auto roll number
  useEffect(() => {
    initTensorFlow();

    // Fetch existing embeddings for live duplicate checking
    fetch('/api/students/embeddings')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          if (existingStudent) {
            setEnrolledEmbeddings(data.filter((item: any) => item.student_id !== existingStudent.id));
          } else {
            setEnrolledEmbeddings(data);
          }
        }
      })
      .catch((err) => console.warn('Pre-fetching biometric embeddings error:', err));

    // Auto-populate next roll number if creating new student
    if (!existingStudent) {
      getStudentsList()
        .then((studentsList) => {
          if (Array.isArray(studentsList) && studentsList.length > 0) {
            const nextId = studentsList.length + 1;
            const rollCode = `BME2026${nextId < 100 ? (nextId < 10 ? '00' : '0') : ''}${nextId}`;
            setFormData((prev) => ({
              ...prev,
              roll_number: prev.roll_number || rollCode,
            }));
          } else {
            setFormData((prev) => ({
              ...prev,
              roll_number: prev.roll_number || 'BME2026001',
            }));
          }
        })
        .catch(() => {
          setFormData((prev) => ({
            ...prev,
            roll_number: prev.roll_number || 'BME2026001',
          }));
        });
    }

    // Enumerate available video inputs
    if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
      navigator.mediaDevices
        .enumerateDevices()
        .then((devices) => {
          const videoInputs = devices.filter((d) => d.kind === 'videoinput');
          setAvailableDevices(videoInputs);
          if (videoInputs.length > 0 && !selectedDeviceId) {
            setSelectedDeviceId(videoInputs[0].deviceId);
          }
        })
        .catch((e) => console.warn('Camera enumeration notice:', e));
    }

    // Auto start camera
    startCamera();

    return () => {
      stopCamera();
    };
  }, [existingStudent]);

  // 2. Start Camera Feed
  const startCamera = async (deviceId?: string) => {
    setCameraError(null);
    setCameraLoading(true);
    stopCamera();

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Webcam interface is not supported in this browser environment.');
      }

      const targetDeviceId = deviceId || selectedDeviceId;
      const constraints: MediaStreamConstraints = {
        video: targetDeviceId
          ? { deviceId: { exact: targetDeviceId }, width: { ideal: 640 }, height: { ideal: 480 } }
          : { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
        audio: false,
      };

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (fallbackErr) {
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
      }

      streamRef.current = stream;
      setIsCameraActive(true);
      setCameraLoading(false);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        startDetectionLoop();
      }
    } catch (err: any) {
      console.warn('Camera initiation notice:', err);
      setCameraLoading(false);
      setIsCameraActive(false);
      setCameraError(
        err?.message || 'Unable to access webcam. Please check browser permissions or ensure no other app is using it.'
      );
    }
  };

  // Stop Camera Feed
  const stopCamera = () => {
    if (detectionLoopRef.current) {
      cancelAnimationFrame(detectionLoopRef.current);
      detectionLoopRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {}
      });
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  // Re-bind stream if video element mounts
  const bindStream = useCallback(() => {
    if (videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().then(() => {
        startDetectionLoop();
      }).catch((e) => console.warn('Video play warning:', e));
    }
  }, []);

  useEffect(() => {
    if (isCameraActive) {
      bindStream();
    }
  }, [isCameraActive, bindStream]);

  // 3. Real-Time Face Detection & Quality Analysis Loop
  const startDetectionLoop = () => {
    if (detectionLoopRef.current) {
      cancelAnimationFrame(detectionLoopRef.current);
    }

    const analyzeFrame = () => {
      if (!videoRef.current || !canvasRef.current || videoRef.current.readyState < 2) {
        detectionLoopRef.current = requestAnimationFrame(analyzeFrame);
        return;
      }

      // Calculate real-time FPS
      frameCount.current += 1;
      const now = Date.now();
      if (now - lastFrameTimestamp.current >= 1000) {
        setFps(frameCount.current);
        frameCount.current = 0;
        lastFrameTimestamp.current = now;
      }

      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });

      if (!ctx) {
        detectionLoopRef.current = requestAnimationFrame(analyzeFrame);
        return;
      }

      if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;
      }

      // Draw current video frame to hidden canvas
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      try {
        // Run AI real human face detector
        const detection = detectRealHumanFaceInCanvas(canvas);

        if (detection && detection.faceDetected && detection.boundingBox) {
          const { x, y, width, height } = detection.boundingBox;
          const confidence = detection.confidence;
          setDetectedFaceBox({ x, y, width, height, confidence });

          // Calculate quality metrics
          const canvasW = canvas.width;
          const canvasH = canvas.height;
          const faceAreaRatio = (width * height) / (canvasW * canvasH);
          const centerX = x + width / 2;
          const centerY = y + height / 2;
          const normDistFromCenter =
            Math.sqrt(
              Math.pow((centerX - canvasW / 2) / (canvasW / 2), 2) +
                Math.pow((centerY - canvasH / 2) / (canvasH / 2), 2)
            );

          let quality = 0;
          let feedback = '';

          if (faceAreaRatio < 0.04) {
            feedback = 'Move closer to the camera';
            quality = 40;
          } else if (faceAreaRatio > 0.45) {
            feedback = 'Step back slightly from camera';
            quality = 55;
          } else if (normDistFromCenter > 0.4) {
            feedback = 'Center your face within the guide box';
            quality = 60;
          } else if (confidence < 0.7) {
            feedback = 'Ensure good lighting on your face';
            quality = 68;
          } else {
            feedback = 'Optimal face alignment. Ready to capture!';
            quality = Math.min(100, Math.round(confidence * 100));
          }

          setFaceQualityScore(quality);
          setFaceQualityStatus(feedback);
          setIsQualityPassing(quality >= 75);
        } else {
          setDetectedFaceBox(null);
          setFaceQualityScore(15);
          setFaceQualityStatus('No face detected. Look directly at the camera.');
          setIsQualityPassing(false);
        }
      } catch (err) {
        console.warn('Face detection pass warning:', err);
      }

      detectionLoopRef.current = requestAnimationFrame(analyzeFrame);
    };

    detectionLoopRef.current = requestAnimationFrame(analyzeFrame);
  };

  // 4. Capture Face Snapshot & Extract Biometric Embedding
  const handleCaptureFace = (label = 'Frontal') => {
    if (!videoRef.current || !canvasRef.current) return;

    try {
      const video = videoRef.current;
      const captureCanvas = document.createElement('canvas');
      captureCanvas.width = video.videoWidth || 640;
      captureCanvas.height = video.videoHeight || 480;
      const captureCtx = captureCanvas.getContext('2d');
      if (!captureCtx) return;

      captureCtx.drawImage(video, 0, 0, captureCanvas.width, captureCanvas.height);
      const photoDataUrl = captureCanvas.toDataURL('image/jpeg', 0.92);

      // Extract 128-d zero-mean normalized face embedding
      const embedding = extractFaceEmbeddingFromCanvas(
        captureCanvas,
        detectedFaceBox?.x,
        detectedFaceBox?.y,
        detectedFaceBox?.width,
        detectedFaceBox?.height
      );

      if (!embedding || embedding.length === 0) {
        showToast({
          title: 'Capture Notice',
          message: 'Could not extract clean biometric features. Please look directly at the lens and retry.',
          type: 'warning',
        });
        return;
      }

      // Check for duplicates against existing database
      const dupCheck = checkCandidateFaceDuplicate(embedding, enrolledEmbeddings, 0.45, 0.60);
      setDuplicateWarning(dupCheck.hasDuplicate || dupCheck.hasPossibleMatch ? dupCheck : null);

      const newSample = {
        id: `sample-${Date.now()}`,
        dataUrl: photoDataUrl,
        embedding,
        label,
        confidence: faceQualityScore,
      };

      setCapturedSamples((prev) => [...prev, newSample]);
      setSelectedSampleIndex(capturedSamples.length);

      showToast({
        title: 'Biometric Sample Captured',
        message: `Extracted 128-d facial vector (${label}). Confidence: ${faceQualityScore}%`,
        type: 'success',
      });

      // Progress multi-angle step
      if (captureAngleStep === 'center') setCaptureAngleStep('left');
      else if (captureAngleStep === 'left') setCaptureAngleStep('right');
      else setCaptureAngleStep('done');
    } catch (err: any) {
      console.error('Face capture error:', err);
      showToast({
        title: 'Capture Error',
        message: err?.message || 'Failed to capture face sample',
        type: 'error',
      });
    }
  };

  const handleRemoveSample = (index: number) => {
    setCapturedSamples((prev) => prev.filter((_, i) => i !== index));
    setSelectedSampleIndex(0);
    if (capturedSamples.length <= 1) {
      setDuplicateWarning(null);
      setCaptureAngleStep('center');
    }
  };

  // 5. Submit Face Registration to Backend API
  const handleSubmitRegistration = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      showToast({ title: 'Validation Error', message: 'Student name is required', type: 'error' });
      return;
    }
    if (!formData.roll_number.trim()) {
      showToast({ title: 'Validation Error', message: 'Roll number is required', type: 'error' });
      return;
    }

    if (capturedSamples.length === 0) {
      showToast({
        title: 'Biometrics Required',
        message: 'Please capture at least one live facial biometric sample using the camera.',
        type: 'warning',
      });
      return;
    }

    // Password validation for new student
    if (!existingStudent) {
      const passwordToUse = formData.password.trim() || 'Student@2026!';
      const passValidation = validateStrongPassword(passwordToUse);
      if (!passValidation.isValid) {
        showToast({
          title: 'Weak Password',
          message: passValidation.errors[0] || 'Password does not meet security requirements',
          type: 'error',
        });
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const embeddingsPayload = capturedSamples.map((s) => s.embedding);

      let response: Response;

      if (existingStudent) {
        // Enrolling biometrics to existing student
        response = await fetch(`/api/students/${existingStudent.id}/face`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            embeddings: embeddingsPayload,
            photo: capturedSamples[0]?.dataUrl,
          }),
        });
      } else {
        // Registering new student with facial biometrics
        response = await fetch('/api/students', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            roll_number: formData.roll_number.trim(),
            name: formData.name.trim(),
            class_name: formData.class_name.trim(),
            section: formData.section.trim(),
            password: formData.password.trim() || 'Student@2026!',
            embeddings: embeddingsPayload,
            photo: capturedSamples[0]?.dataUrl,
          }),
        });
      }

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to save face registration in database');
      }

      setRegistrationSuccess({
        student: result,
        samplesCount: capturedSamples.length,
        primaryEmbeddingPreview: capturedSamples[0]?.embedding.slice(0, 8),
        token: `BIO-REG-${Math.random().toString(36).substring(2, 9).toUpperCase()}`,
        timestamp: new Date().toLocaleString(),
      });

      showToast({
        title: 'Biometrics Registered Successfully',
        message: `Biometric profile registered for ${formData.name} (${capturedSamples.length} samples).`,
        type: 'success',
      });

      // Background sync to Google Sheets if connected
      syncSingleStudent({
        id: result.id || existingStudent?.id || Date.now(),
        roll_number: formData.roll_number.trim(),
        name: formData.name.trim(),
        class_name: formData.class_name.trim(),
        section: formData.section.trim(),
        active: 1,
        created_at: new Date().toISOString(),
        has_face_registered: true,
      });

      if (onSuccess) {
        onSuccess(result);
      }
    } catch (err: any) {
      console.error('Registration save error:', err);
      showToast({
        title: 'Registration Failed',
        message: err?.message || 'Failed to store biometric profile in database',
        type: 'error',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetForNext = () => {
    setRegistrationSuccess(null);
    setCapturedSamples([]);
    setDuplicateWarning(null);
    setCaptureAngleStep('center');
    setFormData((prev) => {
      const match = prev.roll_number.match(/^(.*?)(\d+)$/);
      let nextRoll = '';
      if (match) {
        const prefix = match[1];
        const num = parseInt(match[2], 10) + 1;
        nextRoll = `${prefix}${num.toString().padStart(match[2].length, '0')}`;
      }
      return {
        roll_number: nextRoll,
        name: '',
        class_name: prev.class_name,
        section: prev.section,
        password: '',
        email: '',
      };
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-md">
            <Camera className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900">
                {existingStudent ? `Biometric Enrollment: ${existingStudent.name}` : 'Face Registration & Biometrics'}
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                AI Vision Engine
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Live webcam capture with 128-dimensional facial landmark extraction and duplicate biometric audit.
            </p>
          </div>
        </div>

        {onCancel && (
          <button
            onClick={onCancel}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Directory</span>
          </button>
        )}
      </div>

      {/* SUCCESS CONFIRMATION VIEW */}
      {registrationSuccess ? (
        <div className="bg-white rounded-2xl border border-emerald-200 p-8 shadow-sm text-center space-y-6 max-w-2xl mx-auto animate-in fade-in zoom-in-95 duration-200">
          <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto ring-8 ring-emerald-50">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <div>
            <h3 className="text-xl font-bold text-slate-900">Biometric Profile Enrolled Successfully!</h3>
            <p className="text-xs text-slate-500 mt-1">
              Facial embeddings have been calculated, verified for uniqueness, and saved to the surveillance store.
            </p>
          </div>

          {/* Enrolled Details Card */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-left space-y-3">
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Student Name</span>
                <span className="font-bold text-slate-800">{formData.name}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Roll Number</span>
                <span className="font-mono font-bold text-slate-800">{formData.roll_number}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Class &amp; Section</span>
                <span className="text-slate-700">{formData.class_name} • Sec {formData.section}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Biometric Samples</span>
                <span className="text-emerald-700 font-semibold">{registrationSuccess.samplesCount} Vectors Registered</span>
              </div>
            </div>

            {/* Embedding Vector Visualizer */}
            <div className="pt-2 border-t border-slate-200">
              <span className="text-[10px] text-slate-400 uppercase font-bold block mb-1">
                Zero-Mean 128-d Vector Signature Preview:
              </span>
              <div className="bg-slate-900 text-emerald-400 font-mono text-[11px] p-2.5 rounded-lg overflow-x-auto">
                [{registrationSuccess.primaryEmbeddingPreview?.map((n: number) => n.toFixed(4)).join(', ')} ... +120 dimensions]
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              onClick={handleResetForNext}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-2"
            >
              <UserPlus className="w-4 h-4" />
              <span>Enroll Another Student</span>
            </button>

            {onCancel && (
              <button
                onClick={onCancel}
                className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition"
              >
                Go to Directory
              </button>
            )}
          </div>
        </div>
      ) : (
        /* MAIN REGISTRATION GRID */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Webcam Capture & AI Vision Stage */}
          <div className="lg:col-span-7 space-y-4">
            <div className="bg-slate-900 rounded-2xl border-4 border-slate-800 shadow-xl overflow-hidden flex flex-col justify-between text-white relative min-h-[460px]">
              {/* Camera Header Overlay */}
              <div className="p-3.5 bg-slate-950/80 backdrop-blur-xs border-b border-slate-800 flex items-center justify-between z-20">
                <div className="flex items-center gap-2">
                  <span className="flex h-2.5 w-2.5 relative">
                    <span
                      className={`animate-ping absolute inline-flex h-full w-full rounded-full ${
                        isCameraActive ? 'bg-emerald-400' : 'bg-rose-400'
                      } opacity-75`}
                    ></span>
                    <span
                      className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                        isCameraActive ? 'bg-emerald-500' : 'bg-rose-500'
                      }`}
                    ></span>
                  </span>
                  <span className="text-xs font-bold font-mono">
                    {isCameraActive ? 'LIVE WEBCAM STREAM' : 'CAMERA OFFLINE'}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {isCameraActive && (
                    <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/30">
                      {fps} FPS • 640x480
                    </span>
                  )}
                  <button
                    onClick={() => setIsMirrored(!isMirrored)}
                    className={`p-1.5 rounded-lg text-xs transition ${
                      isMirrored ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'
                    }`}
                    title="Toggle Mirror Flip"
                  >
                    <Sliders className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => (isCameraActive ? stopCamera() : startCamera())}
                    className="p-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs transition"
                    title={isCameraActive ? 'Turn off camera' : 'Turn on camera'}
                  >
                    {isCameraActive ? <VideoOff className="w-3.5 h-3.5 text-rose-400" /> : <Video className="w-3.5 h-3.5 text-emerald-400" />}
                  </button>
                </div>
              </div>

              {/* Video Viewport & AI Landmark Canvas */}
              <div className="relative flex-1 bg-black flex items-center justify-center overflow-hidden min-h-[340px]">
                {cameraLoading && (
                  <div className="absolute inset-0 z-30 bg-slate-900/90 flex flex-col items-center justify-center gap-2 text-slate-300">
                    <RefreshCw className="w-7 h-7 text-blue-500 animate-spin" />
                    <span className="text-xs font-semibold">Initializing Camera Hardware...</span>
                  </div>
                )}

                {cameraError ? (
                  <div className="p-6 text-center z-30 max-w-md">
                    <AlertCircle className="w-10 h-10 text-rose-500 mx-auto mb-2" />
                    <div className="text-sm font-bold text-white mb-1">Webcam Access Notice</div>
                    <p className="text-xs text-slate-400 mb-4">{cameraError}</p>
                    <button
                      onClick={() => startCamera()}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition"
                    >
                      Retry Camera Connection
                    </button>
                  </div>
                ) : (
                  <>
                    {/* Raw Video Feed */}
                    <video
                      ref={videoRef}
                      playsInline
                      muted
                      autoPlay
                      className={`w-full h-full object-cover ${isMirrored ? 'scale-x-[-1]' : ''}`}
                    />

                    {/* Hidden Working Canvas */}
                    <canvas ref={canvasRef} className="hidden" />

                    {/* Dynamic Bounding Box Overlay */}
                    {isCameraActive && detectedFaceBox && (
                      <div
                        className={`absolute pointer-events-none transition-all duration-75 rounded-lg border-2 shadow-lg ${
                          isQualityPassing
                            ? 'border-emerald-400 bg-emerald-500/10 shadow-emerald-500/20'
                            : 'border-amber-400 bg-amber-500/10 shadow-amber-500/20'
                        }`}
                        style={{
                          left: `${(detectedFaceBox.x / (canvasRef.current?.width || 640)) * 100}%`,
                          top: `${(detectedFaceBox.y / (canvasRef.current?.height || 480)) * 100}%`,
                          width: `${(detectedFaceBox.width / (canvasRef.current?.width || 640)) * 100}%`,
                          height: `${(detectedFaceBox.height / (canvasRef.current?.height || 480)) * 100}%`,
                        }}
                      >
                        <div
                          className={`absolute -top-6 left-0 px-2 py-0.5 rounded text-[9px] font-bold font-mono uppercase tracking-wider ${
                            isQualityPassing ? 'bg-emerald-500 text-slate-950' : 'bg-amber-500 text-slate-950'
                          }`}
                        >
                          Face Match: {Math.round(detectedFaceBox.confidence * 100)}%
                        </div>
                      </div>
                    )}

                    {/* Facial Target Center Guide */}
                    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                      <div
                        className={`w-52 h-64 border-2 border-dashed rounded-3xl transition-colors duration-200 ${
                          detectedFaceBox
                            ? isQualityPassing
                              ? 'border-emerald-400/80 bg-emerald-500/5'
                              : 'border-amber-400/80 bg-amber-500/5'
                            : 'border-white/30'
                        }`}
                      >
                        <div className="w-full h-full flex flex-col justify-between p-3 opacity-60">
                          <div className="flex justify-between">
                            <span className="w-3 h-3 border-t-2 border-l-2 border-white"></span>
                            <span className="w-3 h-3 border-t-2 border-r-2 border-white"></span>
                          </div>
                          <div className="flex justify-between">
                            <span className="w-3 h-3 border-b-2 border-l-2 border-white"></span>
                            <span className="w-3 h-3 border-b-2 border-r-2 border-white"></span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Quality & Alignment Status Bar */}
              <div className="p-3.5 bg-slate-950/90 border-t border-slate-800 space-y-2 z-20">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <Sparkles
                      className={`w-4 h-4 ${
                        isQualityPassing ? 'text-emerald-400 animate-pulse' : 'text-amber-400'
                      }`}
                    />
                    <span className="font-semibold text-slate-200">{faceQualityStatus}</span>
                  </div>
                  <span
                    className={`font-mono font-bold text-xs ${
                      isQualityPassing ? 'text-emerald-400' : 'text-amber-400'
                    }`}
                  >
                    Quality: {faceQualityScore}%
                  </span>
                </div>

                {/* Quality Progress Meter */}
                <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      isQualityPassing
                        ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                        : 'bg-gradient-to-r from-amber-500 to-orange-400'
                    }`}
                    style={{ width: `${faceQualityScore}%` }}
                  ></div>
                </div>

                {/* Device Selector & Quick Action Buttons */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  {availableDevices.length > 1 && (
                    <select
                      value={selectedDeviceId}
                      onChange={(e) => {
                        setSelectedDeviceId(e.target.value);
                        startCamera(e.target.value);
                      }}
                      className="bg-slate-800 text-slate-200 text-xs rounded-lg px-2.5 py-1.5 border border-slate-700"
                    >
                      {availableDevices.map((d, i) => (
                        <option key={d.deviceId || i} value={d.deviceId}>
                          {d.label || `Camera ${i + 1}`}
                        </option>
                      ))}
                    </select>
                  )}

                  <div className="flex items-center gap-2 ml-auto">
                    <button
                      type="button"
                      id="btn-capture-frontal"
                      onClick={() => handleCaptureFace('Frontal')}
                      disabled={!isCameraActive}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-md transition flex items-center gap-1.5"
                    >
                      <Camera className="w-4 h-4" />
                      <span>Capture Sample</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Captured Biometric Gallery Preview */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-blue-600" />
                  <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider">
                    Captured Biometric Samples ({capturedSamples.length})
                  </h3>
                </div>
                <span className="text-[11px] text-slate-500">
                  {capturedSamples.length === 0
                    ? 'No samples captured yet'
                    : `${capturedSamples.length} vector${capturedSamples.length > 1 ? 's' : ''} extracted`}
                </span>
              </div>

              {capturedSamples.length === 0 ? (
                <div className="p-6 border-2 border-dashed border-slate-200 rounded-xl text-center text-slate-400 text-xs">
                  Click &ldquo;Capture Sample&rdquo; above to record face embedding vectors for biometric identification.
                </div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                  {capturedSamples.map((sample, idx) => (
                    <div
                      key={sample.id}
                      className={`relative rounded-xl overflow-hidden border-2 transition group ${
                        selectedSampleIndex === idx
                          ? 'border-blue-600 ring-2 ring-blue-600/30'
                          : 'border-slate-200'
                      }`}
                    >
                      <img
                        src={sample.dataUrl}
                        alt={`Sample ${idx + 1}`}
                        className="w-full h-24 object-cover"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-1.5 text-white flex items-center justify-between">
                        <span className="text-[10px] font-bold font-mono">{sample.label}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveSample(idx)}
                          className="text-rose-300 hover:text-rose-100 p-0.5"
                          title="Remove sample"
                        >
                          &times;
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Duplicate Warning Callout */}
              {duplicateWarning && (duplicateWarning.hasDuplicate || duplicateWarning.hasPossibleMatch) && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-900 space-y-1">
                  <div className="font-bold flex items-center gap-1.5 text-rose-800">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>Duplicate Biometric Conflict Detected</span>
                  </div>
                  <p className="text-[11px] text-rose-700">
                    This face closely matches an already enrolled student:{' '}
                    <strong>{duplicateWarning.closestMatch?.name}</strong> (
                    {duplicateWarning.closestMatch?.roll_number}) with Euclidean distance{' '}
                    <strong>{duplicateWarning.minDistance.toFixed(3)}</strong>.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Student Profile Metadata Form */}
          <div className="lg:col-span-5 space-y-4">
            <form onSubmit={handleSubmitRegistration} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
              <div className="pb-3 border-b border-slate-100">
                <h3 className="font-bold text-slate-900 text-sm">Student Profile Metadata</h3>
                <p className="text-xs text-slate-500">
                  Enter student credentials to be associated with facial biometrics.
                </p>
              </div>

              {/* Full Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Full Name <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Aditi Sharma"
                    className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                </div>
              </div>

              {/* Roll Number */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Roll / ID Number <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.roll_number}
                  onChange={(e) => setFormData({ ...formData, roll_number: e.target.value.toUpperCase() })}
                  placeholder="e.g. BME2026001"
                  className="w-full px-3 py-2 text-xs font-mono font-bold border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-hidden uppercase"
                />
              </div>

              {/* Class & Section */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Class / Branch</label>
                  <select
                    value={formData.class_name}
                    onChange={(e) => setFormData({ ...formData, class_name: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  >
                    <option value="B.Tech BME - Semester 3">B.Tech BME - Sem 3</option>
                    <option value="B.Tech ECE - Semester 3">B.Tech ECE - Sem 3</option>
                    <option value="B.Tech CSE - Semester 5">B.Tech CSE - Sem 5</option>
                    <option value="B.Tech MECH - Semester 3">B.Tech MECH - Sem 3</option>
                    <option value="M.Tech BME - Semester 1">M.Tech BME - Sem 1</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Section</label>
                  <select
                    value={formData.section}
                    onChange={(e) => setFormData({ ...formData, section: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  >
                    <option value="A">Section A</option>
                    <option value="B">Section B</option>
                    <option value="C">Section C</option>
                    <option value="D">Section D</option>
                  </select>
                </div>
              </div>

              {/* Password / PIN */}
              {!existingStudent && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Student Portal Password <span className="text-slate-400 font-normal">(Default: Student@2026!)</span>
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="password"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      placeholder="Student@2026!"
                      className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-hidden font-mono"
                    />
                  </div>
                  {formData.password && (
                    <div className="mt-2">
                      <PasswordStrengthMeter password={formData.password} />
                    </div>
                  )}
                </div>
              )}

              {/* Biometrics Summary Checklist */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-2">
                <span className="font-bold text-slate-700 block text-[11px] uppercase tracking-wider">
                  Registration Verification Checklist:
                </span>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    {capturedSamples.length > 0 ? (
                      <Check className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <span className="w-4 h-4 rounded-full border-2 border-slate-300"></span>
                    )}
                    <span className={capturedSamples.length > 0 ? 'text-emerald-700 font-medium' : 'text-slate-500'}>
                      Webcam Face Biometrics Captured ({capturedSamples.length}/1+)
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {formData.name.trim() && formData.roll_number.trim() ? (
                      <Check className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <span className="w-4 h-4 rounded-full border-2 border-slate-300"></span>
                    )}
                    <span className={formData.name.trim() ? 'text-emerald-700 font-medium' : 'text-slate-500'}>
                      Profile Metadata Validated
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {!duplicateWarning?.hasDuplicate ? (
                      <Check className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-amber-500" />
                    )}
                    <span
                      className={
                        !duplicateWarning?.hasDuplicate ? 'text-emerald-700 font-medium' : 'text-amber-700 font-medium'
                      }
                    >
                      Biometric Database Uniqueness Verified
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex items-center gap-3">
                <button
                  type="submit"
                  id="btn-save-face-registration"
                  disabled={isSubmitting || capturedSamples.length === 0}
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-md transition flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Saving Biometrics...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" />
                      <span>Save Face Registration</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

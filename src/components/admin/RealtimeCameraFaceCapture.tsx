import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Period, Student } from '../../types';
import {
  StudentEmbedding,
  ObservationTracker,
  isValidFaceImage,
  initTensorFlow,
  extractTFFaceEmbedding,
  matchFaceWithTensorFlow,
} from '../../utils/faceRecognition';
import {
  detectFaceRegionInFrame,
  detectRealHumanFaceInCanvas,
} from '../../utils/aiFaceDetector';
import {
  Camera,
  Video,
  Play,
  Pause,
  CheckCircle2,
  AlertCircle,
  Clock,
  Download,
  Volume2,
  VolumeX,
  FlipHorizontal,
  ShieldCheck,
  Zap,
  Scan,
  FileSpreadsheet,
  RefreshCw,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { useToast } from '../../context/ToastContext';
import { useGoogleSheets } from '../../context/GoogleSheetsContext';
import { getStudentsList, getStudentEmbeddingsList } from '../../services/apiClient';

interface RealtimeCameraFaceCaptureProps {
  currentDateStr: string;
  activePeriod: Period | null;
  periods: Period[];
  onAttendanceMarked: () => void;
}

interface CapturedSessionItem {
  id: string;
  studentId: number;
  studentName: string;
  rollNumber: string;
  className: string;
  section: string;
  confidence: number;
  timeStr: string;
  snapshotUrl?: string;
  status: 'PRESENT' | 'LATE';
}

// Audio chime using Web Audio API
function playRecognitionChime() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.exponentialRampToValueAtTime(880.0, ctx.currentTime + 0.15); // A5

    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.35);
  } catch (e) {
    // Audio context may be blocked until user interaction
  }
}

export const RealtimeCameraFaceCapture: React.FC<RealtimeCameraFaceCaptureProps> = ({
  currentDateStr,
  activePeriod,
  periods,
  onAttendanceMarked,
}) => {
  const { showBatchProcessedToast, showToast } = useToast();
  const { syncSingleAttendance, isConnected } = useGoogleSheets();

  // Video & Canvas DOM references
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const hiddenCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Stream & Hardware State
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraDevices, setCameraDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = useState<boolean>(true);
  const [isMirrored, setIsMirrored] = useState<boolean>(true);

  // Target Period Configuration
  const [selectedPeriodId, setSelectedPeriodId] = useState<number>(
    activePeriod ? activePeriod.id : periods[0] ? periods[0].id : 1
  );
  const selectedPeriodObj = periods.find((p) => p.id === selectedPeriodId) || activePeriod;

  // Real-time synchronization with active period
  useEffect(() => {
    if (activePeriod && activePeriod.id) {
      setSelectedPeriodId(activePeriod.id);
    }
  }, [activePeriod?.id]);

  // AI Pipeline Parameters
  const [strictMaxDistance, setStrictMaxDistance] = useState<number>(0.48);
  const [sensitivityPreset, setSensitivityPreset] = useState<'HIGH' | 'BALANCED' | 'FAST'>('BALANCED');
  const [requiredFrames, setRequiredFrames] = useState<number>(2);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);

  // Recognition Data & Session Logs
  const [registeredEmbeddings, setRegisteredEmbeddings] = useState<StudentEmbedding[]>([]);
  const [enrolledStudents, setEnrolledStudents] = useState<Student[]>([]);
  const [sessionMarkedList, setSessionMarkedList] = useState<CapturedSessionItem[]>([]);
  const [recentFlashMessage, setRecentFlashMessage] = useState<{
    text: string;
    type: 'success' | 'warn' | 'info';
  } | null>(null);

  // Real-time telemetry
  const [telemetry, setTelemetry] = useState({
    fps: 0,
    faceLocked: false,
    faceStatus: 'Searching for face...',
  });

  // Trackers & Smooth Box Interpolation
  const trackerRef = useRef<ObservationTracker>(new ObservationTracker(2));
  const animationLoopRef = useRef<number | null>(null);
  const lastScanTimestampRef = useRef<number>(0);
  const frameCounterRef = useRef<number>(0);
  const lastFpsCalcRef = useRef<number>(Date.now());
  const currentBoxRef = useRef<{ x: number; y: number; w: number; h: number } | null>(null);

  const handleSetSensitivity = (preset: 'HIGH' | 'BALANCED' | 'FAST') => {
    setSensitivityPreset(preset);
    if (preset === 'HIGH') {
      setStrictMaxDistance(0.42);
      setRequiredFrames(3);
      trackerRef.current.setRequiredFrames(3);
    } else if (preset === 'BALANCED') {
      setStrictMaxDistance(0.48);
      setRequiredFrames(2);
      trackerRef.current.setRequiredFrames(2);
    } else {
      setStrictMaxDistance(0.52);
      setRequiredFrames(2);
      trackerRef.current.setRequiredFrames(2);
    }
  };

  useEffect(() => {
    initTensorFlow();

    getStudentEmbeddingsList()
      .then((data) => {
        if (Array.isArray(data)) {
          setRegisteredEmbeddings(data);
        }
      })
      .catch((err) => console.warn('Biometric embeddings notice:', err));

    getStudentsList()
      .then((data) => {
        if (Array.isArray(data)) {
          setEnrolledStudents(data);
        }
      })
      .catch((err) => console.warn('Student directory notice:', err));
  }, []);

  useEffect(() => {
    trackerRef.current.setRequiredFrames(requiredFrames);
  }, [requiredFrames]);

  const triggerFlash = (text: string, type: 'success' | 'warn' | 'info' = 'info') => {
    setRecentFlashMessage({ text, type });
    setTimeout(() => {
      setRecentFlashMessage((curr) => (curr?.text === text ? null : curr));
    }, 4000);
  };

  const enumerateCameras = useCallback(async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return;
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = devices.filter((d) => d.kind === 'videoinput');
      setCameraDevices(videoInputs);
      if (videoInputs.length > 0 && !selectedDeviceId) {
        setSelectedDeviceId(videoInputs[0].deviceId);
      }
    } catch (e) {
      console.warn('Failed to enumerate camera devices:', e);
    }
  }, [selectedDeviceId]);

  const startCamera = useCallback(
    async (deviceId?: string) => {
      setCameraError(null);

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraError('Camera API not supported on this browser.');
        return;
      }

      try {
        if (stream) {
          stream.getTracks().forEach((track) => track.stop());
        }

        const constraints: MediaStreamConstraints = {
          video: {
            deviceId: deviceId ? { exact: deviceId } : undefined,
            width: { ideal: 640 },
            height: { ideal: 480 },
            facingMode: 'user',
          },
          audio: false,
        };

        const newStream = await navigator.mediaDevices.getUserMedia(constraints);
        setStream(newStream);

        if (videoRef.current) {
          videoRef.current.srcObject = newStream;
          await videoRef.current.play();
        }

        setIsCameraActive(true);
        setCameraError(null);
        await enumerateCameras();
      } catch (err: any) {
        console.warn('Camera error:', err);
        setIsCameraActive(false);
        setCameraError('Camera access denied. Please grant webcam permission or open in a new tab.');
      }
    },
    [stream, enumerateCameras]
  );

  const stopCamera = useCallback(() => {
    if (animationLoopRef.current) {
      cancelAnimationFrame(animationLoopRef.current);
      animationLoopRef.current = null;
    }
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  }, [stream]);

  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, []);

  const markAttendanceRecord = async (
    studentId: number,
    studentName: string,
    rollNumber: string,
    className: string,
    section: string,
    confidence: number,
    snapshotUrl?: string
  ) => {
    const startTime = performance.now();
    try {
      const res = await fetch('/api/attendance/record-face', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: studentId,
          date: currentDateStr,
          period_id: selectedPeriodId,
          confidence,
          is_manual: false,
        }),
      });

      const latency = Math.round(performance.now() - startTime);

      if (res.ok) {
        const timeNow = new Date().toLocaleTimeString();

        setSessionMarkedList((prev) => [
          {
            id: `${studentId}-${Date.now()}`,
            studentId,
            studentName,
            rollNumber,
            className,
            section,
            confidence,
            timeStr: timeNow,
            snapshotUrl,
            status: 'PRESENT',
          },
          ...prev.filter((i) => i.studentId !== studentId).slice(0, 50),
        ]);

        if (soundEnabled) {
          playRecognitionChime();
        }

        triggerFlash(
          `Verified & Marked PRESENT: ${studentName} (${rollNumber}) in Period ${selectedPeriodObj ? selectedPeriodObj.period_number : selectedPeriodId}`,
          'success'
        );

        showBatchProcessedToast({
          frameCount: requiredFrames,
          studentNames: studentName,
          periodId: selectedPeriodId,
          confidence,
          dbLatencyMs: latency,
          customMessage: `${studentName} (${rollNumber}) marked Present in Period ${selectedPeriodObj ? selectedPeriodObj.period_number : selectedPeriodId}`,
        });

        syncSingleAttendance({
          date: currentDateStr,
          period_number: selectedPeriodObj ? selectedPeriodObj.period_number : selectedPeriodId,
          period_timing: selectedPeriodObj ? `${selectedPeriodObj.start_time} - ${selectedPeriodObj.end_time}` : undefined,
          roll_number: rollNumber,
          student_name: studentName,
          class_name: className,
          section: section,
          status: 'PRESENT',
          confidence,
          method: 'Face Scanner',
          recorded_at: timeNow,
          notes: `Live Desk Scanner in Period ${selectedPeriodObj ? selectedPeriodObj.period_number : selectedPeriodId}`,
        }).catch((e) => console.warn('Google Sheet sync notice:', e));

        onAttendanceMarked();
      }
    } catch (err) {
      console.error('Failed to log attendance:', err);
    }
  };

  const processLiveFrame = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas || video.readyState < 2 || !isCameraActive) {
      animationLoopRef.current = requestAnimationFrame(processLiveFrame);
      return;
    }

    const vw = video.videoWidth || 640;
    const vh = video.videoHeight || 480;

    if (canvas.width !== vw || canvas.height !== vh) {
      canvas.width = vw;
      canvas.height = vh;
    }

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
      animationLoopRef.current = requestAnimationFrame(processLiveFrame);
      return;
    }

    ctx.clearRect(0, 0, vw, vh);

    frameCounterRef.current++;
    const now = Date.now();
    if (now - lastFpsCalcRef.current >= 1000) {
      setTelemetry((prev) => ({
        ...prev,
        fps: frameCounterRef.current,
      }));
      frameCounterRef.current = 0;
      lastFpsCalcRef.current = now;
    }

    const scanIntervalMs = 200;
    const timeSinceLastScan = now - lastScanTimestampRef.current;

    if (timeSinceLastScan >= scanIntervalMs) {
      lastScanTimestampRef.current = now;

      const detectedFace = detectFaceRegionInFrame(video, false);
      const verificationResult = detectRealHumanFaceInCanvas(video);

      const targetBox = detectedFace
        ? {
            x: Math.round(detectedFace.x),
            y: Math.round(detectedFace.y),
            w: Math.round(detectedFace.width),
            h: Math.round(detectedFace.height),
          }
        : {
            x: Math.round(vw * 0.25),
            y: Math.round(vh * 0.18),
            w: Math.round(vw * 0.50),
            h: Math.round(vh * 0.64),
          };

      if (!currentBoxRef.current) {
        currentBoxRef.current = targetBox;
      } else {
        const smoothFactor = 0.35;
        currentBoxRef.current = {
          x: Math.round(currentBoxRef.current.x + (targetBox.x - currentBoxRef.current.x) * smoothFactor),
          y: Math.round(currentBoxRef.current.y + (targetBox.y - currentBoxRef.current.y) * smoothFactor),
          w: Math.round(currentBoxRef.current.w + (targetBox.w - currentBoxRef.current.w) * smoothFactor),
          h: Math.round(currentBoxRef.current.h + (targetBox.h - currentBoxRef.current.h) * smoothFactor),
        };
      }

      const { x: boxX, y: boxY, w: boxW, h: boxH } = currentBoxRef.current;

      const hiddenCanvas = hiddenCanvasRef.current || document.createElement('canvas');
      hiddenCanvas.width = Math.max(20, boxW);
      hiddenCanvas.height = Math.max(20, boxH);
      const hCtx = hiddenCanvas.getContext('2d', { willReadFrequently: true });

      if (hCtx) {
        hCtx.drawImage(video, boxX, boxY, boxW, boxH, 0, 0, boxW, boxH);
        const qualityCheck = isValidFaceImage(hCtx, boxW, boxH);

        if (detectedFace && qualityCheck.isValid && verificationResult.faceDetected) {
          const embedding = extractTFFaceEmbedding(hiddenCanvas);
          const match = matchFaceWithTensorFlow(embedding, registeredEmbeddings, strictMaxDistance);

          setTelemetry((prev) => ({
            ...prev,
            faceLocked: !match.isUnknown,
            faceStatus: match.student ? `Identified: ${match.student.name}` : 'Unregistered Individual',
          }));

          if (!match.isUnknown && match.student) {
            const obs = trackerRef.current.trackObservation(
              match.student.student_id,
              match.confidence,
              currentDateStr,
              selectedPeriodId
            );

            // Glowing bounding box
            ctx.save();
            ctx.lineWidth = 3;
            ctx.strokeStyle = obs.currentCount >= requiredFrames ? '#10b981' : '#3b82f6';
            ctx.shadowColor = obs.currentCount >= requiredFrames ? '#10b981' : '#3b82f6';
            ctx.shadowBlur = 8;
            ctx.strokeRect(boxX, boxY, boxW, boxH);
            ctx.shadowBlur = 0;

            // Identification banner
            const tagW = Math.max(180, Math.min(boxW + 20, 260));
            ctx.fillStyle = obs.currentCount >= requiredFrames ? '#10b981' : '#3b82f6';
            ctx.fillRect(boxX, boxY - 26, tagW, 24);

            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 12px sans-serif';
            ctx.fillText(
              `✓ ${match.student.name} (${Math.round(match.confidence * 100)}%)`,
              boxX + 8,
              boxY - 9
            );
            ctx.restore();

            if (obs.readyToMark) {
              const snapshot = hiddenCanvas.toDataURL('image/jpeg', 0.85);
              markAttendanceRecord(
                match.student.student_id,
                match.student.name,
                match.student.roll_number,
                match.student.class_name,
                match.student.section,
                match.confidence,
                snapshot
              );
            }
          } else {
            ctx.save();
            ctx.lineWidth = 2;
            ctx.strokeStyle = '#f59e0b';
            ctx.strokeRect(boxX, boxY, boxW, boxH);
            ctx.fillStyle = 'rgba(245, 158, 11, 0.9)';
            ctx.fillRect(boxX, boxY - 24, 180, 22);
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 11px sans-serif';
            ctx.fillText('Unregistered Face', boxX + 8, boxY - 8);
            ctx.restore();
          }
        } else {
          setTelemetry((prev) => ({
            ...prev,
            faceLocked: false,
            faceStatus: 'Position face in frame',
          }));

          ctx.save();
          ctx.lineWidth = 2;
          ctx.strokeStyle = 'rgba(148, 163, 184, 0.4)';
          ctx.setLineDash([6, 6]);
          ctx.strokeRect(boxX, boxY, boxW, boxH);
          ctx.restore();
        }
      }
    }

    animationLoopRef.current = requestAnimationFrame(processLiveFrame);
  }, [
    isCameraActive,
    registeredEmbeddings,
    strictMaxDistance,
    requiredFrames,
    currentDateStr,
    selectedPeriodId,
    soundEnabled,
  ]);

  useEffect(() => {
    if (isCameraActive) {
      animationLoopRef.current = requestAnimationFrame(processLiveFrame);
    }
    return () => {
      if (animationLoopRef.current) cancelAnimationFrame(animationLoopRef.current);
    };
  }, [isCameraActive, processLiveFrame]);

  const handleCaptureManualSnapshot = () => {
    const video = videoRef.current;
    if (!video || video.readyState < 2) {
      triggerFlash('Camera is not ready. Please verify webcam connection.', 'warn');
      return;
    }

    const vw = video.videoWidth || 640;
    const vh = video.videoHeight || 480;
    const box = currentBoxRef.current || {
      x: Math.round(vw * 0.2),
      y: Math.round(vh * 0.15),
      w: Math.round(vw * 0.6),
      h: Math.round(vh * 0.7),
    };

    const hiddenCanvas = hiddenCanvasRef.current || document.createElement('canvas');
    hiddenCanvas.width = box.w;
    hiddenCanvas.height = box.h;
    const ctx = hiddenCanvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    ctx.drawImage(video, box.x, box.y, box.w, box.h, 0, 0, box.w, box.h);
    const snapDataUrl = hiddenCanvas.toDataURL('image/jpeg', 0.9);

    const embedding = extractTFFaceEmbedding(hiddenCanvas);
    const match = matchFaceWithTensorFlow(embedding, registeredEmbeddings, strictMaxDistance);

    if (!match.isUnknown && match.student) {
      markAttendanceRecord(
        match.student.student_id,
        match.student.name,
        match.student.roll_number,
        match.student.class_name,
        match.student.section,
        match.confidence,
        snapDataUrl
      );
    } else {
      triggerFlash('No registered student recognized in frame.', 'warn');
    }
  };

  const handleExportSessionExcel = () => {
    if (sessionMarkedList.length === 0) return;
    const rows = sessionMarkedList.map((i, idx) => ({
      'S.No': idx + 1,
      Date: currentDateStr,
      Period: `Period ${selectedPeriodObj?.period_number || selectedPeriodId}`,
      'Roll Number': i.rollNumber,
      'Student Name': i.studentName,
      Class: i.className,
      Section: i.section,
      Status: i.status,
      'Verified Time': i.timeStr,
      'Match Score': `${Math.round(i.confidence * 100)}%`,
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, 'Session Attendance');
    XLSX.writeFile(wb, `Face_Attendance_P${selectedPeriodObj?.period_number || selectedPeriodId}_${currentDateStr}.xlsx`);
  };

  return (
    <div className="space-y-5">
      <canvas ref={hiddenCanvasRef} className="hidden" />

      {/* Top Toolbar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-600 text-white rounded-xl shadow-xs">
            <Camera className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900">Biometric Face Scanner</h1>
            <p className="text-xs text-slate-500">Live facial recognition &amp; period attendance verification</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Target Period Selector */}
          <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 text-xs">
            <Clock className="w-4 h-4 text-blue-600 shrink-0" />
            <span className="text-slate-500 font-medium">Period:</span>
            <select
              id="select-active-period"
              value={selectedPeriodId}
              onChange={(e) => {
                setSelectedPeriodId(Number(e.target.value));
                trackerRef.current.resetForPeriod();
              }}
              className="bg-white text-slate-900 font-semibold rounded px-2 py-1 border border-slate-300 focus:outline-none"
            >
              {periods.map((p) => (
                <option key={p.id} value={p.id}>
                  Period {p.period_number} ({p.start_time} - {p.end_time})
                </option>
              ))}
            </select>
          </div>

          {/* Sensitivity Presets */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-semibold">
            <button
              onClick={() => handleSetSensitivity('HIGH')}
              className={`px-2.5 py-1 rounded-lg transition ${
                sensitivityPreset === 'HIGH' ? 'bg-white text-blue-700 shadow-2xs' : 'text-slate-600'
              }`}
            >
              Strict
            </button>
            <button
              onClick={() => handleSetSensitivity('BALANCED')}
              className={`px-2.5 py-1 rounded-lg transition ${
                sensitivityPreset === 'BALANCED' ? 'bg-white text-blue-700 shadow-2xs' : 'text-slate-600'
              }`}
            >
              Balanced
            </button>
            <button
              onClick={() => handleSetSensitivity('FAST')}
              className={`px-2.5 py-1 rounded-lg transition ${
                sensitivityPreset === 'FAST' ? 'bg-white text-blue-700 shadow-2xs' : 'text-slate-600'
              }`}
            >
              Fast
            </button>
          </div>

          {/* Mirror & Sound Toggles */}
          <button
            onClick={() => setIsMirrored(!isMirrored)}
            className="p-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 transition"
            title="Toggle Camera Mirror"
          >
            <FlipHorizontal className="w-4 h-4" />
          </button>

          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`p-2 rounded-xl border transition ${
              soundEnabled ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-600 border-slate-200'
            }`}
            title="Toggle Audio Feedback"
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Flash Alert */}
      {recentFlashMessage && (
        <div
          className={`p-3 rounded-xl border text-xs font-semibold flex items-center justify-between shadow-2xs ${
            recentFlashMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-amber-50 border-amber-200 text-amber-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {recentFlashMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            )}
            <span>{recentFlashMessage.text}</span>
          </div>
          <button onClick={() => setRecentFlashMessage(null)} className="text-slate-400 hover:text-slate-600 text-xs">
            ✕
          </button>
        </div>
      )}

      {/* Main Scanner Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Live Camera Viewport (7 cols) */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="relative rounded-2xl overflow-hidden bg-slate-950 aspect-[4/3] flex items-center justify-center border-2 border-slate-800 shadow-md">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-full object-cover ${isMirrored ? 'scale-x-[-1]' : ''}`}
            />
            <canvas
              ref={canvasRef}
              className={`w-full h-full absolute inset-0 pointer-events-none ${isMirrored ? 'scale-x-[-1]' : ''}`}
            />

            {/* Status Header */}
            <div className="absolute top-3 left-3 bg-slate-900/80 backdrop-blur-xs px-2.5 py-1 rounded-lg border border-slate-700 text-[11px] flex items-center gap-2 text-white">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-emerald-300 font-mono font-semibold">AI ACTIVE • {telemetry.fps} FPS</span>
            </div>

            {/* Camera Error Message */}
            {cameraError && (
              <div className="absolute inset-0 bg-slate-950/95 flex flex-col items-center justify-center p-6 text-center text-white space-y-3 z-20">
                <AlertCircle className="w-8 h-8 text-rose-400" />
                <h3 className="font-bold text-sm">Camera Unavailable</h3>
                <p className="text-xs text-slate-300 max-w-sm">{cameraError}</p>
                <button
                  onClick={() => startCamera(selectedDeviceId)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition"
                >
                  Retry Camera
                </button>
              </div>
            )}

            {/* Bottom HUD */}
            <div className="absolute bottom-3 left-3 right-3 bg-slate-950/80 backdrop-blur-xs px-3.5 py-2 rounded-xl border border-slate-800 text-xs flex items-center justify-between text-white">
              <span className="text-slate-300 text-[11px] font-medium">
                {telemetry.faceStatus}
              </span>

              <button
                id="btn-manual-camera-snap"
                onClick={handleCaptureManualSnapshot}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs transition"
              >
                <Scan className="w-3.5 h-3.5" />
                <span>Snap &amp; Verify</span>
              </button>
            </div>
          </div>
        </div>

        {/* Live Session Feed (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <h3 className="font-bold text-xs text-slate-900">Session Attendance ({sessionMarkedList.length})</h3>
              </div>

              {sessionMarkedList.length > 0 && (
                <button
                  onClick={handleExportSessionExcel}
                  className="flex items-center gap-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold shadow-2xs transition"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>Excel</span>
                </button>
              )}
            </div>

            <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
              {sessionMarkedList.length > 0 ? (
                sessionMarkedList.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 rounded-xl border border-emerald-100 bg-emerald-50/40 flex items-center justify-between text-xs transition hover:bg-emerald-50/70"
                  >
                    <div className="flex items-center gap-2.5">
                      {item.snapshotUrl ? (
                        <img
                          src={item.snapshotUrl}
                          alt={item.studentName}
                          className="w-9 h-9 rounded-lg object-cover border border-emerald-200"
                        />
                      ) : (
                        <div className="w-9 h-9 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-xs">
                          {item.studentName.charAt(0)}
                        </div>
                      )}

                      <div>
                        <div className="font-bold text-slate-900">{item.studentName}</div>
                        <div className="text-[11px] text-slate-500 font-mono">
                          {item.rollNumber} • {item.timeStr}
                        </div>
                      </div>
                    </div>

                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold font-mono bg-emerald-100 text-emerald-800 border border-emerald-200">
                      PRESENT
                    </span>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center text-slate-400 text-xs">
                  <Camera className="w-6 h-6 mx-auto mb-2 text-slate-300" />
                  <p className="font-semibold text-slate-600">No students scanned yet this session.</p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Hold face in view of the camera to verify and mark attendance automatically.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

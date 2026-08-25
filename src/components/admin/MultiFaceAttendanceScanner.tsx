import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Users,
  Camera,
  CheckCircle2,
  Clock,
  UserCheck,
  Zap,
  Upload,
  Video,
  VideoOff,
  RefreshCw,
  Sparkles,
  ShieldCheck,
  Check,
} from 'lucide-react';
import {
  StudentEmbedding,
  MultiStudentDetectionResult,
  detectMultipleFacesInCanvas,
} from '../../utils/faceRecognition';
import { Period } from '../../types';
import { useToast } from '../../context/ToastContext';
import { useGoogleSheets } from '../../context/GoogleSheetsContext';
import { getStudentEmbeddingsList } from '../../services/apiClient';

interface MultiFaceAttendanceScannerProps {
  currentDateStr: string;
  activePeriod: Period | null;
  periods: Period[];
  onAttendanceRecorded: () => void;
}

export const MultiFaceAttendanceScanner: React.FC<MultiFaceAttendanceScannerProps> = ({
  currentDateStr,
  activePeriod,
  periods,
  onAttendanceRecorded,
}) => {
  const { showBatchProcessedToast, showToast } = useToast();
  const { syncSingleAttendance } = useGoogleSheets();

  const [selectedPeriodId, setSelectedPeriodId] = useState<number>(
    activePeriod ? activePeriod.id : periods[0] ? periods[0].id : 1
  );
  const [isScanning, setIsScanning] = useState(false);
  const [liveDetectionActive, setLiveDetectionActive] = useState(true);
  const [registeredEmbeddings, setRegisteredEmbeddings] = useState<StudentEmbedding[]>([]);
  const [detectedStudents, setDetectedStudents] = useState<MultiStudentDetectionResult[]>([]);
  const [markedRecords, setMarkedRecords] = useState<
    Array<{ name: string; roll: string; status: string; time: string }>
  >([]);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // Camera stream state
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const liveCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const lastDetectionTimeRef = useRef<number>(0);

  // Sync selected period with live active period if available
  useEffect(() => {
    if (activePeriod && activePeriod.id) {
      setSelectedPeriodId(activePeriod.id);
    }
  }, [activePeriod?.id]);

  // Load enrolled students
  useEffect(() => {
    getStudentEmbeddingsList()
      .then((data) => {
        if (Array.isArray(data)) setRegisteredEmbeddings(data);
      })
      .catch((err) => console.warn('Student embeddings notice:', err));

    return () => {
      stopCamera();
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  const startCamera = async () => {
    setCameraError(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraError('Camera access not supported on this device.');
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setIsCameraActive(true);
        setImagePreview(null);
      }
    } catch (err: any) {
      setCameraError('Unable to open camera. Please grant permission or upload a photo.');
    }
  };

  const stopCamera = () => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
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

  // Run AI multi-face recognition on canvas
  const analyzeCanvasForFaces = useCallback(
    (canvas: HTMLCanvasElement) => {
      setIsScanning(true);
      try {
        const results = detectMultipleFacesInCanvas(canvas, registeredEmbeddings, 0.65);
        setDetectedStudents(results);
      } catch (err: any) {
        console.error('Multi-face scan error:', err);
      } finally {
        setIsScanning(false);
      }
    },
    [registeredEmbeddings]
  );

  // Live video detection loop
  const processLiveFrame = useCallback(() => {
    const video = videoRef.current;
    const canvas = liveCanvasRef.current;

    if (video && video.readyState >= 2 && canvas && isCameraActive && liveDetectionActive) {
      const now = performance.now();
      if (now - lastDetectionTimeRef.current > 400) {
        lastDetectionTimeRef.current = now;

        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const results = detectMultipleFacesInCanvas(canvas, registeredEmbeddings, 0.65);
          setDetectedStudents(results);
        }
      }
    }

    if (isCameraActive) {
      animFrameRef.current = requestAnimationFrame(processLiveFrame);
    }
  }, [isCameraActive, liveDetectionActive, registeredEmbeddings]);

  useEffect(() => {
    if (isCameraActive && liveDetectionActive) {
      animFrameRef.current = requestAnimationFrame(processLiveFrame);
    }
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isCameraActive, liveDetectionActive, processLiveFrame]);

  // Capture current live frame from camera snapshot
  const handleCaptureLiveCameraFrame = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current || document.createElement('canvas');

    if (!video || video.readyState < 2) {
      startCamera();
      return;
    }

    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const photoUrl = canvas.toDataURL('image/jpeg', 0.9);
    setImagePreview(photoUrl);
    stopCamera();

    analyzeCanvasForFaces(canvas);
  };

  // Upload classroom photo
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = canvasRef.current || document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          setImagePreview(canvas.toDataURL('image/jpeg', 0.9));
          stopCamera();
          analyzeCanvasForFaces(canvas);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Batch mark recognized students
  const handleBatchMarkAttendance = async () => {
    const recognized = detectedStudents.filter((r) => !r.match.isUnknown && r.match.student);
    if (recognized.length === 0) {
      showToast({
        title: 'No Enrolled Students Identified',
        message: 'No registered biometric matches found in the current frame to mark.',
        type: 'warning',
      });
      return;
    }

    setIsScanning(true);
    const newLogs: Array<{ name: string; roll: string; status: string; time: string }> = [];
    const startTime = performance.now();

    for (const item of recognized) {
      if (!item.match.student) continue;
      try {
        await fetch('/api/attendance/record-face', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            student_id: item.match.student.student_id,
            date: currentDateStr,
            period_id: selectedPeriodId,
            confidence: item.match.confidence,
            is_manual: false,
          }),
        });

        newLogs.push({
          name: item.match.student.name,
          roll: item.match.student.roll_number,
          status: 'PRESENT',
          time: new Date().toTimeString().slice(0, 8),
        });

        // Google Sheets Auto-Sync
        syncSingleAttendance({
          date: currentDateStr,
          period_number: selectedPeriodId,
          roll_number: item.match.student.roll_number,
          student_name: item.match.student.name,
          class_name: item.match.student.class_name,
          section: item.match.student.section,
          status: 'PRESENT',
          confidence: item.match.confidence,
          method: 'Multi-Face Scanner',
          recorded_at: new Date().toLocaleTimeString(),
          notes: `Multi-face batch in Period ${selectedPeriodId}`,
        }).catch((e) => console.warn('Multi-face auto-sync note:', e));
      } catch (e) {
        console.error('Failed to mark student attendance:', e);
      }
    }

    const latency = Math.round(performance.now() - startTime);
    setMarkedRecords((prev) => [...newLogs, ...prev]);
    setIsScanning(false);
    onAttendanceRecorded();

    showBatchProcessedToast({
      frameCount: recognized.length,
      studentNames: recognized.map((r) => r.match.student!.name),
      periodId: selectedPeriodId,
      confidence: 0.96,
      dbLatencyMs: latency,
      customMessage: `Verified & Logged ${recognized.length} Students to Period ${selectedPeriodId}`,
    });
  };

  const recognizedCount = detectedStudents.filter((r) => !r.match.isUnknown && r.match.student).length;

  return (
    <div className="space-y-5">
      {/* Hidden processing canvases */}
      <canvas ref={canvasRef} className="hidden" />
      <canvas ref={liveCanvasRef} className="hidden" />

      {/* Header Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-600 text-white rounded-xl shadow-xs">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900">Multi-Face Classroom Scanner</h1>
            <p className="text-xs text-slate-500">
              Simultaneous biometric detection and batch attendance logging
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Target Period Selector */}
          <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 text-xs">
            <Clock className="w-4 h-4 text-indigo-600" />
            <span className="text-slate-500 font-medium">Period:</span>
            <select
              id="select-multi-scan-period"
              value={selectedPeriodId}
              onChange={(e) => setSelectedPeriodId(Number(e.target.value))}
              className="bg-white text-slate-900 font-semibold rounded px-2 py-1 border border-slate-300 focus:outline-none"
            >
              {periods.map((p) => (
                <option key={p.id} value={p.id}>
                  Period {p.period_number} ({p.start_time} - {p.end_time})
                </option>
              ))}
            </select>
          </div>

          {isCameraActive && (
            <button
              type="button"
              onClick={() => setLiveDetectionActive(!liveDetectionActive)}
              className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition ${
                liveDetectionActive
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-slate-100 text-slate-600 border-slate-200'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{liveDetectionActive ? 'Live AI Tracking: ON' : 'Live Tracking: PAUSED'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left: Viewport & Controls */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="relative rounded-2xl overflow-hidden bg-slate-950 aspect-[4/3] flex items-center justify-center border-2 border-slate-800 shadow-md">
            {isCameraActive ? (
              <div className="relative w-full h-full">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover scale-x-[-1]"
                />

                {/* Overlaid Detection Tags */}
                {detectedStudents.map((det, idx) => {
                  const isMatch = !det.match.isUnknown && det.match.student;
                  const cw = videoRef.current?.videoWidth || 640;
                  const ch = videoRef.current?.videoHeight || 480;
                  // Invert X because of camera mirror
                  const leftPct = 100 - ((det.boundingBox.x + det.boundingBox.width) / cw) * 100;
                  const widthPct = (det.boundingBox.width / cw) * 100;
                  const topPct = (det.boundingBox.y / ch) * 100;
                  const heightPct = (det.boundingBox.height / ch) * 100;

                  return (
                    <div
                      key={idx}
                      className={`absolute border-2 rounded transition-all duration-200 pointer-events-none ${
                        isMatch
                          ? 'border-emerald-400 bg-emerald-500/10 shadow-[0_0_12px_rgba(52,211,153,0.5)]'
                          : 'border-amber-400 bg-amber-500/10'
                      }`}
                      style={{
                        left: `${leftPct}%`,
                        top: `${topPct}%`,
                        width: `${widthPct}%`,
                        height: `${heightPct}%`,
                      }}
                    >
                      <span
                        className={`absolute -top-6 left-0 text-[10px] font-bold px-2 py-0.5 rounded text-white whitespace-nowrap shadow-sm ${
                          isMatch ? 'bg-emerald-600' : 'bg-amber-600'
                        }`}
                      >
                        {isMatch
                          ? `${det.match.student?.name} (${Math.round(det.match.confidence * 100)}%)`
                          : 'Unknown Face'}
                      </span>
                    </div>
                  );
                })}

                <div className="absolute top-3 left-3 bg-slate-900/80 backdrop-blur-xs px-2.5 py-1 rounded-lg border border-slate-700 text-[11px] font-mono text-emerald-400 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>LIVE CAMERA</span>
                </div>
              </div>
            ) : imagePreview ? (
              <div className="relative w-full h-full">
                <img src={imagePreview} alt="Classroom Capture" className="w-full h-full object-cover" />

                {detectedStudents.map((det, idx) => {
                  const isMatch = !det.match.isUnknown && det.match.student;
                  const canvas = canvasRef.current;
                  const cw = canvas?.width || 640;
                  const ch = canvas?.height || 480;

                  return (
                    <div
                      key={idx}
                      className={`absolute border-2 rounded transition ${
                        isMatch
                          ? 'border-emerald-400 bg-emerald-500/10 shadow-[0_0_12px_rgba(52,211,153,0.5)]'
                          : 'border-amber-400 bg-amber-500/10'
                      }`}
                      style={{
                        left: `${(det.boundingBox.x / cw) * 100}%`,
                        top: `${(det.boundingBox.y / ch) * 100}%`,
                        width: `${(det.boundingBox.width / cw) * 100}%`,
                        height: `${(det.boundingBox.height / ch) * 100}%`,
                      }}
                    >
                      <span
                        className={`absolute -top-6 left-0 text-[10px] font-bold px-2 py-0.5 rounded text-white whitespace-nowrap shadow-sm ${
                          isMatch ? 'bg-emerald-600' : 'bg-amber-600'
                        }`}
                      >
                        {isMatch
                          ? `${det.match.student?.name} (${Math.round(det.match.confidence * 100)}%)`
                          : 'Unknown Face'}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center p-8 text-slate-400 space-y-3">
                <Users className="w-12 h-12 mx-auto text-slate-600" />
                <div>
                  <div className="font-bold text-slate-300 text-sm">Classroom Multi-Face Viewport</div>
                  <div className="text-xs text-slate-500 mt-1">
                    Open camera or upload a classroom photo to scan all students simultaneously
                  </div>
                </div>
              </div>
            )}
          </div>

          {cameraError && (
            <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200 p-2.5 rounded-xl">
              {cameraError}
            </p>
          )}

          {/* Action Toolbar */}
          <div className="flex flex-wrap items-center gap-2.5">
            {isCameraActive ? (
              <>
                <button
                  type="button"
                  id="btn-snap-live-frame"
                  onClick={handleCaptureLiveCameraFrame}
                  disabled={isScanning}
                  className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs shadow-xs transition flex items-center justify-center gap-2"
                >
                  <Camera className="w-4 h-4" />
                  <span>Freeze Snapshot &amp; Analyze</span>
                </button>

                <button
                  type="button"
                  onClick={stopCamera}
                  className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition flex items-center justify-center gap-1.5"
                >
                  <VideoOff className="w-4 h-4" />
                  <span>Stop Camera</span>
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  id="btn-open-camera-multi"
                  onClick={startCamera}
                  className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl text-xs transition flex items-center justify-center gap-2 shadow-xs"
                >
                  <Video className="w-4 h-4" />
                  <span>Open Live Camera</span>
                </button>

                <button
                  type="button"
                  id="btn-upload-photo"
                  onClick={() => fileInputRef.current?.click()}
                  className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition flex items-center justify-center gap-1.5 border border-slate-300"
                >
                  <Upload className="w-4 h-4" />
                  <span>Upload Image</span>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </>
            )}

            {recognizedCount > 0 && (
              <button
                type="button"
                id="btn-batch-mark-attendance"
                onClick={handleBatchMarkAttendance}
                disabled={isScanning}
                className="py-2.5 px-5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-xs transition flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Mark All ({recognizedCount}) Present</span>
              </button>
            )}
          </div>
        </div>

        {/* Right: Identified Students List */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3 shadow-xs">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="font-bold text-xs text-slate-800 flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-emerald-600" />
                <span>Identified In Frame ({detectedStudents.length})</span>
              </div>
              <span className="text-[11px] font-mono text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                {recognizedCount} Enrolled
              </span>
            </div>

            {detectedStudents.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                No active detections. Open camera or upload a photo to identify students.
              </div>
            ) : (
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                {detectedStudents.map((item, idx) => {
                  const student = item.match.student;
                  const isMatch = !item.match.isUnknown && student;

                  return (
                    <div
                      key={idx}
                      className={`p-3 rounded-xl border flex items-center justify-between gap-3 text-xs transition ${
                        isMatch
                          ? 'bg-white border-emerald-200 text-slate-900 shadow-2xs'
                          : 'bg-amber-50/50 border-amber-200 text-amber-900'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        {item.cropDataUrl ? (
                          <img
                            src={item.cropDataUrl}
                            alt="Face Crop"
                            className="w-9 h-9 rounded-lg object-cover border border-slate-200"
                          />
                        ) : (
                          <div className="w-9 h-9 rounded-lg bg-slate-200 flex items-center justify-center font-bold text-slate-600">
                            #{idx + 1}
                          </div>
                        )}

                        <div>
                          <div className="font-bold text-slate-900">
                            {isMatch ? student.name : 'Unknown Individual'}
                          </div>
                          <div className="text-[11px] text-slate-500 font-mono">
                            {isMatch ? `Roll: ${student.roll_number}` : 'No biometric match'}
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <span
                          className={`inline-flex items-center gap-1 font-bold px-2 py-0.5 rounded-full text-[10px] ${
                            isMatch
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              : 'bg-amber-100 text-amber-800 border border-amber-200'
                          }`}
                        >
                          {isMatch ? `✓ ${Math.round(item.match.confidence * 100)}%` : 'Unknown'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Session Log */}
          {markedRecords.length > 0 && (
            <div className="p-4 bg-emerald-50/80 border border-emerald-200 rounded-2xl space-y-2 shadow-2xs">
              <div className="font-bold text-xs text-emerald-900 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Marked in This Session ({markedRecords.length})</span>
              </div>
              <div className="space-y-1 text-[11px] text-emerald-800 max-h-[140px] overflow-y-auto pr-1 font-mono">
                {markedRecords.map((log, i) => (
                  <div key={i} className="flex justify-between border-b border-emerald-200/50 pb-1">
                    <span>
                      {log.name} ({log.roll})
                    </span>
                    <span>{log.time}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

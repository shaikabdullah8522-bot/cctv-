import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Period, LiveRecognitionEvent, CameraFeed } from '../../types';
import {
  extractTFFaceEmbedding,
  matchFaceWithTensorFlow,
  ObservationTracker,
  StudentEmbedding,
} from '../../utils/faceRecognition';
import { detectMultipleFacesInCanvas } from '../../utils/aiFaceDetector';
import {
  Camera,
  Video,
  Play,
  Pause,
  Clock,
  Radio,
  Download,
  FileSpreadsheet,
  Eye,
  ShieldCheck,
  Zap,
  Sliders,
  AlertCircle,
  CheckCircle2,
  Maximize2,
  Grid,
  Square,
  Camera as CameraIcon,
  RefreshCw,
  Layers,
  Sparkles,
} from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { useGoogleSheets } from '../../context/GoogleSheetsContext';
import { getStudentEmbeddingsList } from '../../services/apiClient';

interface LiveCCTVProps {
  currentDateStr: string;
  activePeriod: Period | null;
  periods: Period[];
  onAttendanceRecorded: () => void;
}

export const LiveCCTV: React.FC<LiveCCTVProps> = ({
  currentDateStr,
  activePeriod,
  periods,
  onAttendanceRecorded,
}) => {
  const { showBatchProcessedToast, showToast } = useToast();
  const { syncSingleAttendance } = useGoogleSheets();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const lastScanTimeRef = useRef<number>(0);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [cameraMode, setCameraMode] = useState<'webcam' | 'rtsp' | 'multi_grid'>('webcam');
  const [activeCameraId, setActiveCameraId] = useState<string>('cam-1');
  const [viewLayout, setViewLayout] = useState<'single' | 'grid_2x2'>('single');
  const [isRunning, setIsRunning] = useState(true);
  const [rtspUrl, setRtspUrl] = useState('rtsp://admin:cctv_secure@192.168.1.120:554/live/ch0');
  const [confidenceThreshold, setConfidenceThreshold] = useState(0.65);
  const [requiredFrames, setRequiredFrames] = useState(3);
  const [selectedPeriodId, setSelectedPeriodId] = useState<number>(
    activePeriod ? activePeriod.id : (periods[0] ? periods[0].id : 1)
  );

  const [registeredEmbeddings, setRegisteredEmbeddings] = useState<StudentEmbedding[]>([]);
  const [liveDetections, setLiveDetections] = useState<LiveRecognitionEvent[]>([]);
  const [recentLogs, setRecentLogs] = useState<
    Array<{ id: string; time: string; text: string; type: 'success' | 'warn' | 'info'; confidence?: number }>
  >([]);
  const [stats, setStats] = useState({ totalFaces: 0, recognized: 0, unknown: 0, loggedToday: 0 });
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Multi-camera configured feeds
  const [cameras, setCameras] = useState<CameraFeed[]>([
    {
      id: 'cam-1',
      name: 'Camera 01 - Main Academic Gate',
      location: 'Block A Entrance Foyer',
      stream_url: 'rtsp://192.168.1.101:554/live/ch1',
      status: 'online',
      fps: 30,
      resolution: '1920x1080 (FHD)',
      total_detections_today: 48,
      last_ping: 'Live Now',
    },
    {
      id: 'cam-2',
      name: 'Camera 02 - Classroom North 302',
      location: 'BME Smart Classroom 302',
      stream_url: 'rtsp://192.168.1.102:554/live/ch2',
      status: 'online',
      fps: 28,
      resolution: '1920x1080 (FHD)',
      total_detections_today: 62,
      last_ping: 'Live Now',
    },
    {
      id: 'cam-3',
      name: 'Camera 03 - AI & Neural Signals Lab',
      location: 'Biomedical Core Lab Floor 2',
      stream_url: 'rtsp://192.168.1.103:554/live/ch3',
      status: 'online',
      fps: 30,
      resolution: '1920x1080 (FHD)',
      total_detections_today: 34,
      last_ping: 'Live Now',
    },
    {
      id: 'cam-4',
      name: 'Camera 04 - Central Library Concourse',
      location: 'Reading Hall Section B',
      stream_url: 'rtsp://192.168.1.104:554/live/ch4',
      status: 'online',
      fps: 25,
      resolution: '1280x720 (HD)',
      total_detections_today: 21,
      last_ping: 'Live Now',
    },
  ]);

  const trackerRef = useRef<ObservationTracker>(new ObservationTracker(3));

  // Sync selected period
  useEffect(() => {
    if (activePeriod && activePeriod.id) {
      setSelectedPeriodId(activePeriod.id);
    }
  }, [activePeriod?.id]);

  // Fetch registered student embeddings
  const fetchEmbeddings = async () => {
    try {
      const data = await getStudentEmbeddingsList();
      if (Array.isArray(data)) setRegisteredEmbeddings(data);
    } catch (err) {
      console.warn('Notice: Using cached face embeddings:', err);
    }
  };

  useEffect(() => {
    fetchEmbeddings();
  }, []);

  useEffect(() => {
    trackerRef.current.setRequiredFrames(requiredFrames);
  }, [requiredFrames]);

  const addLog = (text: string, type: 'success' | 'warn' | 'info' = 'info', confidence?: number) => {
    const timeStr = new Date().toTimeString().slice(0, 8);
    setRecentLogs((prev) => [
      { id: Date.now().toString() + Math.random(), time: timeStr, text, type, confidence },
      ...prev.slice(0, 35),
    ]);
  };

  const handleExportCurrentPeriodExcel = () => {
    window.location.href = `/api/export/excel/period?date=${currentDateStr}&period_id=${selectedPeriodId}`;
  };

  const handleExportCurrentPeriodCsv = () => {
    window.location.href = `/api/attendance/export-period-csv?date=${currentDateStr}&period_id=${selectedPeriodId}`;
  };

  // Snapshot Capture Feature
  const handleCaptureSnapshot = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const tempCanvas = document.createElement('canvas');
    const v = videoRef.current;
    tempCanvas.width = v.videoWidth || 640;
    tempCanvas.height = v.videoHeight || 480;
    const ctx = tempCanvas.getContext('2d');
    if (!ctx) return;

    // Draw frame
    ctx.drawImage(v, 0, 0, tempCanvas.width, tempCanvas.height);
    // Overlay timestamp & camera tag
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.fillRect(10, 10, 320, 45);
    ctx.fillStyle = '#10b981';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText(`CCTV SNAPSHOT • ${cameras.find((c) => c.id === activeCameraId)?.name || 'Camera 01'}`, 20, 28);
    ctx.fillStyle = '#ffffff';
    ctx.font = '10px monospace';
    ctx.fillText(`${new Date().toISOString()} • Period ${selectedPeriodId}`, 20, 44);

    const dataUrl = tempCanvas.toDataURL('image/jpeg', 0.95);
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `CCTV_Snapshot_${activeCameraId}_${Date.now()}.jpg`;
    link.click();

    addLog(`Snapshot image captured and saved from ${activeCameraId}`, 'info');
    showToast({
      title: 'Snapshot Captured',
      message: 'High-resolution CCTV security frame saved.',
      type: 'success',
    });
  };

  // Fullscreen Mode Toggle
  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch((e) => console.warn(e));
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch((e) => console.warn(e));
    }
  };

  const recordAttendanceToBackend = async (
    studentId: number,
    studentName: string,
    confidence: number
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
          camera_id: activeCameraId,
        }),
      });

      const latency = Math.round(performance.now() - startTime);

      if (res.ok) {
        const data = await res.json();
        addLog(
          `Verified & logged: ${studentName} (P${selectedPeriodId} - ${data.record?.final_result || 'PRESENT'})`,
          'success',
          confidence
        );
        setStats((prev) => ({ ...prev, loggedToday: prev.loggedToday + 1 }));
        onAttendanceRecorded();

        // Google Sheets Auto-Sync
        syncSingleAttendance({
          date: currentDateStr,
          period_number: selectedPeriodObj ? selectedPeriodObj.period_number : selectedPeriodId,
          period_timing: selectedPeriodObj ? `${selectedPeriodObj.start_time} - ${selectedPeriodObj.end_time}` : undefined,
          student_name: studentName,
          status: 'PRESENT',
          confidence,
          method: cameraMode === 'rtsp' ? 'CCTV RTSP Stream' : 'Live Camera Scanner',
          recorded_at: new Date().toLocaleTimeString(),
          notes: `Verified via CCTV in Period ${selectedPeriodId} (${activeCameraId})`,
        }).catch((e) => console.warn('CCTV auto-sync note:', e));

        showBatchProcessedToast({
          frameCount: requiredFrames,
          studentNames: studentName,
          periodId: selectedPeriodId,
          confidence,
          dbLatencyMs: latency,
        });
      }
    } catch (err) {
      console.error('Failed to record attendance to server:', err);
      showToast({
        title: 'Attendance Sync Error',
        message: `Failed to write attendance record for ${studentName}`,
        type: 'error',
      });
    }
  };

  // Start real webcam
  const startCamera = useCallback(async () => {
    setCameraError(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraError('Camera API not available. Please open in a modern browser.');
        return;
      }

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      addLog('Live camera hardware feed connected successfully.', 'success');
    } catch (err: any) {
      console.error('Webcam access error:', err);
      setCameraError('Camera access denied or unavailable. Connect webcam to start live recognition.');
      addLog(`Webcam notice: ${err.message}`, 'warn');
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  useEffect(() => {
    if (cameraMode === 'webcam') {
      startCamera();
    } else {
      stopCamera();
    }

    return () => {
      stopCamera();
    };
  }, [cameraMode, startCamera, stopCamera]);

  // Video frame real AI face recognition loop
  const processFrame = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas || !isRunning || video.readyState < 2) {
      animFrameRef.current = requestAnimationFrame(processFrame);
      return;
    }

    const w = video.videoWidth || 640;
    const h = video.videoHeight || 480;

    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      animFrameRef.current = requestAnimationFrame(processFrame);
      return;
    }

    ctx.clearRect(0, 0, w, h);

    const now = Date.now();
    // Scan every 350ms
    if (now - lastScanTimeRef.current >= 350) {
      lastScanTimeRef.current = now;

      // Detect multiple human faces in real frame
      const detections = detectMultipleFacesInCanvas(video);

      const events: LiveRecognitionEvent[] = [];
      let recCount = 0;
      let unkCount = 0;

      if (detections.length > 0) {
        detections.forEach((face) => {
          // Extract face sub-canvas
          const faceCanvas = document.createElement('canvas');
          faceCanvas.width = face.width;
          faceCanvas.height = face.height;
          const fCtx = faceCanvas.getContext('2d');
          if (fCtx) {
            fCtx.drawImage(video, face.x, face.y, face.width, face.height, 0, 0, face.width, face.height);

            const emb = extractTFFaceEmbedding(faceCanvas);
            const match = matchFaceWithTensorFlow(emb, registeredEmbeddings, 0.72);

            if (!match.isUnknown && match.student) {
              recCount++;
              const obs = trackerRef.current.trackObservation(
                match.student.student_id,
                match.confidence,
                currentDateStr,
                selectedPeriodId
              );

              const isConfirmed = obs.currentCount >= requiredFrames;

              // Draw bounding box
              ctx.strokeStyle = isConfirmed ? '#10b981' : '#3b82f6';
              ctx.lineWidth = 2.5;
              ctx.strokeRect(face.x, face.y, face.width, face.height);

              ctx.fillStyle = isConfirmed ? '#10b981' : '#3b82f6';
              ctx.fillRect(face.x, face.y - 24, Math.min(face.width, 180), 22);
              ctx.fillStyle = '#ffffff';
              ctx.font = 'bold 10.5px sans-serif';
              ctx.fillText(
                `${isConfirmed ? '✓' : '⟳'} ${match.student.name} (${Math.round(match.confidence * 100)}%)`,
                face.x + 4,
                face.y - 8
              );

              events.push({
                studentId: match.student.student_id,
                studentName: match.student.name,
                rollNumber: match.student.roll_number,
                status: 'PRESENT',
                confidence: match.confidence,
                consecutiveDetections: obs.currentCount,
                timestamp: new Date().toTimeString().slice(0, 8),
                boundingBox: face,
              });

              if (obs.readyToMark) {
                recordAttendanceToBackend(match.student.student_id, match.student.name, match.confidence);
              }
            } else {
              unkCount++;
              ctx.strokeStyle = 'rgba(239, 68, 68, 0.9)';
              ctx.lineWidth = 2;
              ctx.strokeRect(face.x, face.y, face.width, face.height);

              ctx.fillStyle = 'rgba(239, 68, 68, 0.9)';
              ctx.fillRect(face.x, face.y - 20, 110, 18);
              ctx.fillStyle = '#ffffff';
              ctx.font = 'bold 9.5px sans-serif';
              ctx.fillText('⚠️ UNKNOWN FACE', face.x + 4, face.y - 6);
            }

            setLiveDetections(events);
            setStats((prev) => ({
              ...prev,
              totalFaces: detections.length,
              recognized: recCount,
              unknown: unkCount,
            }));
          }
        });
      } else {
        setStats((prev) => ({ ...prev, totalFaces: 0, recognized: 0, unknown: 0 }));
      }
    }

    animFrameRef.current = requestAnimationFrame(processFrame);
  }, [isRunning, registeredEmbeddings, confidenceThreshold, selectedPeriodId, requiredFrames, currentDateStr, activeCameraId]);

  useEffect(() => {
    if (isRunning && cameraMode === 'webcam') {
      animFrameRef.current = requestAnimationFrame(processFrame);
    }
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isRunning, cameraMode, processFrame]);

  const selectedPeriodObj = periods.find((p) => p.id === selectedPeriodId) || activePeriod;
  const currentCamera = cameras.find((c) => c.id === activeCameraId) || cameras[0];

  return (
    <div ref={containerRef} className="space-y-6">
      {/* CCTV Stream Control Header */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="p-2.5 rounded-xl bg-blue-50 text-blue-600 border border-blue-100">
              <Camera className="w-5 h-5" />
            </span>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Live CCTV Automated Attendance Studio</h1>
              <p className="text-xs text-slate-500">
                Multi-camera IP stream surveillance, face detection HUD &amp; period verification
              </p>
            </div>
          </div>

          {/* Period Selector & Action */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 text-xs">
              <Clock className="w-4 h-4 text-emerald-600" />
              <span className="text-slate-500 font-medium">Target Period:</span>
              <select
                id="select-cctv-period"
                value={selectedPeriodId}
                onChange={(e) => {
                  setSelectedPeriodId(Number(e.target.value));
                  trackerRef.current.resetForPeriod();
                  addLog(`Switched target monitoring period to Period ${e.target.value}`, 'info');
                }}
                className="bg-white text-slate-900 font-semibold rounded px-2 py-1 border border-slate-300 focus:outline-none focus:border-blue-500"
              >
                {periods.map((p) => (
                  <option key={p.id} value={p.id}>
                    Period {p.period_number} ({p.start_time} - {p.end_time})
                  </option>
                ))}
              </select>
            </div>

            {/* Layout Toggle Button */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
              <button
                onClick={() => setViewLayout('single')}
                className={`p-1.5 rounded-lg transition ${
                  viewLayout === 'single' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                }`}
                title="Single Focus Camera"
              >
                <Square className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewLayout('grid_2x2')}
                className={`p-1.5 rounded-lg transition ${
                  viewLayout === 'grid_2x2' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                }`}
                title="2x2 Multi-Camera Matrix"
              >
                <Grid className="w-4 h-4" />
              </button>
            </div>

            {/* Snapshot Button */}
            <button
              id="btn-cctv-snapshot"
              onClick={handleCaptureSnapshot}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-semibold shadow-xs transition"
              title="Capture Frame Snapshot"
            >
              <CameraIcon className="w-3.5 h-3.5 text-blue-300" />
              <span>Snapshot</span>
            </button>

            {/* Fullscreen Button */}
            <button
              onClick={toggleFullscreen}
              className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition"
              title="Toggle Fullscreen"
            >
              <Maximize2 className="w-4 h-4" />
            </button>

            {/* Export Current Period Excel & CSV */}
            <button
              id="btn-export-cctv-period-excel"
              onClick={handleExportCurrentPeriodExcel}
              className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition"
              title="Download this period's attendance as formatted Excel spreadsheet"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Export (.xlsx)</span>
            </button>

            <button
              id="btn-toggle-stream"
              onClick={() => setIsRunning(!isRunning)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold shadow-xs transition ${
                isRunning
                  ? 'bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200'
                  : 'bg-slate-800 hover:bg-slate-900 text-white'
              }`}
            >
              {isRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              <span>{isRunning ? 'Pause' : 'Resume'}</span>
            </button>
          </div>
        </div>

        {/* Camera Selector Tabs Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-4 border-t border-slate-100">
          {cameras.map((cam) => {
            const isSelected = activeCameraId === cam.id;
            return (
              <button
                key={cam.id}
                type="button"
                onClick={() => {
                  setActiveCameraId(cam.id);
                  addLog(`Switched surveillance focus to ${cam.name}`, 'info');
                }}
                className={`p-3 rounded-xl border text-left transition relative overflow-hidden ${
                  isSelected
                    ? 'bg-blue-50/80 border-blue-500 shadow-sm ring-1 ring-blue-500/20'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-xs text-slate-900 truncate">{cam.name.split('-')[1] || cam.name}</span>
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                </div>
                <div className="text-[10px] text-slate-500 truncate">{cam.location}</div>
                <div className="text-[9px] font-mono text-emerald-600 mt-1 flex items-center justify-between">
                  <span>{cam.fps} FPS • {cam.resolution.split(' ')[0]}</span>
                  <span>{cam.total_detections_today} logs</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main CCTV Feed Viewport & Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
          {viewLayout === 'single' ? (
            /* Single Camera Viewport */
            <div className="relative rounded-2xl overflow-hidden bg-slate-950 aspect-[4/3] flex items-center justify-center border-4 border-slate-800 shadow-xl">
              {/* Live Video */}
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover scale-x-[-1]"
              />

              {/* Canvas HUD */}
              <canvas
                ref={canvasRef}
                className="w-full h-full absolute inset-0 pointer-events-none scale-x-[-1]"
              />

              {/* Top HUD Tag */}
              <div className="absolute top-4 left-4 right-4 flex items-center justify-between pointer-events-none">
                <div className="bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-700 text-[11px] flex items-center gap-2 text-white">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                  <span className="text-emerald-300 font-semibold font-mono">
                    {currentCamera.name} ({currentCamera.fps} FPS)
                  </span>
                </div>
                <div className="bg-slate-950/80 backdrop-blur-md px-2.5 py-1 rounded text-[10px] font-mono text-slate-300 border border-slate-800">
                  {currentDateStr} • PERIOD {selectedPeriodObj?.period_number || selectedPeriodId}
                </div>
              </div>

              {/* Error Overlay */}
              {cameraError && (
                <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center p-6 text-center text-white space-y-3">
                  <AlertCircle className="w-8 h-8 text-amber-400" />
                  <p className="text-sm font-semibold">{cameraError}</p>
                  <button
                    onClick={startCamera}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition"
                  >
                    Retry Camera Connection
                  </button>
                </div>
              )}

              {/* Bottom HUD Bar */}
              <div className="absolute bottom-4 left-4 right-4 bg-slate-950/90 backdrop-blur-md px-4 py-2.5 rounded-xl border border-slate-800 text-xs flex items-center justify-between text-white">
                <div className="flex items-center gap-4 text-[11px]">
                  <span className="text-slate-400">
                    Enrolled Biometrics: <strong className="text-white font-mono">{registeredEmbeddings.length}</strong>
                  </span>
                  <span className="text-emerald-400">
                    In Frame: <strong className="font-mono">{stats.totalFaces}</strong>
                  </span>
                  <span className="text-blue-400">
                    Recognized: <strong className="font-mono">{stats.recognized}</strong>
                  </span>
                  <span className="text-rose-400">
                    Unknown: <strong className="font-mono">{stats.unknown}</strong>
                  </span>
                </div>

                <div className="text-[10px] font-mono text-slate-400">
                  Buffer: {requiredFrames} frames (2.0s)
                </div>
              </div>
            </div>
          ) : (
            /* 2x2 Multi-Camera Matrix View */
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 aspect-[4/3] bg-slate-950 p-3 rounded-2xl border-4 border-slate-800 shadow-xl overflow-hidden">
              {cameras.map((c, idx) => (
                <div
                  key={c.id}
                  onClick={() => {
                    setActiveCameraId(c.id);
                    setViewLayout('single');
                  }}
                  className="relative rounded-xl overflow-hidden bg-slate-900 border border-slate-800 hover:border-blue-500 cursor-pointer transition flex items-center justify-center text-white"
                >
                  {idx === 0 ? (
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover scale-x-[-1]"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center bg-slate-950">
                      <Camera className="w-8 h-8 text-slate-700 mb-2" />
                      <span className="text-xs font-bold text-slate-400">{c.name}</span>
                      <span className="text-[10px] text-emerald-400 font-mono mt-1">● STREAM ACTIVE</span>
                    </div>
                  )}

                  <div className="absolute top-2 left-2 bg-black/70 px-2 py-0.5 rounded text-[9px] font-mono text-emerald-300">
                    CAM {idx + 1} • {c.location}
                  </div>
                  <div className="absolute bottom-2 right-2 bg-black/70 px-2 py-0.5 rounded text-[9px] font-mono text-slate-300">
                    {c.fps} FPS
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Active Stream Diagnostics Bar */}
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-700">Surveillance Node:</span>
              <span className="font-mono text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">
                {currentCamera.location}
              </span>
            </div>
            <div className="flex items-center gap-4 text-slate-600 text-[11px] font-mono">
              <span>Status: <strong className="text-emerald-600">Active</strong></span>
              <span>Bitrate: <strong>4.2 Mbps</strong></span>
              <span>Algorithm: <strong>128-d FaceNet &amp; Temporal Buffer</strong></span>
            </div>
          </div>
        </div>

        {/* Live Attendance Logs & Status */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <h3 className="font-bold text-sm text-slate-900">Live Recognition Feed</h3>
              </div>
              <span className="text-xs font-mono font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                P{selectedPeriodObj ? selectedPeriodObj.period_number : selectedPeriodId}
              </span>
            </div>

            <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1 text-xs">
              {recentLogs.length > 0 ? (
                recentLogs.map((log) => (
                  <div
                    key={log.id}
                    className={`p-2.5 rounded-xl border flex items-start gap-2 ${
                      log.type === 'success'
                        ? 'bg-emerald-50/70 border-emerald-200 text-emerald-800'
                        : log.type === 'warn'
                        ? 'bg-amber-50/70 border-amber-200 text-amber-800'
                        : 'bg-slate-50 border-slate-200 text-slate-700'
                    }`}
                  >
                    {log.type === 'success' ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                    ) : (
                      <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[10px] text-slate-400">{log.time}</span>
                        {log.confidence && (
                          <span className="text-[10px] font-mono font-bold text-emerald-700">
                            {Math.round(log.confidence * 100)}% Conf
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5">{log.text}</div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center text-slate-400 space-y-2">
                  <Camera className="w-8 h-8 mx-auto text-slate-300" />
                  <p>Awaiting live biometric face detection...</p>
                  <p className="text-[11px] text-slate-400">Faces detected in the CCTV viewport will be verified in real time.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

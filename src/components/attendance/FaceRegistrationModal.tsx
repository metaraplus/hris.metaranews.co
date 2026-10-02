import React, { useRef, useState, useEffect } from 'react';
import {
  Camera,
  X,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Sparkles,
  ShieldCheck,
} from 'lucide-react';
import {
  analyzeFaceInVideo,
  captureSelfiePhoto,
  extractFaceDescriptor,
} from '../../utils/faceRecognition';
import { Employee } from '../../types';

interface FaceRegistrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetEmployee: Employee | null;
  onSaveFace: (photoUrl: string, descriptor: string) => Promise<void>;
}

export const FaceRegistrationModal: React.FC<FaceRegistrationModalProps> = ({
  isOpen,
  onClose,
  targetEmployee,
  onSaveFace,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [capturedDescriptor, setCapturedDescriptor] = useState<number[]>([]);
  const [faceDetected, setFaceDetected] = useState(false);
  const [detectionMessage, setDetectionMessage] = useState('Mengaktifkan kamera biometrik...');
  const [saving, setSaving] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Start Camera
  const startCamera = async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setCameraActive(true);
    } catch (err: any) {
      console.error('Camera access error:', err);
      setCameraError(
        'Gagal mengakses kamera. Pastikan izin kamera telah diberikan pada browser Anda.'
      );
      setCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  useEffect(() => {
    if (isOpen) {
      setCapturedPhoto(null);
      setCapturedDescriptor([]);
      startCamera();
    } else {
      stopCamera();
    }

    return () => {
      stopCamera();
    };
  }, [isOpen]);

  // Face Detection Loop
  useEffect(() => {
    let animId: number;
    let prevFrameData: Uint8ClampedArray | null = null;

    const checkFace = () => {
      if (videoRef.current && cameraActive && !capturedPhoto) {
        const { status, currentFrameData } = analyzeFaceInVideo(
          videoRef.current,
          prevFrameData
        );
        prevFrameData = currentFrameData;
        setFaceDetected(status.hasFace);
        setDetectionMessage(status.message);
      }
      animId = requestAnimationFrame(checkFace);
    };

    if (cameraActive && !capturedPhoto) {
      animId = requestAnimationFrame(checkFace);
    }

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [cameraActive, capturedPhoto]);

  // Capture face
  const handleCapture = () => {
    if (!videoRef.current) return;
    const photo = captureSelfiePhoto(videoRef.current);
    if (!photo) return;

    // Extract biometric descriptor from current video frame
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = 320;
    tempCanvas.height = 240;
    const ctx = tempCanvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0, 320, 240);
      const desc = extractFaceDescriptor(tempCanvas);
      setCapturedDescriptor(desc);
    }

    setCapturedPhoto(photo);
    stopCamera();
  };

  const handleRetake = () => {
    setCapturedPhoto(null);
    setCapturedDescriptor([]);
    startCamera();
  };

  const handleConfirmSave = async () => {
    if (!capturedPhoto) return;
    setSaving(true);
    try {
      await onSaveFace(capturedPhoto, JSON.stringify(capturedDescriptor));
      onClose();
    } catch (err) {
      console.error('Save face failed:', err);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-base">Registrasi Wajah Biometrik</h3>
              <p className="text-xs text-slate-500">
                Untuk: <span className="font-semibold text-slate-700">{targetEmployee?.name}</span> ({targetEmployee?.employeeNumber})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6">
          {cameraError ? (
            <div className="text-center py-8">
              <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-3" />
              <p className="text-sm font-semibold text-slate-800 mb-2">{cameraError}</p>
              <button
                onClick={startCamera}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700"
              >
                Coba Akses Kamera Lagi
              </button>
            </div>
          ) : capturedPhoto ? (
            /* Review Captured Selfie */
            <div className="flex flex-col items-center">
              <div className="relative w-64 h-64 rounded-2xl overflow-hidden border-4 border-emerald-500 shadow-md">
                <img
                  src={capturedPhoto}
                  alt="Captured face"
                  className="w-full h-full object-cover"
                />
                <div className="absolute bottom-2 inset-x-2 bg-emerald-600/90 text-white text-xs py-1 rounded-lg font-semibold text-center backdrop-blur-xs flex items-center justify-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Sampel Wajah Siap Digunakan</span>
                </div>
              </div>

              <p className="text-xs text-slate-500 text-center mt-3 max-w-xs">
                Foto ini akan disimpan sebagai template biometric referensi untuk verifikasi presensi harian secara aman.
              </p>

              <div className="flex items-center gap-3 mt-6 w-full">
                <button
                  onClick={handleRetake}
                  disabled={saving}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border border-slate-300 text-slate-700 text-sm font-semibold hover:bg-slate-50 transition-all"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Foto Ulang</span>
                </button>
                <button
                  onClick={handleConfirmSave}
                  disabled={saving}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-all shadow-md shadow-blue-500/20"
                >
                  {saving ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                  <span>{saving ? 'Menyimpan...' : 'Simpan Profil'}</span>
                </button>
              </div>
            </div>
          ) : (
            /* Live Camera HUD */
            <div className="flex flex-col items-center">
              <div className="relative w-72 h-72 sm:w-80 sm:h-80 rounded-2xl overflow-hidden bg-slate-950 flex items-center justify-center shadow-inner">
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  className="w-full h-full object-cover scale-x-[-1]"
                />

                {/* Biometric Target Overlay */}
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  {/* Oval target boundary */}
                  <div
                    className={`w-44 h-56 rounded-[50%] border-2 transition-all duration-300 ${
                      faceDetected
                        ? 'border-emerald-400 ring-4 ring-emerald-500/20'
                        : 'border-blue-400/80 border-dashed animate-pulse'
                    }`}
                  />

                  {/* Corner Guides */}
                  <div className="absolute inset-8 border border-white/20 rounded-xl" />

                  {/* Scanning beam effect when face detected */}
                  {faceDetected && (
                    <div className="absolute inset-x-8 top-1/4 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent animate-bounce opacity-70" />
                  )}
                </div>

                {/* Status Badge */}
                <div className="absolute bottom-3 inset-x-3 text-center">
                  <div
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium backdrop-blur-md shadow-xs ${
                      faceDetected
                        ? 'bg-emerald-500/90 text-white'
                        : 'bg-slate-900/80 text-slate-200'
                    }`}
                  >
                    {faceDetected ? (
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    ) : (
                      <Camera className="w-3.5 h-3.5 text-blue-400 animate-pulse" />
                    )}
                    <span>{detectionMessage}</span>
                  </div>
                </div>
              </div>

              {/* Instructions */}
              <div className="mt-4 text-center">
                <p className="text-xs text-slate-500">
                  Pastikan pencahayaan cukup terang dan hadapkan wajah lurus ke arah kamera.
                </p>
              </div>

              {/* Capture Button */}
              <div className="mt-5 w-full flex justify-center">
                <button
                  onClick={handleCapture}
                  className="flex items-center justify-center gap-2 py-3 px-8 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-all shadow-md shadow-blue-500/25 active:scale-95"
                >
                  <Camera className="w-5 h-5" />
                  <span>Ambil Foto Wajah</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

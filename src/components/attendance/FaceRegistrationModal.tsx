import React, { useRef, useState, useEffect } from 'react';
import {
  Camera,
  X,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Sparkles,
  ShieldCheck,
  Smartphone,
  Upload,
} from 'lucide-react';
import {
  analyzeFaceInVideo,
  captureSelfiePhoto,
  extractFaceDescriptor,
  drawProportionalCover,
  cropImageToSquare,
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
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [cameraActive, setCameraActive] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [capturedDescriptor, setCapturedDescriptor] = useState<number[]>([]);
  const [faceDetected, setFaceDetected] = useState(false);
  const [detectionMessage, setDetectionMessage] = useState('Mengaktifkan kamera biometrik...');
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Start Camera with iOS Safari & Android support
  const startCamera = async () => {
    setCameraError(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Browser ini tidak mendukung streaming kamera langsung.');
      }

      // Stop any existing tracks first to avoid device lock on mobile
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
        audio: false,
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.muted = true;
        videoRef.current.setAttribute('playsinline', 'true');
        videoRef.current.setAttribute('webkit-playsinline', 'true');
        try {
          await videoRef.current.play();
        } catch (playErr) {
          console.warn('Video play delay on mobile:', playErr);
        }
      }
      setCameraActive(true);
    } catch (err: any) {
      console.error('Camera access error:', err);
      setCameraError(
        'Kamera langsung terkendala pada perangkat ini. Anda dapat mencoba lagi atau gunakan tombol kamera ponsel di bawah.'
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
      setSaveSuccess(false);
      setSaveError(null);
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

  // Capture face via live video
  const handleCapture = () => {
    if (!videoRef.current) return;
    const photo = captureSelfiePhoto(videoRef.current);
    if (!photo) return;

    // Extract biometric descriptor from current video frame using proportional 320x320 crop
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = 320;
    tempCanvas.height = 320;
    const ctx = tempCanvas.getContext('2d');
    if (ctx) {
      drawProportionalCover(videoRef.current, ctx, 320, 320, true);
      const desc = extractFaceDescriptor(tempCanvas);
      setCapturedDescriptor(desc);
    }

    setCapturedPhoto(photo);
    stopCamera();
  };

  // Fallback: capture or select photo using native mobile camera
  const handleFileCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      const img = new Image();
      img.onload = () => {
        // Crop photo to 360x360 square without stretching or squashing
        const { dataUrl: compressedPhoto, canvas } = cropImageToSquare(img, 360, 0.85);
        const desc = extractFaceDescriptor(canvas);
        setCapturedPhoto(compressedPhoto);
        setCapturedDescriptor(desc);
        stopCamera();
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  const handleRetake = () => {
    setCapturedPhoto(null);
    setCapturedDescriptor([]);
    startCamera();
  };

  const handleConfirmSave = async () => {
    if (!capturedPhoto) return;
    setSaving(true);
    setSaveError(null);
    try {
      await onSaveFace(capturedPhoto, JSON.stringify(capturedDescriptor));
      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
        onClose();
      }, 1200);
    } catch (err: any) {
      console.error('Save face failed:', err);
      setSaveError(
        err.message || 'Gagal menyimpan data biometrik ke database. Pastikan koneksi internet stabil.'
      );
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/80 backdrop-blur-xs overflow-y-auto">
      {/* Hidden file input for native camera fallback */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="user"
        onChange={handleFileCapture}
        className="hidden"
      />

      <div className="bg-white rounded-2xl max-w-lg w-full max-h-[92vh] overflow-y-auto shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-200 my-auto">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50/70 sticky top-0 z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-red-100 text-red-600 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-sm sm:text-base">
                Registrasi Wajah Biometrik
              </h3>
              <p className="text-xs text-slate-500">
                Karyawan: <span className="font-semibold text-slate-700">{targetEmployee?.name}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer touch-manipulation"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6">
          {cameraError ? (
            <div className="text-center py-6">
              <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-3" />
              <p className="text-xs sm:text-sm font-semibold text-slate-800 mb-2">
                {cameraError}
              </p>
              <div className="flex flex-col sm:flex-row gap-2.5 justify-center mt-5">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2.5 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 shadow-md shadow-red-500/20 cursor-pointer touch-manipulation"
                >
                  <Smartphone className="w-4 h-4" />
                  <span>Gunakan Kamera Ponsel</span>
                </button>
                <button
                  type="button"
                  onClick={startCamera}
                  className="px-4 py-2.5 border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-1.5 cursor-pointer touch-manipulation"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Coba Akses Lagi</span>
                </button>
              </div>
            </div>
          ) : capturedPhoto ? (
            /* Review Captured Selfie */
            <div className="flex flex-col items-center">
              <div className="relative w-56 h-56 sm:w-64 sm:h-64 rounded-2xl overflow-hidden border-4 border-emerald-500 shadow-md">
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

              {saveError && (
                <div className="w-full mt-3 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs text-center flex items-center justify-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500" />
                  <span>{saveError}</span>
                </div>
              )}

              {saveSuccess && (
                <div className="w-full mt-3 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs text-center font-bold flex items-center justify-center gap-2 animate-in fade-in">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                  <span>Profil Wajah Berhasil Disimpan ke Database!</span>
                </div>
              )}

              <div className="flex items-center gap-3 mt-5 w-full">
                <button
                  type="button"
                  onClick={handleRetake}
                  disabled={saving || saveSuccess}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border border-slate-300 text-slate-700 text-xs sm:text-sm font-semibold hover:bg-slate-50 transition-all cursor-pointer touch-manipulation disabled:opacity-50"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Foto Ulang</span>
                </button>
                <button
                  type="button"
                  onClick={handleConfirmSave}
                  disabled={saving || saveSuccess}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl ${
                    saveSuccess
                      ? 'bg-emerald-600 text-white'
                      : 'bg-red-600 hover:bg-red-700 active:bg-red-800 text-white'
                  } text-xs sm:text-sm font-semibold transition-all shadow-md shadow-red-500/20 cursor-pointer touch-manipulation disabled:opacity-50`}
                >
                  {saving ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : saveSuccess ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                  <span>
                    {saving
                      ? 'Menyimpan...'
                      : saveSuccess
                      ? 'Tersimpan!'
                      : 'Simpan Profil'}
                  </span>
                </button>
              </div>
            </div>
          ) : (
            /* Live Camera HUD */
            <div className="flex flex-col items-center">
              <div className="relative w-64 h-64 sm:w-80 sm:h-80 rounded-2xl overflow-hidden bg-slate-950 flex items-center justify-center shadow-inner">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover scale-x-[-1]"
                />

                {/* Biometric Target Overlay */}
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <div
                    className={`w-40 h-52 sm:w-44 sm:h-56 rounded-[50%] border-2 transition-all duration-300 ${
                      faceDetected
                        ? 'border-emerald-400 ring-4 ring-emerald-500/20'
                        : 'border-red-400/80 border-dashed animate-pulse'
                    }`}
                  />
                  <div className="absolute inset-6 border border-white/20 rounded-xl" />
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
                      <Camera className="w-3.5 h-3.5 text-red-400 animate-pulse" />
                    )}
                    <span>{detectionMessage}</span>
                  </div>
                </div>
              </div>

              {/* Instructions */}
              <div className="mt-3 text-center">
                <p className="text-xs text-slate-500">
                  Posisikan wajah lurus ke arah kamera dengan pencahayaan yang cukup.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="mt-4 w-full flex flex-col sm:flex-row gap-2.5 justify-center">
                <button
                  type="button"
                  onClick={handleCapture}
                  className="flex-1 flex items-center justify-center gap-2 py-3 px-6 rounded-xl bg-red-600 hover:bg-red-700 active:bg-red-800 text-white text-xs sm:text-sm font-semibold transition-all shadow-md shadow-red-500/20 active:scale-95 cursor-pointer touch-manipulation"
                >
                  <Camera className="w-4 h-4" />
                  <span>Ambil Foto Wajah</span>
                </button>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold cursor-pointer touch-manipulation"
                >
                  <Smartphone className="w-4 h-4 text-slate-500" />
                  <span>Kamera Bawaan Ponsel</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

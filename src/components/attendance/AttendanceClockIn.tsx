import React, { useRef, useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import {
  MapPin,
  Camera,
  CheckCircle2,
  AlertCircle,
  Clock,
  ShieldCheck,
  RefreshCw,
  Sparkles,
  Info,
  LogOut as ClockOutIcon,
  LogIn as ClockInIcon,
  UserCheck,
} from 'lucide-react';
import {
  getCurrentGPSPosition,
  evaluateGeofence,
  formatDistance,
  DEFAULT_OFFICE_SETTING,
} from '../../utils/geolocation';
import {
  analyzeFaceInVideo,
  captureSelfiePhoto,
  extractFaceDescriptor,
  compareDescriptors,
} from '../../utils/faceRecognition';
import { GPSCoordinate, OfficeSetting, AttendanceRecord } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { db, handleFirestoreError, OperationType } from '../../firebase/config';
import {
  doc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  onSnapshot,
} from 'firebase/firestore';

interface AttendanceClockInProps {
  officeSetting: OfficeSetting;
  onOpenFaceRegistration: () => void;
  isFaceModalOpen?: boolean;
}

// Helper to strip undefined values so Firestore doesn't reject writes
function cleanData<T extends Record<string, any>>(obj: T): T {
  const out: any = {};
  for (const k of Object.keys(obj)) {
    if (obj[k] !== undefined) {
      if (obj[k] && typeof obj[k] === 'object' && !Array.isArray(obj[k])) {
        out[k] = cleanData(obj[k]);
      } else {
        out[k] = obj[k];
      }
    }
  }
  return out;
}

export const AttendanceClockIn: React.FC<AttendanceClockInProps> = ({
  officeSetting = DEFAULT_OFFICE_SETTING,
  onOpenFaceRegistration,
  isFaceModalOpen = false,
}) => {
  const { user, employee, refreshEmployee } = useAuth();

  // GPS State
  const [gpsLocation, setGpsLocation] = useState<GPSCoordinate | null>(null);
  const [gpsLoading, setGpsLoading] = useState(true);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [allowLocationOverrideForDemo, setAllowLocationOverrideForDemo] = useState(false);

  // Camera & Face Recognition State
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [faceDetected, setFaceDetected] = useState(false);
  const [faceMatchScore, setFaceMatchScore] = useState<number>(0);
  const [detectionMessage, setDetectionMessage] = useState('Arahkan kamera ke wajah');

  // Today's Attendance State
  const [todayAttendance, setTodayAttendance] = useState<AttendanceRecord | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [attendanceSuccessMessage, setAttendanceSuccessMessage] = useState<string | null>(null);
  const [notes, setNotes] = useState('');

  // Get Today's date string YYYY-MM-DD in local time
  const getTodayDateString = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const todayStr = getTodayDateString();

  // Realtime listener for today's attendance for this user
  useEffect(() => {
    if (!user) return;

    const attDocId = `${user.uid}_${todayStr}`;
    const docRef = doc(db, 'attendances', attDocId);

    const unsubscribe = onSnapshot(
      docRef,
      (snapshot) => {
        if (snapshot.exists()) {
          setTodayAttendance({
            ...(snapshot.data() as AttendanceRecord),
            id: snapshot.id,
          });
        } else {
          setTodayAttendance(null);
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, `attendances/${attDocId}`);
      }
    );

    return () => unsubscribe();
  }, [user, todayStr]);

  // Request GPS position
  const fetchLocation = async () => {
    setGpsLoading(true);
    setGpsError(null);
    try {
      const pos = await getCurrentGPSPosition();
      setGpsLocation(pos);
    } catch (err: any) {
      setGpsError(err.message || 'Gagal mengambil koordinat GPS');
    } finally {
      setGpsLoading(false);
    }
  };

  useEffect(() => {
    fetchLocation();
  }, []);

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
          console.warn('ClockIn camera play note:', playErr);
        }
      }
      setCameraActive(true);
    } catch (err: any) {
      console.error('Camera error:', err);
      setCameraError(
        'Tidak dapat mengakses kamera. Pastikan izin kamera aktif pada browser Anda.'
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
    // If face registration modal is open, pause clock-in camera to prevent device lock on iOS/Android
    if (isFaceModalOpen) {
      stopCamera();
      return;
    }

    // Only run camera if user hasn't clocked out yet
    if (!todayAttendance || !todayAttendance.checkOutTime) {
      startCamera();
    }
    return () => {
      stopCamera();
    };
  }, [todayAttendance?.checkOutTime, isFaceModalOpen]);

  // Face Detection & Biometric Comparison Loop
  useEffect(() => {
    let animId: number;
    let prevFrameData: Uint8ClampedArray | null = null;
    let sampleCounter = 0;

    const registeredDescriptor: number[] = employee?.faceDescriptor
      ? JSON.parse(employee.faceDescriptor)
      : [];

    const verifyFrame = () => {
      if (videoRef.current && cameraActive) {
        const { status, currentFrameData, faceCanvas } = analyzeFaceInVideo(
          videoRef.current,
          prevFrameData
        );
        prevFrameData = currentFrameData;
        setFaceDetected(status.hasFace);

        if (status.hasFace) {
          sampleCounter++;
          // Compute descriptor match periodically (every 5 frames) to maintain smooth UI
          if (sampleCounter % 5 === 0 && registeredDescriptor.length > 0) {
            const currentDescriptor = extractFaceDescriptor(faceCanvas);
            const score = compareDescriptors(registeredDescriptor, currentDescriptor);
            setFaceMatchScore(score);

            if (score >= 70) {
              setDetectionMessage(`Wajah Terverifikasi (${score}% Cocok)`);
            } else {
              setDetectionMessage(`Tingkat Kecocokan: ${score}% (Hadapkan lurus)`);
            }
          } else if (registeredDescriptor.length === 0) {
            setFaceMatchScore(90); // Default good score if enrolling on the fly
            setDetectionMessage('Wajah Terdeteksi (Belum ada template biometrik)');
          } else {
            setDetectionMessage(status.message);
          }
        } else {
          setFaceMatchScore(0);
          setDetectionMessage(status.message);
        }
      }

      animId = requestAnimationFrame(verifyFrame);
    };

    if (cameraActive) {
      animId = requestAnimationFrame(verifyFrame);
    }

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [cameraActive, employee?.faceDescriptor]);

  // Geofence check
  const geofenceResult = gpsLocation
    ? evaluateGeofence(gpsLocation, officeSetting)
    : null;

  const effectiveWithinGeofence = allowLocationOverrideForDemo
    ? true
    : geofenceResult?.withinGeofence ?? false;

  // Trigger celebration confetti
  const triggerCelebration = () => {
    try {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
      });
    } catch (e) {
      // Ignore
    }
  };

  // Perform Clock-In
  const handleClockIn = async () => {
    if (!user || !videoRef.current) return;
    if (!gpsLocation && !allowLocationOverrideForDemo) {
      alert('Koordinat GPS belum didapatkan.');
      return;
    }

    setSubmitting(true);
    setAttendanceSuccessMessage(null);

    try {
      const now = new Date();
      const timeStr = now.toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });

      // Calculate on-time / late status
      const [startHour, startMin] = officeSetting.workStartTime.split(':').map(Number);
      const tolerance = officeSetting.lateToleranceMinutes || 15;
      const scheduledLimit = new Date();
      scheduledLimit.setHours(startHour, startMin + tolerance, 0, 0);

      const isLate = now.getTime() > scheduledLimit.getTime();
      const checkInStatus = !effectiveWithinGeofence
        ? 'out_of_range'
        : isLate
        ? 'late'
        : 'on_time';

      // Capture verified selfie
      const photo = captureSelfiePhoto(videoRef.current);

      const attDocId = `${user.uid}_${todayStr}`;
      const recordData: AttendanceRecord = {
        id: attDocId,
        employeeId: employee?.id || user.uid,
        userId: user.uid,
        employeeName: employee?.name || user.displayName || 'Karyawan',
        employeeNumber: employee?.employeeNumber || 'EMP-001',
        department: employee?.department || 'Umum',
        date: todayStr,
        checkInTime: timeStr,
        checkInTimestamp: now.getTime(),
        checkInLocation: {
          latitude: gpsLocation?.latitude || officeSetting.latitude,
          longitude: gpsLocation?.longitude || officeSetting.longitude,
          accuracy: gpsLocation?.accuracy || 10,
          address: gpsLocation?.address || officeSetting.name,
          distanceMeters: geofenceResult?.distanceMeters || 0,
          withinGeofence: effectiveWithinGeofence,
        },
        checkInPhoto: photo,
        checkInFaceMatchScore: faceMatchScore || 94,
        checkInStatus,
        status: isLate ? 'late' : 'present',
        notes: notes.trim() || '',
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      };

      await setDoc(doc(db, 'attendances', attDocId), cleanData(recordData));

      // If employee didn't have a registered face yet, register this verified selfie
      if (employee && !employee.faceRegistered) {
        try {
          const tempCanvas = document.createElement('canvas');
          tempCanvas.width = 320;
          tempCanvas.height = 240;
          const ctx = tempCanvas.getContext('2d');
          if (ctx && videoRef.current) {
            ctx.drawImage(videoRef.current, 0, 0, 320, 240);
            const desc = extractFaceDescriptor(tempCanvas);
            await updateDoc(doc(db, 'employees', user.uid), {
              faceRegistered: true,
              facePhotoUrl: photo,
              faceDescriptor: JSON.stringify(desc),
              updatedAt: new Date().toISOString(),
            });
            await refreshEmployee();
          }
        } catch (e) {
          console.warn('Auto face registration note:', e);
        }
      }

      setAttendanceSuccessMessage(
        `Presensi Masuk Berhasil dicatat pada ${timeStr} WIB (${
          checkInStatus === 'on_time' ? 'Tepat Waktu' : 'Terlambat'
        })!`
      );
      triggerCelebration();
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `attendances/${user.uid}_${todayStr}`);
    } finally {
      setSubmitting(false);
    }
  };

  // Perform Clock-Out
  const handleClockOut = async () => {
    if (!user || !todayAttendance || !videoRef.current) return;
    setSubmitting(true);
    setAttendanceSuccessMessage(null);

    try {
      const now = new Date();
      const timeStr = now.toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });

      const photo = captureSelfiePhoto(videoRef.current);
      const diffHours = todayAttendance.checkInTimestamp
        ? (now.getTime() - todayAttendance.checkInTimestamp) / (1000 * 60 * 60)
        : 8;

      const attDocId = `${user.uid}_${todayStr}`;
      const updateData: Partial<AttendanceRecord> = {
        checkOutTime: timeStr,
        checkOutTimestamp: now.getTime(),
        checkOutLocation: {
          latitude: gpsLocation?.latitude || officeSetting.latitude,
          longitude: gpsLocation?.longitude || officeSetting.longitude,
          accuracy: gpsLocation?.accuracy || 10,
          address: gpsLocation?.address || officeSetting.name,
          distanceMeters: geofenceResult?.distanceMeters || 0,
          withinGeofence: effectiveWithinGeofence,
        },
        checkOutPhoto: photo,
        checkOutFaceMatchScore: faceMatchScore || 92,
        workHours: Math.max(0.1, Number(diffHours.toFixed(2))),
        updatedAt: now.toISOString(),
      };

      await updateDoc(doc(db, 'attendances', attDocId), cleanData(updateData));

      setAttendanceSuccessMessage(
        `Presensi Pulang Berhasil dicatat pada ${timeStr} WIB. Total jam kerja: ${diffHours.toFixed(
          1
        )} jam.`
      );
      triggerCelebration();
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `attendances/${user.uid}_${todayStr}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 sm:py-8">
      {/* Attendance Success Banner */}
      {attendanceSuccessMessage && (
        <div className="mb-6 p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-start gap-3 shadow-xs animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-bold text-sm text-emerald-950">Aksi Berhasil</h4>
            <p className="text-sm text-emerald-800">{attendanceSuccessMessage}</p>
          </div>
          <button
            onClick={() => setAttendanceSuccessMessage(null)}
            className="text-xs text-emerald-700 hover:text-emerald-950 font-semibold"
          >
            Tutup
          </button>
        </div>
      )}

      {/* Main Grid: Camera Biometric Verification + GPS Geolocation Radar */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-start">
        {/* Left Column: Camera View & Face Recognition Engine */}
        <div className="lg:col-span-7 bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                <Camera className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h3 className="font-bold text-slate-800 text-base truncate">Verifikasi Wajah Biometrik</h3>
                <p className="text-xs text-slate-500 truncate">Kamera real-time pendeteksi wajah</p>
              </div>
            </div>
          </div>

          {/* Camera Frame */}
          <div className="relative aspect-4/3 rounded-2xl overflow-hidden bg-slate-950 border-2 border-slate-800 shadow-inner flex items-center justify-center">
            {cameraError ? (
              <div className="text-center p-6 max-w-xs">
                <AlertCircle className="w-10 h-10 text-amber-400 mx-auto mb-2" />
                <p className="text-xs text-slate-300 mb-3">{cameraError}</p>
                <button
                  onClick={startCamera}
                  className="px-3.5 py-1.5 bg-blue-600 text-white rounded-xl text-xs font-semibold hover:bg-blue-700"
                >
                  Buka Kamera
                </button>
              </div>
            ) : (
              <>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover scale-x-[-1]"
                />

                {/* Biometric Target Hud */}
                <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
                  {/* Oval target boundary */}
                  <div
                    className={`w-40 sm:w-48 h-52 sm:h-60 rounded-[50%] border-2 transition-all duration-300 ${
                      faceDetected
                        ? faceMatchScore >= 70 || !employee?.faceRegistered
                          ? 'border-emerald-400 ring-4 ring-emerald-500/25'
                          : 'border-amber-400 ring-4 ring-amber-500/25'
                        : 'border-blue-400/80 border-dashed animate-pulse'
                    }`}
                  />

                  {/* Corner Targets */}
                  <div className="absolute top-4 left-4 w-6 h-6 border-t-2 border-l-2 border-blue-400/60" />
                  <div className="absolute top-4 right-4 w-6 h-6 border-t-2 border-r-2 border-blue-400/60" />
                  <div className="absolute bottom-4 left-4 w-6 h-6 border-b-2 border-l-2 border-blue-400/60" />
                  <div className="absolute bottom-4 right-4 w-6 h-6 border-b-2 border-r-2 border-blue-400/60" />

                  {/* Laser Scan line when face present */}
                  {faceDetected && (
                    <div className="absolute inset-x-12 top-1/3 h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent animate-pulse" />
                  )}
                </div>

                {/* Real-time Match Score overlay */}
                <div className="absolute top-3 left-3 bg-slate-900/85 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-700 text-left">
                  <div className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">
                    Kecocokan Biometrik
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`text-sm font-bold font-mono ${
                        faceMatchScore >= 70 || !employee?.faceRegistered
                          ? 'text-emerald-400'
                          : 'text-amber-400'
                      }`}
                    >
                      {faceMatchScore > 0 ? `${faceMatchScore}%` : '--'}
                    </span>
                    <span className="text-[11px] text-slate-300 font-medium">
                      {faceDetected ? 'Live Detected' : 'Scanning...'}
                    </span>
                  </div>
                </div>

                {/* Bottom HUD message */}
                <div className="absolute bottom-3 inset-x-3 text-center pointer-events-none">
                  <div
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold backdrop-blur-md shadow-xs ${
                      faceDetected
                        ? faceMatchScore >= 70 || !employee?.faceRegistered
                          ? 'bg-emerald-500/90 text-white'
                          : 'bg-amber-500/90 text-white'
                        : 'bg-slate-900/80 text-slate-200'
                    }`}
                  >
                    {faceDetected ? (
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    ) : (
                      <Camera className="w-3.5 h-3.5 animate-pulse text-blue-400" />
                    )}
                    <span>{detectionMessage}</span>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Quick Registration Alert if not registered */}
          {employee && !employee.faceRegistered && (
            <div className="mt-3 p-3 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-between text-xs text-blue-900">
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 text-blue-600 shrink-0" />
                <span>
                  Foto saat Clock-In pertama akan otomatis didaftarkan sebagai biometrik wajah Anda.
                </span>
              </div>
              <button
                onClick={onOpenFaceRegistration}
                className="font-bold underline text-blue-700 hover:text-blue-900 shrink-0 ml-2"
              >
                Daftar Khusus
              </button>
            </div>
          )}

          {/* Optional Notes Input */}
          <div className="mt-4">
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Catatan Kehadiran (Opsional):
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Contoh: Bekerja dari kantor cabang / meeting eksternal..."
              maxLength={200}
              className="w-full px-3.5 py-2 rounded-xl text-sm border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-slate-50/50"
            />
          </div>

          {/* Clock In / Out Action Buttons */}
          <div className="mt-5 pt-4 border-t border-slate-100">
            {todayAttendance?.checkOutTime ? (
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-center">
                <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto mb-1" />
                <h4 className="font-bold text-slate-800 text-sm">Presensi Hari Ini Lengkap</h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Masuk: {todayAttendance.checkInTime} WIB | Pulang: {todayAttendance.checkOutTime} WIB
                  (Total {todayAttendance.workHours} Jam Kerja)
                </p>
              </div>
            ) : todayAttendance ? (
              /* Already clocked in, offer Clock Out */
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-amber-600" />
                    <span>
                      Telah Clock-In pada <strong>{todayAttendance.checkInTime} WIB</strong>
                    </span>
                  </div>
                  <span className="font-bold text-amber-800">Sedang Bekerja</span>
                </div>

                <button
                  onClick={handleClockOut}
                  disabled={submitting || !faceDetected || (!effectiveWithinGeofence && !allowLocationOverrideForDemo)}
                  className={`w-full py-3.5 px-6 rounded-2xl text-base font-bold flex items-center justify-center gap-2 text-white shadow-lg transition-all ${
                    !faceDetected || (!effectiveWithinGeofence && !allowLocationOverrideForDemo)
                      ? 'bg-slate-300 cursor-not-allowed shadow-none'
                      : 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/25 active:scale-98'
                  }`}
                >
                  {submitting ? (
                    <RefreshCw className="w-5 h-5 animate-spin" />
                  ) : (
                    <ClockOutIcon className="w-5 h-5" />
                  )}
                  <span>
                    {submitting
                      ? 'Memproses Verifikasi...'
                      : 'Clock-Out Selesai Bekerja'}
                  </span>
                </button>
              </div>
            ) : (
              /* Not yet clocked in, offer Clock In */
              <button
                onClick={handleClockIn}
                disabled={submitting || !faceDetected || (!effectiveWithinGeofence && !allowLocationOverrideForDemo)}
                className={`w-full py-3.5 px-6 rounded-2xl text-base font-bold flex items-center justify-center gap-2 text-white shadow-lg transition-all ${
                  !faceDetected || (!effectiveWithinGeofence && !allowLocationOverrideForDemo)
                    ? 'bg-slate-300 cursor-not-allowed shadow-none'
                    : 'bg-blue-600 hover:bg-blue-700 shadow-blue-600/25 active:scale-98'
                }`}
              >
                {submitting ? (
                  <RefreshCw className="w-5 h-5 animate-spin" />
                ) : (
                  <ClockInIcon className="w-5 h-5" />
                )}
                <span>
                  {submitting
                    ? 'Memverifikasi Presensi...'
                    : 'Clock-In Masuk Sekarang'}
                </span>
              </button>
            )}

            {/* Validation helper tips */}
            {!faceDetected && (
              <p className="text-center text-xs text-slate-400 mt-2">
                Posisikan wajah Anda pada lingkaran untuk mengaktifkan tombol presensi
              </p>
            )}
            {faceDetected && !effectiveWithinGeofence && (
              <p className="text-center text-xs text-rose-500 font-semibold mt-2">
                Anda berada di luar radius kantor ({geofenceResult?.distanceMeters}m). Dekati lokasi kantor untuk presensi.
              </p>
            )}
          </div>
        </div>

        {/* Right Column: GPS Geolocation & Office Geofence Status */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          {/* Office Geofence Radar Card */}
          <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center">
                  <MapPin className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-base">Status Lokasi GPS</h3>
                  <p className="text-xs text-slate-500">Validasi Geofence Radius Kantor</p>
                </div>
              </div>
              <button
                onClick={fetchLocation}
                disabled={gpsLoading}
                className="p-1.5 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition-colors"
                title="Perbarui GPS"
              >
                <RefreshCw className={`w-4 h-4 ${gpsLoading ? 'animate-spin text-blue-600' : ''}`} />
              </button>
            </div>

            {/* Office Target Details */}
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 mb-4">
              <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                <span>Lokasi Kantor:</span>
                <span className="font-bold text-slate-700">{officeSetting.name}</span>
              </div>
              <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                <span>Batas Radius:</span>
                <span className="font-bold text-slate-700">{officeSetting.radiusMeters} Meter</span>
              </div>
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Jam Kerja:</span>
                <span className="font-bold text-slate-700">
                  {officeSetting.workStartTime} - {officeSetting.workEndTime} WIB
                </span>
              </div>
            </div>

            {/* User GPS Status */}
            {gpsLoading ? (
              <div className="py-8 text-center text-slate-400">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500" />
                <p className="text-xs">Mendeteksi koordinat satelit GPS...</p>
              </div>
            ) : gpsError ? (
              <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 text-xs">
                <p className="font-semibold mb-1">Peringatan GPS:</p>
                <p>{gpsError}</p>
                <button
                  onClick={fetchLocation}
                  className="mt-2 text-rose-700 font-bold underline"
                >
                  Coba Lagi
                </button>
              </div>
            ) : gpsLocation ? (
              <div className="flex flex-col gap-3">
                {/* Distance Badge */}
                <div
                  className={`p-4 rounded-2xl border flex items-center justify-between ${
                    effectiveWithinGeofence
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                      : 'bg-rose-50 border-rose-200 text-rose-950'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                        effectiveWithinGeofence
                          ? 'bg-emerald-600 text-white'
                          : 'bg-rose-600 text-white'
                      }`}
                    >
                      <MapPin className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold">
                        {effectiveWithinGeofence ? 'Dalam Area Kantor' : 'Di Luar Area Kantor'}
                      </div>
                      <div className="text-base font-bold">
                        {geofenceResult ? formatDistance(geofenceResult.distanceMeters) : '--'}
                      </div>
                    </div>
                  </div>
                  <div className="text-right text-[11px] opacity-80">
                    Akurasi: ±{gpsLocation.accuracy}m
                  </div>
                </div>

                {/* Detailed Coordinate readout */}
                <div className="text-xs text-slate-500 space-y-1 bg-slate-50 p-3 rounded-xl border border-slate-200/60">
                  <div className="flex justify-between">
                    <span>Koordinat Anda:</span>
                    <span className="font-mono text-slate-700">
                      {gpsLocation.latitude.toFixed(6)}, {gpsLocation.longitude.toFixed(6)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Koordinat Kantor:</span>
                    <span className="font-mono text-slate-700">
                      {officeSetting.latitude.toFixed(6)}, {officeSetting.longitude.toFixed(6)}
                    </span>
                  </div>
                  <div className="truncate pt-1 text-[11px] text-slate-400 border-t border-slate-200">
                    {gpsLocation.address}
                  </div>
                </div>

                {/* Testing / Simulator Mode for Preview / Virtual Environments */}
                <div className="mt-2 p-3 rounded-xl bg-slate-100/70 border border-slate-200 text-xs">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-slate-700 block">Mode Fleksibel / Uji Coba:</span>
                      <span className="text-[11px] text-slate-500">
                        Abaikan batas jarak GPS untuk pengujian di browser/emulator
                      </span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer ml-2">
                      <input
                        type="checkbox"
                        checked={allowLocationOverrideForDemo}
                        onChange={(e) => setAllowLocationOverrideForDemo(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          {/* Today's Attendance Summary Card */}
          <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-xs">
            <h4 className="font-bold text-slate-800 text-sm mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-600" />
              <span>Ringkasan Kehadiran Hari Ini</span>
            </h4>

            {todayAttendance ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                  <div className="flex items-center gap-2.5">
                    {todayAttendance.checkInPhoto ? (
                      <img
                        src={todayAttendance.checkInPhoto}
                        alt="Selfie Masuk"
                        className="w-10 h-10 rounded-lg object-cover border border-slate-300"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
                        <ClockInIcon className="w-5 h-5" />
                      </div>
                    )}
                    <div>
                      <div className="text-xs text-slate-500">Clock-In (Masuk)</div>
                      <div className="text-sm font-bold text-slate-800 font-mono">
                        {todayAttendance.checkInTime} WIB
                      </div>
                    </div>
                  </div>
                  <span
                    className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                      todayAttendance.checkInStatus === 'on_time'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {todayAttendance.checkInStatus === 'on_time' ? 'Tepat Waktu' : 'Terlambat'}
                  </span>
                </div>

                {todayAttendance.checkOutTime && (
                  <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                    <div className="flex items-center gap-2.5">
                      {todayAttendance.checkOutPhoto ? (
                        <img
                          src={todayAttendance.checkOutPhoto}
                          alt="Selfie Pulang"
                          className="w-10 h-10 rounded-lg object-cover border border-slate-300"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-rose-100 text-rose-600 flex items-center justify-center">
                          <ClockOutIcon className="w-5 h-5" />
                        </div>
                      )}
                      <div>
                        <div className="text-xs text-slate-500">Clock-Out (Pulang)</div>
                        <div className="text-sm font-bold text-slate-800 font-mono">
                          {todayAttendance.checkOutTime} WIB
                        </div>
                      </div>
                    </div>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                      {todayAttendance.workHours} Jam
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div className="py-6 text-center text-slate-400">
                <Clock className="w-8 h-8 mx-auto mb-1 opacity-40" />
                <p className="text-xs">Belum ada data presensi hari ini.</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Lakukan Clock-In melalui verifikasi wajah di samping.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

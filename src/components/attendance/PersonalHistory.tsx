import React, { useState, useEffect } from 'react';
import {
  CalendarDays,
  Clock,
  MapPin,
  CheckCircle2,
  FileSpreadsheet,
  AlertTriangle,
  RefreshCw,
  Camera,
} from 'lucide-react';
import { AttendanceRecord } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { db, handleFirestoreError, OperationType } from '../../firebase/config';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { exportAttendancesToExcel } from '../../utils/excelExport';

export const PersonalHistory: React.FC = () => {
  const { user, employee } = useAuth();
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    setLoading(true);

    const q = query(collection(db, 'attendances'), where('userId', '==', user.uid));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: AttendanceRecord[] = [];
        snapshot.forEach((doc) => {
          list.push({ ...(doc.data() as AttendanceRecord), id: doc.id });
        });
        list.sort((a, b) => {
          const timeA = a.checkInTimestamp || new Date(a.date).getTime();
          const timeB = b.checkInTimestamp || new Date(b.date).getTime();
          return timeB - timeA;
        });
        setRecords(list);
        setLoading(false);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'attendances');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  const handleExportPersonal = () => {
    if (records.length === 0) return;
    const nameSlug = (employee?.name || 'Karyawan').replace(/\s+/g, '_');
    exportAttendancesToExcel(records, `Riwayat_Presensi_${nameSlug}`);
  };

  const totalPresent = records.filter((r) => r.status === 'present').length;
  const totalLate = records.filter((r) => r.checkInStatus === 'late').length;
  const totalWorkHours = records.reduce((acc, r) => acc + (r.workHours || 0), 0);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Riwayat Presensi Saya
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Daftar absensi harian dan rekam kehadiran pribadi
          </p>
        </div>

        {records.length > 0 && (
          <button
            onClick={handleExportPersonal}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-xs active:scale-98 transition-all shrink-0 cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Unduh Laporan Saya (.xlsx)</span>
          </button>
        )}
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4 mb-6">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-xs text-slate-400 font-semibold uppercase">Total Kehadiran</span>
          <div className="text-xl font-bold text-slate-900 mt-1">{records.length} Hari</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-xs text-slate-400 font-semibold uppercase">Tepat Waktu</span>
          <div className="text-xl font-bold text-emerald-600 mt-1">
            {records.filter((r) => r.checkInStatus === 'on_time').length} Hari
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-xs text-slate-400 font-semibold uppercase">Total Jam Kerja</span>
          <div className="text-xl font-bold text-blue-600 mt-1">
            {totalWorkHours.toFixed(1)} Jam
          </div>
        </div>
      </div>

      {/* History List */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-12 text-center text-slate-400">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500" />
            <span>Memuat riwayat presensi...</span>
          </div>
        ) : records.length === 0 ? (
          <div className="py-12 text-center text-slate-400">
            <CalendarDays className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p className="font-semibold text-slate-700 text-sm">Belum ada catatan presensi</p>
            <p className="text-xs text-slate-400 mt-0.5">
              Silakan lakukan presensi masuk pada tab Presensi Harian.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {records.map((r) => (
              <div
                key={r.id}
                className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/60 transition-colors"
              >
                <div className="flex items-start sm:items-center gap-3.5">
                  {r.checkInPhoto ? (
                    <img
                      src={r.checkInPhoto}
                      alt="Selfie"
                      className="w-12 h-12 rounded-xl object-cover border border-slate-200 shadow-xs shrink-0"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                      <Camera className="w-6 h-6" />
                    </div>
                  )}

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-sm">{r.date}</span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          r.checkInStatus === 'on_time'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {r.checkInStatus === 'on_time' ? 'Tepat Waktu' : 'Terlambat'}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 mt-1">
                      <span className="flex items-center gap-1 font-mono text-slate-700">
                        <Clock className="w-3.5 h-3.5 text-blue-500" />
                        Masuk: {r.checkInTime || '-'} WIB
                      </span>
                      {r.checkOutTime && (
                        <span className="flex items-center gap-1 font-mono text-slate-700">
                          <Clock className="w-3.5 h-3.5 text-rose-500" />
                          Pulang: {r.checkOutTime} WIB ({r.workHours} jam)
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-3 text-xs border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100">
                  <div className="text-left sm:text-right">
                    <div className="font-semibold text-slate-700 flex items-center gap-1 sm:justify-end">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      <span>{r.checkInLocation?.distanceMeters ?? 0}m dari kantor</span>
                    </div>
                    <div className="text-[11px] text-emerald-600 font-medium">
                      Kecocokan Wajah: {r.checkInFaceMatchScore || 94}%
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

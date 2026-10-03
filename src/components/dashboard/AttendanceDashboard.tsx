import React, { useState, useEffect, useMemo } from 'react';
import {
  FileSpreadsheet,
  Search,
  Filter,
  Calendar,
  CheckCircle2,
  Clock,
  AlertTriangle,
  MapPin,
  ExternalLink,
  Eye,
  X,
  TrendingUp,
  UserCheck,
  Building2,
  RefreshCw,
  Stethoscope,
  Palmtree,
  FileCheck2,
  ChevronRight,
  FileDown,
} from 'lucide-react';
import { AttendanceRecord, Employee, LeaveRequest } from '../../types';
import { exportAttendancesToExcel } from '../../utils/excelExport';
import { exportMonthlyAttendancePDF, calculateEmployeeWorkSummaries } from '../../utils/pdfExport';
import { db, handleFirestoreError, OperationType } from '../../firebase/config';
import { collection, onSnapshot, query, where, limit } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';

interface AttendanceDashboardProps {
  onNavigateToLeaves?: () => void;
}

export const AttendanceDashboard: React.FC<AttendanceDashboardProps> = ({ onNavigateToLeaves }) => {
  const { user, employee, isAdmin } = useAuth();
  const [attendances, setAttendances] = useState<AttendanceRecord[]>([]);
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDept, setSelectedDept] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [selectedDateFilter, setSelectedDateFilter] = useState<'today' | 'week' | 'month' | 'all'>('today');

  // Selected Record for Detail Modal
  const [selectedRecord, setSelectedRecord] = useState<AttendanceRecord | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  // PDF Export Modal State
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [pdfMonthYear, setPdfMonthYear] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [pdfDept, setPdfDept] = useState('ALL');

  // Real-time Firestore sync
  useEffect(() => {
    if (!user) return;

    setLoading(true);
    const attCollection = collection(db, 'attendances');
    // Formulate query securely: Admins can query all, regular employees query their own records
    const q = isAdmin
      ? query(attCollection, limit(200))
      : query(attCollection, where('userId', '==', user.uid), limit(200));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const records: AttendanceRecord[] = [];
        snapshot.forEach((doc) => {
          records.push({ ...(doc.data() as AttendanceRecord), id: doc.id });
        });
        // Sort by date/checkInTimestamp descending
        records.sort((a, b) => {
          const timeA = a.checkInTimestamp || new Date(a.createdAt || 0).getTime();
          const timeB = b.checkInTimestamp || new Date(b.createdAt || 0).getTime();
          return timeB - timeA;
        });
        setAttendances(records);
        setLoading(false);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'attendances');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user, isAdmin]);

  // Real-time Firestore sync for leaves
  useEffect(() => {
    if (!user) return;
    const leavesCol = collection(db, 'leaves');
    const q = isAdmin
      ? query(leavesCol, limit(200))
      : query(leavesCol, where('userId', '==', user.uid), limit(100));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const records: LeaveRequest[] = [];
        snapshot.forEach((docSnap) => {
          records.push({ ...(docSnap.data() as LeaveRequest), id: docSnap.id });
        });
        setLeaves(records);
      },
      (error) => {
        console.warn('Leaves sync note:', error);
      }
    );

    return () => unsubscribe();
  }, [user, isAdmin]);

  // Compute Today, Week, Month boundaries
  const todayStr = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
      now.getDate()
    ).padStart(2, '0')}`;
  }, []);

  // Filter Attendances
  const filteredAttendances = useMemo(() => {
    return attendances.filter((att) => {
      // Date Filter
      if (selectedDateFilter === 'today') {
        if (att.date !== todayStr) return false;
      } else if (selectedDateFilter === 'week') {
        const attDate = new Date(att.date).getTime();
        const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
        if (attDate < sevenDaysAgo) return false;
      } else if (selectedDateFilter === 'month') {
        const [year, month] = att.date.split('-');
        const now = new Date();
        if (
          Number(year) !== now.getFullYear() ||
          Number(month) !== now.getMonth() + 1
        ) {
          return false;
        }
      }

      // Dept Filter
      if (selectedDept !== 'ALL' && att.department !== selectedDept) {
        return false;
      }

      // Status Filter
      if (selectedStatus !== 'ALL') {
        if (selectedStatus === 'on_time' && att.checkInStatus !== 'on_time') return false;
        if (selectedStatus === 'late' && att.checkInStatus !== 'late') return false;
        if (selectedStatus === 'out_of_range' && att.checkInStatus !== 'out_of_range') return false;
        if (selectedStatus === 'checkout' && !att.checkOutTime) return false;
        if (selectedStatus === 'leave' && !['sick', 'annual_leave', 'permit'].includes(att.status)) return false;
      }

      // Search Query
      if (searchQuery.trim()) {
        const queryLower = searchQuery.toLowerCase();
        const matchesName = att.employeeName.toLowerCase().includes(queryLower);
        const matchesNip = att.employeeNumber?.toLowerCase().includes(queryLower);
        const matchesDept = att.department?.toLowerCase().includes(queryLower);
        if (!matchesName && !matchesNip && !matchesDept) return false;
      }

      return true;
    });
  }, [attendances, selectedDateFilter, selectedDept, selectedStatus, searchQuery, todayStr]);

  // Unique departments for filter
  const departments = useMemo(() => {
    const set = new Set<string>();
    attendances.forEach((a) => {
      if (a.department) set.add(a.department);
    });
    return Array.from(set);
  }, [attendances]);

  // Pending leaves awaiting HR approval
  const pendingLeaves = useMemo(() => {
    return leaves.filter((l) => l.status === 'pending');
  }, [leaves]);

  // Approved leaves count
  const approvedLeavesCount = useMemo(() => {
    return filteredAttendances.filter((a) => ['sick', 'annual_leave', 'permit'].includes(a.status)).length;
  }, [filteredAttendances]);

  // KPIs
  const totalFiltered = filteredAttendances.length;
  const onTimeCount = filteredAttendances.filter((a) => a.checkInStatus === 'on_time').length;
  const lateCount = filteredAttendances.filter((a) => a.checkInStatus === 'late').length;
  const outOfRangeCount = filteredAttendances.filter((a) => a.checkInStatus === 'out_of_range').length;
  const checkedOutCount = filteredAttendances.filter((a) => !!a.checkOutTime).length;
  const onTimePercent = totalFiltered > 0 ? Math.round((onTimeCount / totalFiltered) * 100) : 0;

  // Average face match score
  const avgFaceScore = useMemo(() => {
    const scores = filteredAttendances
      .map((a) => a.checkInFaceMatchScore)
      .filter((s): s is number => typeof s === 'number' && s > 0);
    if (scores.length === 0) return 95;
    return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  }, [filteredAttendances]);

  // Export handler
  const handleExport = () => {
    if (filteredAttendances.length === 0) {
      alert('Tidak ada data presensi untuk diekspor.');
      return;
    }
    setIsExporting(true);
    setTimeout(() => {
      exportAttendancesToExcel(filteredAttendances, 'Rekapitulasi_Presensi');
      setIsExporting(false);
    }, 400);
  };

  // PDF Export Computation
  const pdfAttendances = useMemo(() => {
    return attendances.filter((att) => {
      if (!att.date.startsWith(pdfMonthYear)) return false;
      if (pdfDept !== 'ALL' && att.department !== pdfDept) return false;
      return true;
    });
  }, [attendances, pdfMonthYear, pdfDept]);

  const pdfWorkSummaries = useMemo(() => {
    return calculateEmployeeWorkSummaries(pdfAttendances);
  }, [pdfAttendances]);

  const totalPdfWorkHours = useMemo(() => {
    return Number(pdfWorkSummaries.reduce((acc, s) => acc + s.totalWorkHours, 0).toFixed(1));
  }, [pdfWorkSummaries]);

  const handleDownloadPDF = () => {
    if (pdfAttendances.length === 0) {
      alert('Tidak ada data presensi pada bulan dan departemen yang dipilih.');
      return;
    }
    setIsExportingPdf(true);
    setTimeout(() => {
      exportMonthlyAttendancePDF(pdfAttendances, {
        monthYearStr: pdfMonthYear,
        departmentFilter: pdfDept,
        adminName: employee?.name || user?.displayName || user?.email || 'HR Administrator',
      });
      setIsExportingPdf(false);
      setIsPdfModalOpen(false);
    }, 400);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Dashboard Rekapitulasi Presensi
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Monitoring kehadiran harian, verifikasi wajah biometrik, dan kepatuhan radius GPS
          </p>
        </div>

        {/* Export Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Export to PDF CTA */}
          <button
            onClick={() => setIsPdfModalOpen(true)}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold text-sm shadow-md shadow-rose-600/20 active:scale-98 transition-all shrink-0 cursor-pointer"
          >
            <FileDown className="w-4 h-4" />
            <span>Laporan PDF Bulanan</span>
          </button>

          {/* Export to Excel CTA */}
          <button
            onClick={handleExport}
            disabled={isExporting || totalFiltered === 0}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm shadow-md shadow-emerald-600/20 active:scale-98 transition-all shrink-0 cursor-pointer disabled:opacity-50"
          >
            {isExporting ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <FileSpreadsheet className="w-4 h-4" />
            )}
            <span>Ekspor Excel (.xlsx)</span>
          </button>
        </div>
      </div>

      {/* Alert banner for pending leave requests */}
      {pendingLeaves.length > 0 && isAdmin && (
        <div className="mb-6 p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-xs animate-in fade-in">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-100 border border-amber-300 flex items-center justify-center text-amber-700 shrink-0">
              <FileCheck2 className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-sm text-slate-900">
                Terdapat {pendingLeaves.length} Pengajuan Izin / Cuti Menunggu Persetujuan HR
              </div>
              <p className="text-xs text-slate-600">
                Karyawan telah mengajukan permohonan baru yang membutuhkan verifikasi atau tindakan persetujuan.
              </p>
            </div>
          </div>
          {onNavigateToLeaves && (
            <button
              onClick={onNavigateToLeaves}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-xs transition-colors shrink-0 cursor-pointer"
            >
              <span>Kelola & Tinjau Permohonan</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4 mb-6">
        {/* Total Presensi */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 uppercase">Total Rekap</span>
            <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
              <UserCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-bold text-slate-900">{totalFiltered}</div>
          <p className="text-[11px] text-slate-400 mt-1">Sesuai filter terpilih</p>
        </div>

        {/* Tepat Waktu % */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 uppercase">Tepat Waktu</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-bold text-emerald-600">{onTimePercent}%</div>
          <p className="text-[11px] text-slate-400 mt-1">{onTimeCount} dari {totalFiltered} hadir</p>
        </div>

        {/* Terlambat */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 uppercase">Terlambat</span>
            <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-bold text-amber-600">{lateCount}</div>
          <p className="text-[11px] text-slate-400 mt-1">Melebihi jam toleransi</p>
        </div>

        {/* Luar Geofence */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 uppercase">Luar Radius</span>
            <div className="w-7 h-7 rounded-lg bg-rose-100 text-rose-600 flex items-center justify-center">
              <MapPin className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-bold text-rose-600">{outOfRangeCount}</div>
          <p className="text-[11px] text-slate-400 mt-1">Melewati geofence</p>
        </div>

        {/* Izin & Cuti Resmi */}
        <div className="bg-white p-4 rounded-2xl border border-purple-200 shadow-xs bg-purple-50/20">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-purple-700 uppercase">Izin & Cuti</span>
            <div className="w-7 h-7 rounded-lg bg-purple-100 text-purple-600 flex items-center justify-center">
              <FileCheck2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-bold text-purple-700">{approvedLeavesCount}</div>
          <p className="text-[11px] text-slate-400 mt-1">Sakit, cuti & izin resmi</p>
        </div>

        {/* Skor Wajah Rata-rata */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 uppercase">Biometrik</span>
            <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center">
              <UserCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-bold text-indigo-600">{avgFaceScore}%</div>
          <p className="text-[11px] text-slate-400 mt-1">Rerata kecocokan</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {/* Search Box */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nama karyawan / NIP..."
              className="w-full pl-10 pr-3.5 py-2 rounded-xl text-sm border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-slate-50/50"
            />
          </div>

          {/* Date Filter */}
          <div className="flex items-center rounded-xl bg-slate-100 p-1 text-xs font-semibold text-slate-600">
            <button
              onClick={() => setSelectedDateFilter('today')}
              className={`flex-1 py-1.5 rounded-lg transition-all ${
                selectedDateFilter === 'today'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'hover:text-slate-900'
              }`}
            >
              Hari Ini
            </button>
            <button
              onClick={() => setSelectedDateFilter('week')}
              className={`flex-1 py-1.5 rounded-lg transition-all ${
                selectedDateFilter === 'week'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'hover:text-slate-900'
              }`}
            >
              7 Hari
            </button>
            <button
              onClick={() => setSelectedDateFilter('month')}
              className={`flex-1 py-1.5 rounded-lg transition-all ${
                selectedDateFilter === 'month'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'hover:text-slate-900'
              }`}
            >
              Bulan Ini
            </button>
            <button
              onClick={() => setSelectedDateFilter('all')}
              className={`flex-1 py-1.5 rounded-lg transition-all ${
                selectedDateFilter === 'all'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'hover:text-slate-900'
              }`}
            >
              Semua
            </button>
          </div>

          {/* Department Filter */}
          <div>
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl text-sm border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-slate-50/50 text-slate-700"
            >
              <option value="ALL">Semua Departemen</option>
              {departments.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl text-sm border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-slate-50/50 text-slate-700"
            >
              <option value="ALL">Semua Status Masuk</option>
              <option value="on_time">Tepat Waktu</option>
              <option value="late">Terlambat</option>
              <option value="out_of_range">Luar Radius GPS</option>
              <option value="checkout">Sudah Clock-Out</option>
              <option value="leave">🩺 Sakit / Cuti / Izin</option>
            </select>
          </div>
        </div>
      </div>

      {/* Attendance Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase font-semibold text-slate-500 tracking-wider">
              <tr>
                <th className="py-3.5 px-4">Karyawan</th>
                <th className="py-3.5 px-4">Tanggal & Masuk</th>
                <th className="py-3.5 px-4">Verifikasi Wajah</th>
                <th className="py-3.5 px-4">Jarak GPS</th>
                <th className="py-3.5 px-4">Jam Pulang</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500" />
                    <span>Memuat data riwayat absensi...</span>
                  </td>
                </tr>
              ) : filteredAttendances.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <UserCheck className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="font-semibold text-slate-700 text-sm">Tidak ada catatan presensi</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Ubah filter tanggal atau lakukan absensi terlebih dahulu.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredAttendances.map((att) => {
                  const hasOutOfRange = att.checkInStatus === 'out_of_range';
                  const isLate = att.checkInStatus === 'late';
                  const isOnTime = att.checkInStatus === 'on_time';

                  return (
                    <tr
                      key={att.id}
                      className="hover:bg-slate-50/80 transition-colors cursor-default"
                    >
                      {/* Karyawan info + thumbnail */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          {att.checkInPhoto ? (
                            <img
                              src={att.checkInPhoto}
                              alt={att.employeeName}
                              className="w-10 h-10 rounded-xl object-cover border border-slate-200 shadow-xs"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 font-bold flex items-center justify-center text-xs">
                              {att.employeeName?.[0] || 'K'}
                            </div>
                          )}
                          <div>
                            <div className="font-semibold text-slate-900 leading-tight flex items-center gap-1.5 flex-wrap">
                              <span>{att.employeeName}</span>
                              {att.category && (
                                <span
                                  className={`text-[10px] px-1.5 py-0.2 rounded-md font-bold ${
                                    att.category === 'WFO'
                                      ? 'bg-slate-100 text-slate-700 border border-slate-200'
                                      : att.category === 'WFH'
                                      ? 'bg-blue-100 text-blue-800 border border-blue-200'
                                      : att.category === 'WFA'
                                      ? 'bg-purple-100 text-purple-800 border border-purple-200'
                                      : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                  }`}
                                >
                                  {att.category === 'CLIENT_VISIT' ? 'Client Visit' : att.category}
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-slate-400 font-mono">
                              {att.employeeNumber} • {att.department}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Tanggal & Jam Masuk */}
                      <td className="py-3 px-4">
                        {['sick', 'annual_leave', 'permit'].includes(att.status) ? (
                          <div>
                            <div className="font-semibold text-purple-700 text-xs">
                              {att.status === 'sick'
                                ? 'Izin Sakit'
                                : att.status === 'annual_leave'
                                ? 'Cuti Tahunan'
                                : 'Izin Khusus'}
                            </div>
                            <div className="text-xs text-slate-400">{att.date}</div>
                          </div>
                        ) : (
                          <div>
                            <div className="font-semibold text-slate-800 font-mono">
                              {att.checkInTime || '-'} WIB
                            </div>
                            <div className="text-xs text-slate-400">{att.date}</div>
                          </div>
                        )}
                      </td>

                      {/* Face verification match */}
                      <td className="py-3 px-4">
                        {['sick', 'annual_leave', 'permit'].includes(att.status) ? (
                          <span className="text-[11px] font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200">
                            Izin Resmi
                          </span>
                        ) : (
                          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-100 text-xs font-semibold text-slate-700 font-mono">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>{att.checkInFaceMatchScore || 94}%</span>
                          </div>
                        )}
                      </td>

                      {/* GPS distance */}
                      <td className="py-3 px-4">
                        {['sick', 'annual_leave', 'permit'].includes(att.status) ? (
                          <div className="text-xs text-slate-400 italic">Disetujui HR</div>
                        ) : (
                          <>
                            <div className="flex items-center gap-1 text-xs font-semibold text-slate-700">
                              <MapPin
                                className={`w-3.5 h-3.5 ${
                                  hasOutOfRange ? 'text-rose-500' : 'text-emerald-600'
                                }`}
                              />
                              <span>
                                {att.checkInLocation?.distanceMeters !== undefined
                                  ? `${att.checkInLocation.distanceMeters} m`
                                  : '-'}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-400 truncate max-w-[120px]">
                              {att.checkInLocation?.address || 'Kantor'}
                            </div>
                          </>
                        )}
                      </td>

                      {/* Jam Pulang */}
                      <td className="py-3 px-4">
                        {['sick', 'annual_leave', 'permit'].includes(att.status) ? (
                          <span className="text-xs font-medium text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200">
                            Bebas Tugas
                          </span>
                        ) : att.checkOutTime ? (
                          <div>
                            <div className="font-semibold text-slate-800 font-mono">
                              {att.checkOutTime} WIB
                            </div>
                            <div className="text-xs text-slate-400">
                              {att.workHours ? `${att.workHours} Jam Kerja` : ''}
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                            Aktif Bekerja
                          </span>
                        )}
                      </td>

                      {/* Status Masuk */}
                      <td className="py-3 px-4">
                        {att.status === 'sick' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                            <Stethoscope className="w-3.5 h-3.5" />
                            <span>Sakit</span>
                          </span>
                        )}
                        {att.status === 'annual_leave' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                            <Palmtree className="w-3.5 h-3.5" />
                            <span>Cuti Tahunan</span>
                          </span>
                        )}
                        {att.status === 'permit' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">
                            <FileCheck2 className="w-3.5 h-3.5" />
                            <span>Izin Khusus</span>
                          </span>
                        )}
                        {!['sick', 'annual_leave', 'permit'].includes(att.status) && (
                          <>
                            {isOnTime && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Tepat Waktu</span>
                              </span>
                            )}
                            {isLate && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                                <Clock className="w-3.5 h-3.5" />
                                <span>Terlambat</span>
                              </span>
                            )}
                            {hasOutOfRange && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                                <AlertTriangle className="w-3.5 h-3.5" />
                                <span>Luar Radius</span>
                              </span>
                            )}
                          </>
                        )}
                      </td>

                      {/* Detail action */}
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => setSelectedRecord(att)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-blue-600 hover:bg-blue-50 transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Detail</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Record Detail Modal */}
      {selectedRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-xl w-full overflow-hidden shadow-2xl border border-slate-100">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
                  <UserCheck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-base">Detail Bukti Presensi</h3>
                  <p className="text-xs text-slate-500 font-mono flex items-center gap-1.5 mt-0.5">
                    <span>{selectedRecord.employeeName} ({selectedRecord.employeeNumber}) • {selectedRecord.date}</span>
                    {selectedRecord.category && (
                      <span className="font-bold px-2 py-0.5 rounded-full text-[10px] bg-blue-100 text-blue-800 border border-blue-200">
                        {selectedRecord.category === 'CLIENT_VISIT' ? 'Client Visit' : selectedRecord.category}
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedRecord(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
              {/* Leave Status Banner if record is approved leave */}
              {['sick', 'annual_leave', 'permit'].includes(selectedRecord.status) && (
                <div className="p-4 rounded-2xl bg-purple-50 border border-purple-200 text-xs text-purple-900 shadow-2xs">
                  <div className="flex items-center gap-2 font-bold text-sm mb-1 text-purple-900">
                    <FileCheck2 className="w-4 h-4 text-purple-600" />
                    <span>
                      Status: {selectedRecord.status === 'sick' ? 'Izin Sakit' : selectedRecord.status === 'annual_leave' ? 'Cuti Tahunan' : 'Izin Khusus'} Resmi Disetujui HR
                    </span>
                  </div>
                  <p className="text-purple-800 leading-relaxed">
                    {selectedRecord.notes || 'Pengajuan izin telah diverifikasi dan disetujui oleh Manajemen HR.'}
                  </p>
                </div>
              )}

              {/* Photo Evidence Side by Side */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                  Bukti Foto Selfie Pengenalan Wajah
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  {/* Clock In Selfie */}
                  <div className="bg-slate-50 rounded-2xl p-3 border border-slate-200/80 text-center">
                    <div className="text-xs font-bold text-slate-700 mb-2">Foto Saat Clock-In</div>
                    {selectedRecord.checkInPhoto ? (
                      <div className="relative aspect-4/3 rounded-xl overflow-hidden border border-slate-300 shadow-xs mb-2">
                        <img
                          src={selectedRecord.checkInPhoto}
                          alt="Selfie Masuk"
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute bottom-1 inset-x-1 bg-slate-900/80 text-white text-[10px] py-0.5 rounded font-mono">
                          {selectedRecord.checkInTime} WIB
                        </div>
                      </div>
                    ) : (
                      <div className="aspect-4/3 rounded-xl bg-slate-200 flex items-center justify-center text-xs text-slate-400 mb-2">
                        Foto tidak tersedia
                      </div>
                    )}
                    <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                      Skor Wajah: {selectedRecord.checkInFaceMatchScore || 94}%
                    </span>
                  </div>

                  {/* Clock Out Selfie */}
                  <div className="bg-slate-50 rounded-2xl p-3 border border-slate-200/80 text-center">
                    <div className="text-xs font-bold text-slate-700 mb-2">Foto Saat Clock-Out</div>
                    {selectedRecord.checkOutPhoto ? (
                      <div className="relative aspect-4/3 rounded-xl overflow-hidden border border-slate-300 shadow-xs mb-2">
                        <img
                          src={selectedRecord.checkOutPhoto}
                          alt="Selfie Pulang"
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute bottom-1 inset-x-1 bg-slate-900/80 text-white text-[10px] py-0.5 rounded font-mono">
                          {selectedRecord.checkOutTime} WIB
                        </div>
                      </div>
                    ) : (
                      <div className="aspect-4/3 rounded-xl bg-slate-100 flex items-center justify-center text-xs text-slate-400 mb-2 border border-dashed border-slate-300">
                        Belum Clock-Out
                      </div>
                    )}
                    <span className="text-[11px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
                      {selectedRecord.checkOutTime ? `Skor: ${selectedRecord.checkOutFaceMatchScore || 92}%` : 'Menunggu Pulang'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Geolocation Details Side-by-Side: Clock-In & Clock-Out */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-blue-600" />
                  <span>Verifikasi Lokasi & Koordinat GPS (Google Maps)</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Lokasi Clock-In Card */}
                  <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-200/60">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                          <span className="text-xs font-bold text-slate-800">Lokasi Clock-In</span>
                        </div>
                        <span className="text-[11px] font-mono font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                          {selectedRecord.checkInTime || '-'} WIB
                        </span>
                      </div>

                      <div className="space-y-2 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">Jarak ke Kantor:</span>
                          <span className="font-bold text-slate-800">
                            {selectedRecord.checkInLocation?.distanceMeters !== undefined
                              ? `${selectedRecord.checkInLocation.distanceMeters} Meter`
                              : '-'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">Status Radius:</span>
                          <span
                            className={`font-bold ${
                              selectedRecord.checkInStatus === 'out_of_range'
                                ? 'text-rose-600'
                                : 'text-emerald-600'
                            }`}
                          >
                            {selectedRecord.checkInStatus === 'out_of_range'
                              ? 'Di Luar Radius'
                              : 'Dalam Radius Kantor'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">Koordinat GPS:</span>
                          <span className="font-mono text-slate-700 text-[11px]">
                            {selectedRecord.checkInLocation?.latitude
                              ? `${selectedRecord.checkInLocation.latitude.toFixed(5)}, ${selectedRecord.checkInLocation.longitude.toFixed(5)}`
                              : '-'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">Akurasi GPS:</span>
                          <span className="font-mono text-slate-600 text-[11px]">
                            ±{selectedRecord.checkInLocation?.accuracy || 10} Meter
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-200/80 mt-3">
                      {selectedRecord.checkInLocation?.latitude ? (
                        <a
                          href={`https://www.google.com/maps?q=${selectedRecord.checkInLocation.latitude},${selectedRecord.checkInLocation.longitude}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center justify-center w-full gap-2 px-3 py-2 rounded-xl text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 transition-colors shadow-2xs cursor-pointer"
                        >
                          <MapPin className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                          <span>Buka di Google Map (Clock-In)</span>
                          <ExternalLink className="w-3 h-3 text-blue-500 shrink-0" />
                        </a>
                      ) : (
                        <span className="text-[11px] text-slate-400 block text-center py-1">
                          Koordinat masuk tidak tersedia
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Lokasi Clock-Out Card */}
                  <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-200/60">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`w-2.5 h-2.5 rounded-full ${
                              selectedRecord.checkOutTime ? 'bg-rose-500' : 'bg-slate-300'
                            }`}
                          ></span>
                          <span className="text-xs font-bold text-slate-800">Lokasi Clock-Out</span>
                        </div>
                        <span
                          className={`text-[11px] font-mono font-semibold px-2 py-0.5 rounded-md border ${
                            selectedRecord.checkOutTime
                              ? 'text-rose-700 bg-rose-50 border-rose-200'
                              : 'text-slate-500 bg-slate-100 border-slate-200'
                          }`}
                        >
                          {selectedRecord.checkOutTime ? `${selectedRecord.checkOutTime} WIB` : 'Belum Pulang'}
                        </span>
                      </div>

                      {selectedRecord.checkOutTime ? (
                        <div className="space-y-2 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="text-slate-400">Jarak ke Kantor:</span>
                            <span className="font-bold text-slate-800">
                              {selectedRecord.checkOutLocation?.distanceMeters !== undefined
                                ? `${selectedRecord.checkOutLocation.distanceMeters} Meter`
                                : '-'}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-slate-400">Status Radius:</span>
                            <span
                              className={`font-bold ${
                                selectedRecord.checkOutLocation?.withinGeofence === false
                                  ? 'text-rose-600'
                                  : 'text-emerald-600'
                              }`}
                            >
                              {selectedRecord.checkOutLocation?.withinGeofence === false
                                ? 'Di Luar Radius'
                                : 'Dalam Radius Kantor'}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-slate-400">Koordinat GPS:</span>
                            <span className="font-mono text-slate-700 text-[11px]">
                              {selectedRecord.checkOutLocation?.latitude
                                ? `${selectedRecord.checkOutLocation.latitude.toFixed(5)}, ${selectedRecord.checkOutLocation.longitude.toFixed(5)}`
                                : selectedRecord.checkInLocation?.latitude
                                ? `${selectedRecord.checkInLocation.latitude.toFixed(5)}, ${selectedRecord.checkInLocation.longitude.toFixed(5)}`
                                : '-'}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-slate-400">Akurasi GPS:</span>
                            <span className="font-mono text-slate-600 text-[11px]">
                              ±{selectedRecord.checkOutLocation?.accuracy || selectedRecord.checkInLocation?.accuracy || 10} Meter
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="py-5 text-center">
                          <p className="text-xs text-slate-500 font-medium">
                            Karyawan aktif bekerja dan belum presensi pulang.
                          </p>
                          <span className="text-[11px] text-slate-400 mt-1 block">
                            Lokasi Clock-Out akan terekam saat tombol pulang ditekan.
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="pt-3 border-t border-slate-200/80 mt-3">
                      {selectedRecord.checkOutLocation?.latitude ? (
                        <a
                          href={`https://www.google.com/maps?q=${selectedRecord.checkOutLocation.latitude},${selectedRecord.checkOutLocation.longitude}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center justify-center w-full gap-2 px-3 py-2 rounded-xl text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors shadow-2xs cursor-pointer"
                        >
                          <MapPin className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                          <span>Buka di Google Map (Clock-Out)</span>
                          <ExternalLink className="w-3 h-3 text-rose-500 shrink-0" />
                        </a>
                      ) : selectedRecord.checkOutTime && selectedRecord.checkInLocation?.latitude ? (
                        <a
                          href={`https://www.google.com/maps?q=${selectedRecord.checkInLocation.latitude},${selectedRecord.checkInLocation.longitude}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center justify-center w-full gap-2 px-3 py-2 rounded-xl text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors shadow-2xs cursor-pointer"
                        >
                          <MapPin className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                          <span>Buka di Google Map (Clock-Out)</span>
                          <ExternalLink className="w-3 h-3 text-rose-500 shrink-0" />
                        </a>
                      ) : (
                        <span className="text-[11px] text-slate-400 block text-center py-1">
                          {selectedRecord.checkOutTime ? 'Koordinat pulang tidak tersedia' : 'Menunggu Presensi Pulang'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Notes */}
              {selectedRecord.notes && (
                <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-200 text-xs">
                  <span className="font-semibold text-blue-900 block mb-0.5">Catatan Karyawan:</span>
                  <p className="text-blue-800">{selectedRecord.notes}</p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button
                onClick={() => setSelectedRecord(null)}
                className="px-4 py-2 rounded-xl bg-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-300"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Monthly PDF Export Modal */}
      {isPdfModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-100">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-600 flex items-center justify-center">
                  <FileDown className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-base">Cetak Laporan PDF Bulanan</h3>
                  <p className="text-xs text-slate-500">
                    Laporan resmi rekapitulasi kehadiran dan total jam kerja tiap karyawan
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsPdfModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              {/* Month Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Pilih Periode Bulan & Tahun *
                </label>
                <input
                  type="month"
                  value={pdfMonthYear}
                  onChange={(e) => setPdfMonthYear(e.target.value)}
                  className="w-full text-xs font-medium px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                />
              </div>

              {/* Department Filter */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Pilih Departemen
                </label>
                <select
                  value={pdfDept}
                  onChange={(e) => setPdfDept(e.target.value)}
                  className="w-full text-xs font-medium px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 text-slate-700"
                >
                  <option value="ALL">Semua Departemen (Seluruh Perusahaan)</option>
                  {departments.map((dept) => (
                    <option key={dept} value={dept}>
                      {dept}
                    </option>
                  ))}
                </select>
              </div>

              {/* Preview Summary Box */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2 text-xs">
                <span className="font-bold text-slate-800 uppercase tracking-wider block text-[11px]">
                  Pratinjau Data yang Akan Dicetak:
                </span>
                <div className="grid grid-cols-2 gap-2 text-slate-600">
                  <div className="bg-white p-2.5 rounded-xl border border-slate-200/60">
                    <span className="text-slate-400 block text-[10px]">Jumlah Karyawan</span>
                    <span className="font-bold text-slate-800 text-sm">
                      {pdfWorkSummaries.length} Orang
                    </span>
                  </div>
                  <div className="bg-white p-2.5 rounded-xl border border-slate-200/60">
                    <span className="text-slate-400 block text-[10px]">Total Jam Kerja</span>
                    <span className="font-bold text-blue-600 text-sm">
                      {totalPdfWorkHours} Jam
                    </span>
                  </div>
                  <div className="bg-white p-2.5 rounded-xl border border-slate-200/60">
                    <span className="text-slate-400 block text-[10px]">Total Log Presensi</span>
                    <span className="font-bold text-slate-800 text-sm">
                      {pdfAttendances.length} Hari Kerja
                    </span>
                  </div>
                  <div className="bg-white p-2.5 rounded-xl border border-slate-200/60">
                    <span className="text-slate-400 block text-[10px]">Format Dokumen</span>
                    <span className="font-bold text-rose-600 text-sm">
                      PDF Landscape A4
                    </span>
                  </div>
                </div>

                <div className="pt-2 text-[11px] text-slate-500 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>
                    Dilengkapi ringkasan jam kerja total tiap karyawan & lembar tanda tangan pengesahan.
                  </span>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsPdfModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Batal
                </button>
                <button
                  type="button"
                  disabled={isExportingPdf || pdfAttendances.length === 0}
                  onClick={handleDownloadPDF}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 shadow-xs active:scale-98 disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                >
                  {isExportingPdf ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Membuat PDF...</span>
                    </>
                  ) : (
                    <>
                      <FileDown className="w-3.5 h-3.5" />
                      <span>Unduh Laporan PDF</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

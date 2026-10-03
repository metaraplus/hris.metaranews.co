import React, { useState, useEffect, useMemo } from 'react';
import {
  CalendarDays,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  FileText,
  Upload,
  Image,
  Eye,
  Trash2,
  Filter,
  Search,
  Plus,
  X,
  UserCheck,
  Stethoscope,
  Palmtree,
  FileCheck2,
  Calendar,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';
import { LeaveRequest, LeaveType, LeaveStatus, AttendanceRecord } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { db, handleFirestoreError, OperationType } from '../../firebase/config';
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  limit,
} from 'firebase/firestore';

export const LeaveManagement: React.FC = () => {
  const { user, employee, isAdmin } = useAuth();
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter States
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [filterType, setFilterType] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Modal States
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Review Modal State (Admin)
  const [selectedReviewLeave, setSelectedReviewLeave] = useState<LeaveRequest | null>(null);
  const [reviewAction, setReviewAction] = useState<'approved' | 'rejected'>('approved');
  const [reviewNotes, setReviewNotes] = useState('');
  const [isProcessingReview, setIsProcessingReview] = useState(false);

  // Attachment Viewer Modal State
  const [viewAttachment, setViewAttachment] = useState<{ url: string; title: string } | null>(null);

  // Submission Form State
  const [leaveType, setLeaveType] = useState<LeaveType>('sick');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [attachmentDataUrl, setAttachmentDataUrl] = useState<string | null>(null);
  const [attachmentFileName, setAttachmentFileName] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);

  // Set default start/end date to today on mount
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    setStartDate(today);
    setEndDate(today);
  }, []);

  // Real-time synchronization with Firestore
  useEffect(() => {
    if (!user) return;
    setLoading(true);

    const leavesCol = collection(db, 'leaves');
    // Admin gets all leaves, employee gets their own leaves
    const q = isAdmin
      ? query(leavesCol, limit(200))
      : query(leavesCol, where('userId', '==', user.uid), limit(100));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: LeaveRequest[] = [];
        snapshot.forEach((docSnap) => {
          list.push({ ...(docSnap.data() as LeaveRequest), id: docSnap.id });
        });
        // Sort newest first
        list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setLeaves(list);
        setLoading(false);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'leaves');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user, isAdmin]);

  // Calculate duration in calendar days
  const calculatedDuration = useMemo(() => {
    if (!startDate || !endDate) return 1;
    const start = new Date(startDate).getTime();
    const end = new Date(endDate).getTime();
    if (end < start) return 0;
    const diffDays = Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1;
    return Math.max(1, diffDays);
  }, [startDate, endDate]);

  // Handle file attachment selection (e.g. Doctor's Note / Surat Izin)
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setFormError('Ukuran file maksimal 2 MB');
      return;
    }

    setAttachmentFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      setAttachmentDataUrl(reader.result as string);
      setFormError(null);
    };
    reader.readAsDataURL(file);
  };

  // Submit Leave Request
  const handleSubmitLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!startDate || !endDate) {
      setFormError('Silakan pilih tanggal mulai dan berakhir');
      return;
    }
    if (new Date(endDate) < new Date(startDate)) {
      setFormError('Tanggal berakhir tidak boleh sebelum tanggal mulai');
      return;
    }
    if (!reason.trim()) {
      setFormError('Silakan masukkan alasan permohonan');
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    try {
      const leaveId = `leave_${user.uid}_${Date.now()}`;
      const now = new Date().toISOString();

      const newLeave: LeaveRequest = {
        id: leaveId,
        employeeId: employee?.id || user.uid,
        userId: user.uid,
        employeeName: employee?.name || user.displayName || 'Karyawan',
        employeeNumber: employee?.employeeNumber || 'EMP-0001',
        department: employee?.department || 'Operasional',
        type: leaveType,
        startDate,
        endDate,
        durationDays: calculatedDuration,
        reason: reason.trim(),
        attachmentUrl: attachmentDataUrl || undefined,
        attachmentName: attachmentFileName || undefined,
        status: 'pending',
        createdAt: now,
        updatedAt: now,
      };

      // Clean payload for undefined values
      const cleanPayload: any = {};
      for (const [k, v] of Object.entries(newLeave)) {
        if (v !== undefined) {
          cleanPayload[k] = v;
        }
      }

      await setDoc(doc(db, 'leaves', leaveId), cleanPayload);

      setSubmitSuccess('Permohonan izin/cuti berhasil diajukan dan sedang menunggu persetujuan HR.');
      setIsSubmitModalOpen(false);
      setReason('');
      setAttachmentDataUrl(null);
      setAttachmentFileName('');

      setTimeout(() => setSubmitSuccess(null), 6000);
    } catch (err) {
      console.error('Error submitting leave:', err);
      handleFirestoreError(err, OperationType.CREATE, 'leaves');
      setFormError('Gagal mengajukan izin. Silakan coba kembali.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open Admin Review Modal
  const openReviewModal = (leave: LeaveRequest, action: 'approved' | 'rejected') => {
    setSelectedReviewLeave(leave);
    setReviewAction(action);
    setReviewNotes('');
  };

  // Execute Review (Approve or Reject)
  const handleExecuteReview = async () => {
    if (!selectedReviewLeave || !user) return;
    setIsProcessingReview(true);

    try {
      const now = new Date().toISOString();
      const adminName = employee?.name || user.displayName || user.email || 'HR Administrator';

      // 1. Update Leave doc
      await updateDoc(doc(db, 'leaves', selectedReviewLeave.id), {
        status: reviewAction,
        reviewedBy: adminName,
        reviewedByUid: user.uid,
        reviewedAt: now,
        reviewNotes: reviewNotes.trim() || (reviewAction === 'approved' ? 'Disetujui oleh HR' : 'Ditolak oleh HR'),
        updatedAt: now,
      });

      // 2. If approved, generate attendance entries for the date range so it syncs with dashboard
      if (reviewAction === 'approved') {
        const start = new Date(selectedReviewLeave.startDate);
        const end = new Date(selectedReviewLeave.endDate);
        const curDate = new Date(start);

        const attendanceStatusMap: Record<LeaveType, AttendanceRecord['status']> = {
          sick: 'sick',
          annual: 'annual_leave',
          permit: 'permit',
        };

        const attStatus = attendanceStatusMap[selectedReviewLeave.type] || 'permit';
        const typeLabelMap: Record<LeaveType, string> = {
          sick: 'Sakit',
          annual: 'Cuti Tahunan',
          permit: 'Izin',
        };

        while (curDate <= end) {
          const dateStr = curDate.toISOString().split('T')[0];
          const attDocId = `${selectedReviewLeave.userId}_${dateStr}`;

          const attendancePayload: Partial<AttendanceRecord> = {
            id: attDocId,
            employeeId: selectedReviewLeave.employeeId,
            userId: selectedReviewLeave.userId,
            employeeName: selectedReviewLeave.employeeName,
            employeeNumber: selectedReviewLeave.employeeNumber,
            department: selectedReviewLeave.department,
            date: dateStr,
            status: attStatus,
            leaveId: selectedReviewLeave.id,
            notes: `${typeLabelMap[selectedReviewLeave.type]} Disetujui: ${selectedReviewLeave.reason}`,
            createdAt: now,
            updatedAt: now,
          };

          const cleanAtt: any = {};
          for (const [k, v] of Object.entries(attendancePayload)) {
            if (v !== undefined) cleanAtt[k] = v;
          }

          // Merge or create attendance document
          await setDoc(doc(db, 'attendances', attDocId), cleanAtt, { merge: true });
          curDate.setDate(curDate.getDate() + 1);
        }
      }

      setSelectedReviewLeave(null);
    } catch (err) {
      console.error('Error reviewing leave:', err);
      handleFirestoreError(err, OperationType.UPDATE, `leaves/${selectedReviewLeave.id}`);
    } finally {
      setIsProcessingReview(false);
    }
  };

  // Cancel pending request (for employees)
  const handleCancelLeave = async (leaveId: string) => {
    if (!window.confirm('Batalkan pengajuan izin ini?')) return;
    try {
      await deleteDoc(doc(db, 'leaves', leaveId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `leaves/${leaveId}`);
    }
  };

  // Filtered Leave List
  const filteredLeaves = useMemo(() => {
    return leaves.filter((leave) => {
      // Filter status
      if (filterStatus !== 'ALL' && leave.status !== filterStatus) return false;
      // Filter type
      if (filterType !== 'ALL' && leave.type !== filterType) return false;
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = leave.employeeName.toLowerCase().includes(q);
        const matchNip = leave.employeeNumber?.toLowerCase().includes(q);
        const matchDept = leave.department?.toLowerCase().includes(q);
        const matchReason = leave.reason?.toLowerCase().includes(q);
        if (!matchName && !matchNip && !matchDept && !matchReason) return false;
      }
      return true;
    });
  }, [leaves, filterStatus, filterType, searchQuery]);

  // Counts
  const totalCount = leaves.length;
  const pendingCount = leaves.filter((l) => l.status === 'pending').length;
  const approvedCount = leaves.filter((l) => l.status === 'approved').length;
  const rejectedCount = leaves.filter((l) => l.status === 'rejected').length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
      {/* Top Banner Success Notification */}
      {submitSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-center justify-between shadow-xs animate-in fade-in">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span className="text-sm font-semibold">{submitSuccess}</span>
          </div>
          <button onClick={() => setSubmitSuccess(null)} className="p-1 hover:text-emerald-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Pengajuan & Pengelolaan Izin / Cuti
            </h1>
            {isAdmin && pendingCount > 0 && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
                {pendingCount} Menunggu HR
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500 mt-1">
            {isAdmin
              ? 'Kelola, setujui, atau tolak permohonan izin sakit, cuti tahunan, dan izin khusus karyawan'
              : 'Ajukan permohonan sakit, cuti tahunan, atau izin keperluan dan pantau status persetujuan HR'}
          </p>
        </div>

        <button
          onClick={() => setIsSubmitModalOpen(true)}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm shadow-xs active:scale-98 transition-all shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Ajukan Izin / Cuti</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Total Pengajuan
            </span>
            <FileText className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-bold text-slate-800 mt-1">{totalCount}</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-amber-200 shadow-xs bg-amber-50/20">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-700 uppercase tracking-wider">
              Menunggu Review
            </span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-bold text-amber-700 mt-1">{pendingCount}</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-emerald-200 shadow-xs bg-emerald-50/20">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">
              Disetujui
            </span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-emerald-700 mt-1">{approvedCount}</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Ditolak
            </span>
            <XCircle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-2xl font-bold text-slate-800 mt-1">{rejectedCount}</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari nama karyawan, NIP, atau alasan..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>

          {/* Type Filter */}
          <div className="flex items-center gap-2 overflow-x-auto">
            <span className="text-xs text-slate-400 font-medium shrink-0">Tipe:</span>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 font-semibold focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="ALL">Semua Jenis</option>
              <option value="sick">🩺 Sakit</option>
              <option value="annual">🌴 Cuti Tahunan</option>
              <option value="permit">📝 Izin Khusus</option>
            </select>

            {/* Status Filter */}
            <span className="text-xs text-slate-400 font-medium shrink-0 ml-1">Status:</span>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 font-semibold focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="ALL">Semua Status</option>
              <option value="pending">⏳ Menunggu Persetujuan</option>
              <option value="approved">✅ Disetujui</option>
              <option value="rejected">❌ Ditolak</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Table / List */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[11px] tracking-wider">
                <th className="py-3 px-4">Karyawan</th>
                <th className="py-3 px-4">Jenis Permohonan</th>
                <th className="py-3 px-4">Rentang Tanggal</th>
                <th className="py-3 px-4">Durasi</th>
                <th className="py-3 px-4">Alasan & Lampiran</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-center">Aksi / Tindakan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 text-sm">
                    Memuat data permohonan izin/cuti...
                  </td>
                </tr>
              ) : filteredLeaves.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 text-sm">
                    Tidak ada pengajuan izin atau cuti yang cocok dengan filter.
                  </td>
                </tr>
              ) : (
                filteredLeaves.map((leave) => {
                  const isOwner = user?.uid === leave.userId;

                  return (
                    <tr key={leave.id} className="hover:bg-slate-50/60 transition-colors">
                      {/* Employee Info */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900">{leave.employeeName}</div>
                        <div className="text-xs text-slate-500 font-mono">
                          {leave.employeeNumber} • {leave.department}
                        </div>
                      </td>

                      {/* Type Badge */}
                      <td className="py-3.5 px-4">
                        {leave.type === 'sick' && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
                            <Stethoscope className="w-3.5 h-3.5" />
                            <span>Sakit</span>
                          </span>
                        )}
                        {leave.type === 'annual' && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                            <Palmtree className="w-3.5 h-3.5" />
                            <span>Cuti Tahunan</span>
                          </span>
                        )}
                        {leave.type === 'permit' && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200">
                            <FileCheck2 className="w-3.5 h-3.5" />
                            <span>Izin Khusus</span>
                          </span>
                        )}
                      </td>

                      {/* Date Range */}
                      <td className="py-3.5 px-4 font-mono text-slate-700 text-xs">
                        <div className="font-semibold text-slate-900">{leave.startDate}</div>
                        {leave.startDate !== leave.endDate && (
                          <div className="text-slate-400">s/d {leave.endDate}</div>
                        )}
                      </td>

                      {/* Duration */}
                      <td className="py-3.5 px-4 font-semibold text-slate-800">
                        {leave.durationDays} Hari
                      </td>

                      {/* Reason & Attachment */}
                      <td className="py-3.5 px-4 max-w-xs">
                        <p className="text-xs text-slate-700 line-clamp-2 leading-relaxed">
                          {leave.reason}
                        </p>
                        {leave.attachmentUrl && (
                          <button
                            onClick={() =>
                              setViewAttachment({
                                url: leave.attachmentUrl!,
                                title: `Lampiran Bukti - ${leave.employeeName} (${leave.type})`,
                              })
                            }
                            className="inline-flex items-center gap-1 mt-1 text-[11px] font-bold text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                          >
                            <Image className="w-3 h-3" />
                            <span>Lihat Surat / Bukti</span>
                          </button>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        {leave.status === 'pending' && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
                            <Clock className="w-3.5 h-3.5" />
                            <span>Menunggu</span>
                          </span>
                        )}
                        {leave.status === 'approved' && (
                          <div>
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Disetujui</span>
                            </span>
                            {leave.reviewedBy && (
                              <div className="text-[10px] text-slate-400 mt-0.5">
                                Oleh: {leave.reviewedBy}
                              </div>
                            )}
                          </div>
                        )}
                        {leave.status === 'rejected' && (
                          <div>
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-800 border border-rose-200">
                              <XCircle className="w-3.5 h-3.5" />
                              <span>Ditolak</span>
                            </span>
                            {leave.reviewNotes && (
                              <div className="text-[10px] text-rose-600 mt-0.5 line-clamp-1">
                                {leave.reviewNotes}
                              </div>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* Admin Review Action Buttons */}
                          {isAdmin && leave.status === 'pending' && (
                            <>
                              <button
                                onClick={() => openReviewModal(leave, 'approved')}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-2xs transition-colors cursor-pointer"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Setujui</span>
                              </button>
                              <button
                                onClick={() => openReviewModal(leave, 'rejected')}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 shadow-2xs transition-colors cursor-pointer"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                                <span>Tolak</span>
                              </button>
                            </>
                          )}

                          {/* Employee can cancel their own pending request */}
                          {isOwner && leave.status === 'pending' && (
                            <button
                              onClick={() => handleCancelLeave(leave.id)}
                              title="Batalkan Pengajuan"
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Batalkan</span>
                            </button>
                          )}

                          {/* Finished review tag */}
                          {leave.status !== 'pending' && (
                            <span className="text-xs text-slate-400 italic">Selesai</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal 1: Submit Leave Request */}
      {isSubmitModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-100">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
                  <CalendarDays className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-base">Ajukan Izin / Cuti</h3>
                  <p className="text-xs text-slate-500">
                    Isi rincian permohonan untuk persetujuan Manajemen HR
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsSubmitModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmitLeave} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              {formError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Leave Type Selector */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                  Jenis Permohonan *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setLeaveType('sick')}
                    className={`p-3 rounded-xl border text-center transition-all ${
                      leaveType === 'sick'
                        ? 'border-rose-500 bg-rose-50/70 text-rose-800 font-bold shadow-2xs ring-2 ring-rose-500/20'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <Stethoscope className="w-5 h-5 mx-auto mb-1 text-rose-600" />
                    <span className="text-xs block">Sakit</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setLeaveType('annual')}
                    className={`p-3 rounded-xl border text-center transition-all ${
                      leaveType === 'annual'
                        ? 'border-blue-500 bg-blue-50/70 text-blue-800 font-bold shadow-2xs ring-2 ring-blue-500/20'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <Palmtree className="w-5 h-5 mx-auto mb-1 text-blue-600" />
                    <span className="text-xs block">Cuti Tahunan</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setLeaveType('permit')}
                    className={`p-3 rounded-xl border text-center transition-all ${
                      leaveType === 'permit'
                        ? 'border-purple-500 bg-purple-50/70 text-purple-800 font-bold shadow-2xs ring-2 ring-purple-500/20'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <FileCheck2 className="w-5 h-5 mx-auto mb-1 text-purple-600" />
                    <span className="text-xs block">Izin Khusus</span>
                  </button>
                </div>
              </div>

              {/* Date Range */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Tanggal Mulai *
                  </label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => {
                      setStartDate(e.target.value);
                      if (endDate && new Date(e.target.value) > new Date(endDate)) {
                        setEndDate(e.target.value);
                      }
                    }}
                    className="w-full text-xs font-medium px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Tanggal Berakhir *
                  </label>
                  <input
                    type="date"
                    required
                    value={endDate}
                    min={startDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full text-xs font-medium px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Calculated Duration Display */}
              <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-200/60 flex items-center justify-between text-xs">
                <span className="text-blue-800 font-medium">Estimasi Durasi:</span>
                <span className="font-bold text-blue-900 font-mono text-sm">
                  {calculatedDuration} Hari Kerja
                </span>
              </div>

              {/* Reason Input */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Alasan Permohonan *
                </label>
                <textarea
                  required
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Contoh: Mengalami demam dan disarankan istirahat dokter / Menghadiri acara keluarga mendesak..."
                  className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              {/* File Attachment / Surat Dokter */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Lampiran Bukti (Surat Dokter / Dokumen Pendukung)
                </label>
                <div className="mt-1 flex justify-center px-4 pt-4 pb-4 border-2 border-slate-200 border-dashed rounded-xl hover:border-slate-300 transition-colors bg-slate-50/50">
                  <div className="space-y-1 text-center">
                    {attachmentDataUrl ? (
                      <div>
                        <div className="w-20 h-20 mx-auto rounded-lg overflow-hidden border border-slate-200 mb-2">
                          <img
                            src={attachmentDataUrl}
                            alt="Preview"
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <p className="text-xs text-slate-600 font-medium truncate max-w-[200px]">
                          {attachmentFileName}
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            setAttachmentDataUrl(null);
                            setAttachmentFileName('');
                          }}
                          className="mt-1 text-xs text-rose-600 font-semibold hover:underline"
                        >
                          Hapus Foto
                        </button>
                      </div>
                    ) : (
                      <>
                        <Upload className="mx-auto h-7 w-7 text-slate-400" />
                        <div className="flex text-xs text-slate-600">
                          <label className="relative cursor-pointer rounded-md font-bold text-blue-600 hover:text-blue-500 focus-within:outline-hidden">
                            <span>Pilih file gambar</span>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={handleFileChange}
                              className="sr-only"
                            />
                          </label>
                          <p className="pl-1">atau drag and drop</p>
                        </div>
                        <p className="text-[11px] text-slate-400">PNG, JPG hingga 2MB</p>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsSubmitModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-xs disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                >
                  {isSubmitting ? 'Mengirim...' : 'Kirim Pengajuan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Admin Review Confirmation Modal */}
      {selectedReviewLeave && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full overflow-hidden shadow-2xl border border-slate-100">
            {/* Review Header */}
            <div
              className={`px-6 py-4 border-b flex items-center justify-between ${
                reviewAction === 'approved' ? 'bg-emerald-50/80 border-emerald-100' : 'bg-rose-50/80 border-rose-100'
              }`}
            >
              <div className="flex items-center gap-2">
                {reviewAction === 'approved' ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                ) : (
                  <XCircle className="w-5 h-5 text-rose-600" />
                )}
                <div>
                  <h3 className="font-bold text-slate-800 text-sm">
                    {reviewAction === 'approved' ? 'Setujui Pengajuan Izin/Cuti' : 'Tolak Pengajuan Izin/Cuti'}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {selectedReviewLeave.employeeName} ({selectedReviewLeave.employeeNumber})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedReviewLeave(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Review Content */}
            <div className="p-6 space-y-4">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-400">Jenis:</span>
                  <span className="font-bold text-slate-800 uppercase">{selectedReviewLeave.type}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Rentang:</span>
                  <span className="font-mono text-slate-800 font-semibold">
                    {selectedReviewLeave.startDate} s/d {selectedReviewLeave.endDate} ({selectedReviewLeave.durationDays} hari)
                  </span>
                </div>
                <div className="border-t border-slate-200 pt-1 mt-1">
                  <span className="text-slate-400 block mb-0.5">Alasan Karyawan:</span>
                  <p className="text-slate-700 italic">{selectedReviewLeave.reason}</p>
                </div>
                {selectedReviewLeave.attachmentUrl && (
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() =>
                        setViewAttachment({
                          url: selectedReviewLeave.attachmentUrl!,
                          title: `Bukti Surat - ${selectedReviewLeave.employeeName}`,
                        })
                      }
                      className="text-xs text-blue-600 font-bold hover:underline inline-flex items-center gap-1"
                    >
                      <Image className="w-3.5 h-3.5" />
                      <span>Buka Lampiran Bukti Dokter</span>
                    </button>
                  </div>
                )}
              </div>

              {reviewAction === 'approved' && (
                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-xs text-emerald-800">
                  <span className="font-bold block mb-0.5">Sinkronisasi Absensi Otomatis:</span>
                  Persetujuan ini akan otomatis memperbarui rekapitulasi kehadiran karyawan pada tanggal tersebut dengan status resmi (Sakit / Cuti / Izin).
                </div>
              )}

              {/* Review Notes Input */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Catatan HR (Opsional)
                </label>
                <textarea
                  rows={2}
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  placeholder={
                    reviewAction === 'approved'
                      ? 'Contoh: Disetujui, lekas sembuh / Selamat berlibur...'
                      : 'Contoh: Alasan penolakan, mohon koordinasikan kembali dengan supervisor...'
                  }
                  className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              {/* Review Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSelectedReviewLeave(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Batal
                </button>
                <button
                  type="button"
                  disabled={isProcessingReview}
                  onClick={handleExecuteReview}
                  className={`px-4 py-2 rounded-xl text-xs font-bold text-white shadow-xs cursor-pointer ${
                    reviewAction === 'approved'
                      ? 'bg-emerald-600 hover:bg-emerald-700'
                      : 'bg-rose-600 hover:bg-rose-700'
                  }`}
                >
                  {isProcessingReview
                    ? 'Memproses...'
                    : reviewAction === 'approved'
                    ? 'Konfirmasi Setujui'
                    : 'Konfirmasi Tolak'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal 3: Attachment Lightbox Image Viewer */}
      {viewAttachment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-2xl w-full overflow-hidden shadow-2xl border border-slate-800">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
              <span className="font-bold text-slate-800 text-sm">{viewAttachment.title}</span>
              <button
                onClick={() => setViewAttachment(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 bg-slate-900 flex items-center justify-center max-h-[75vh] overflow-auto">
              <img
                src={viewAttachment.url}
                alt="Lampiran Bukti"
                className="max-h-[70vh] w-auto object-contain rounded-lg shadow-md"
              />
            </div>
            <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex justify-end">
              <button
                onClick={() => setViewAttachment(null)}
                className="px-4 py-1.5 rounded-xl bg-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-300"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

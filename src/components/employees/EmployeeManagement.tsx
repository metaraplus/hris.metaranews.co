import React, { useState, useEffect } from 'react';
import {
  Users,
  UserPlus,
  Search,
  Shield,
  CheckCircle2,
  AlertCircle,
  Camera,
  Trash2,
  RefreshCw,
  Mail,
  Building,
  Briefcase,
  Sparkles,
  Pencil,
  AlertTriangle,
  X,
  Phone,
} from 'lucide-react';
import { Employee } from '../../types';
import { db, handleFirestoreError, OperationType } from '../../firebase/config';
import {
  collection,
  onSnapshot,
  setDoc,
  doc,
  deleteDoc,
  updateDoc,
} from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';

interface EmployeeManagementProps {
  onOpenFaceRegistrationForEmployee: (emp: Employee) => void;
}

const DEPARTMENTS = [
  'Redaksi & Konten',
  'Manajemen & HR',
  'Operasional',
  'Teknologi Informasi',
  'Pemasaran Digital',
  'Keuangan & Akuntansi',
  'Customer Support',
  'Lainnya',
];

export const EmployeeManagement: React.FC<EmployeeManagementProps> = ({
  onOpenFaceRegistrationForEmployee,
}) => {
  const { user, isAdmin } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Add Employee Form State
  const [showAddModal, setShowAddModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    employeeNumber: '',
    department: 'Redaksi & Konten',
    position: 'Jurnalis / Kontributor',
    phone: '',
    role: 'employee' as 'admin' | 'employee',
  });

  // Edit Employee Form State
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [editFormData, setEditFormData] = useState({
    name: '',
    email: '',
    employeeNumber: '',
    department: 'Redaksi & Konten',
    position: '',
    phone: '',
    role: 'employee' as 'admin' | 'employee',
    resetFace: false,
  });

  // Delete Confirmation State
  const [deletingEmployee, setDeletingEmployee] = useState<Employee | null>(null);

  // Status Action Message (Toast/Banner)
  const [actionMessage, setActionMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Auto-dismiss action message
  useEffect(() => {
    if (actionMessage) {
      const timer = setTimeout(() => {
        setActionMessage(null);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [actionMessage]);

  // Real-time listener
  useEffect(() => {
    if (!user) return;
    setLoading(true);

    const empCollection = collection(db, 'employees');
    const unsubscribe = onSnapshot(
      empCollection,
      (snapshot) => {
        const list: Employee[] = [];
        snapshot.forEach((d) => {
          list.push({ ...(d.data() as Employee), id: d.id });
        });
        setEmployees(list);
        setLoading(false);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'employees');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  // Seed sample team if empty
  const handleSeedDemoEmployees = async () => {
    setSubmitting(true);
    const sampleEmployees: Partial<Employee>[] = [
      {
        uid: 'demo_emp_1',
        employeeNumber: 'EMP-2026-002',
        name: 'Budi Santoso',
        email: 'budi.santoso@metaranews.co',
        department: 'Redaksi & Konten',
        position: 'Editor Berita',
        phone: '081234567890',
        role: 'employee',
        faceRegistered: false,
      },
      {
        uid: 'demo_emp_2',
        employeeNumber: 'EMP-2026-003',
        name: 'Siti Rahmawati',
        email: 'siti.rahmawati@metaranews.co',
        department: 'Keuangan & Akuntansi',
        position: 'Staff Keuangan',
        phone: '081398765432',
        role: 'employee',
        faceRegistered: false,
      },
      {
        uid: 'demo_emp_3',
        employeeNumber: 'EMP-2026-004',
        name: 'Rian Pratama',
        email: 'rian.pratama@metaranews.co',
        department: 'Pemasaran Digital',
        position: 'Digital Marketer',
        phone: '082155667788',
        role: 'employee',
        faceRegistered: false,
      },
    ];

    try {
      for (const emp of sampleEmployees) {
        const docRef = doc(db, 'employees', emp.uid!);
        await setDoc(docRef, {
          ...emp,
          id: emp.uid,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
      setActionMessage({
        type: 'success',
        text: '3 Data karyawan contoh berhasil ditambahkan.',
      });
    } catch (e: any) {
      console.error('Seed error:', e);
      setActionMessage({
        type: 'error',
        text: 'Gagal menambahkan data contoh: ' + (e.message || String(e)),
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Create new employee
  const handleCreateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.email) return;

    setSubmitting(true);
    const newUid = `emp_${Date.now()}`;
    const autoNip =
      formData.employeeNumber.trim() ||
      `EMP-${Math.floor(1000 + Math.random() * 9000)}`;

    try {
      const docRef = doc(db, 'employees', newUid);
      const newRecord: Employee = {
        id: newUid,
        uid: newUid,
        employeeNumber: autoNip,
        name: formData.name.trim(),
        email: formData.email.trim(),
        department: formData.department,
        position: formData.position.trim() || 'Staff Karyawan',
        phone: formData.phone.trim(),
        role: formData.role,
        faceRegistered: false,
        facePhotoUrl: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await setDoc(docRef, newRecord);
      setShowAddModal(false);
      setFormData({
        name: '',
        email: '',
        employeeNumber: '',
        department: 'Redaksi & Konten',
        position: 'Jurnalis / Kontributor',
        phone: '',
        role: 'employee',
      });
      setActionMessage({
        type: 'success',
        text: `Karyawan baru "${newRecord.name}" berhasil didaftarkan.`,
      });
    } catch (err: any) {
      console.error('Create error:', err);
      setActionMessage({
        type: 'error',
        text: err.message || 'Gagal menyimpan karyawan baru.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Open Edit Modal
  const handleStartEdit = (emp: Employee) => {
    setEditingEmployee(emp);
    setEditFormData({
      name: emp.name || '',
      email: emp.email || '',
      employeeNumber: emp.employeeNumber || '',
      department: emp.department || 'Redaksi & Konten',
      position: emp.position || '',
      phone: emp.phone || '',
      role: emp.role || 'employee',
      resetFace: false,
    });
  };

  // Save Edit Employee
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEmployee) return;

    setSubmitting(true);
    try {
      const docRef = doc(db, 'employees', editingEmployee.id);
      const updateData: any = {
        name: editFormData.name.trim(),
        email: editFormData.email.trim(),
        employeeNumber: editFormData.employeeNumber.trim(),
        department: editFormData.department,
        position: editFormData.position.trim(),
        phone: editFormData.phone.trim(),
        role: editFormData.role,
        updatedAt: new Date().toISOString(),
      };

      if (editFormData.resetFace) {
        updateData.faceRegistered = false;
        updateData.facePhotoUrl = '';
        updateData.faceDescriptor = '';
      }

      await updateDoc(docRef, updateData);
      setEditingEmployee(null);
      setActionMessage({
        type: 'success',
        text: `Data karyawan "${updateData.name}" berhasil diperbarui.`,
      });
    } catch (err: any) {
      console.error('Update employee error:', err);
      setActionMessage({
        type: 'error',
        text: err.message || 'Gagal memperbarui data karyawan.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Confirm and Delete Employee
  const handleConfirmDelete = async () => {
    if (!deletingEmployee) return;
    setSubmitting(true);
    try {
      await deleteDoc(doc(db, 'employees', deletingEmployee.id));
      setActionMessage({
        type: 'success',
        text: `Data karyawan "${deletingEmployee.name}" telah dihapus.`,
      });
      setDeletingEmployee(null);
    } catch (err: any) {
      console.error('Delete employee error:', err);
      setActionMessage({
        type: 'error',
        text: err.message || 'Gagal menghapus karyawan.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Filtered list
  const filtered = employees.filter((e) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      e.name.toLowerCase().includes(q) ||
      e.employeeNumber?.toLowerCase().includes(q) ||
      e.department?.toLowerCase().includes(q) ||
      e.email?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      {/* Toast Alert Notification */}
      {actionMessage && (
        <div
          className={`mb-6 p-4 rounded-2xl flex items-center justify-between gap-3 text-sm font-medium shadow-md transition-all animate-in fade-in slide-in-from-top-2 ${
            actionMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {actionMessage.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            )}
            <span>{actionMessage.text}</span>
          </div>
          <button
            onClick={() => setActionMessage(null)}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-red-100 text-red-600 flex items-center justify-center shadow-xs">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                Data Master Karyawan
              </h1>
              <p className="text-xs sm:text-sm text-slate-500">
                Kelola profil kepegawaian, verifikasi biometrik, hak akses, dan divisi
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {employees.length === 0 && !loading && (
            <button
              onClick={handleSeedDemoEmployees}
              disabled={submitting}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-300 text-slate-700 bg-white hover:bg-slate-50 text-xs font-semibold shadow-xs transition-all cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>Isi Data Contoh</span>
            </button>
          )}

          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 active:bg-red-800 text-white text-xs sm:text-sm font-semibold shadow-md shadow-red-500/20 transition-all cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>Tambah Karyawan</span>
          </button>
        </div>
      </div>

      {/* Search & Stats Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari berdasarkan nama, NIP, atau departemen..."
            className="w-full pl-10 pr-3.5 py-2 rounded-xl text-sm border border-slate-200 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 bg-slate-50/50"
          />
        </div>

        <div className="text-xs font-semibold text-slate-500">
          Total Terdaftar: <span className="text-slate-800 font-bold">{employees.length} Karyawan</span>
        </div>
      </div>

      {/* Employee List Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase font-semibold text-slate-500 tracking-wider">
              <tr>
                <th className="py-3.5 px-4">Karyawan</th>
                <th className="py-3.5 px-4">Kontak & Email</th>
                <th className="py-3.5 px-4">Departemen & Jabatan</th>
                <th className="py-3.5 px-4">Peran (Role)</th>
                <th className="py-3.5 px-4">Biometrik Wajah</th>
                <th className="py-3.5 px-4 text-center">Aksi Manajemen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-red-500" />
                    <span>Memuat daftar karyawan...</span>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="font-semibold text-slate-700 text-sm">Belum ada karyawan ditemukan</p>
                    <p className="text-xs text-slate-400 mt-1">
                      {searchQuery ? 'Coba ubah kata kunci pencarian Anda' : 'Klik "Tambah Karyawan" untuk menambahkan'}
                    </p>
                  </td>
                </tr>
              ) : (
                filtered.map((emp) => (
                  <tr key={emp.id} className="hover:bg-slate-50/80 transition-colors">
                    {/* Name & Photo */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        {emp.facePhotoUrl ? (
                          <img
                            src={emp.facePhotoUrl}
                            alt={emp.name}
                            className="w-10 h-10 rounded-full object-cover border border-slate-200 shadow-xs"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-red-100 text-red-700 font-bold flex items-center justify-center text-sm shadow-xs">
                            {emp.name?.[0] || 'K'}
                          </div>
                        )}
                        <div>
                          <div className="font-semibold text-slate-900">{emp.name}</div>
                          <div className="text-xs text-slate-400 font-mono">
                            NIP: {emp.employeeNumber}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Email & Phone */}
                    <td className="py-3.5 px-4">
                      <div className="text-xs text-slate-700 font-medium">{emp.email}</div>
                      <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                        <Phone className="w-3 h-3 text-slate-400" />
                        <span>{emp.phone || '-'}</span>
                      </div>
                    </td>

                    {/* Department & Position */}
                    <td className="py-3.5 px-4">
                      <div className="text-xs font-semibold text-slate-800">{emp.department}</div>
                      <div className="text-[11px] text-slate-500">{emp.position}</div>
                    </td>

                    {/* Role */}
                    <td className="py-3.5 px-4">
                      <span
                        className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                          emp.role === 'admin'
                            ? 'bg-red-100 text-red-800 border border-red-200'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {emp.role === 'admin' ? 'HR Admin' : 'Karyawan'}
                      </span>
                    </td>

                    {/* Face Registration Status */}
                    <td className="py-3.5 px-4">
                      {emp.faceRegistered ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Terdaftar</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                          <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                          <span>Belum Terdaftar</span>
                        </span>
                      )}
                    </td>

                    {/* Actions: Edit, Face, Delete */}
                    <td className="py-3.5 px-4 text-center">
                      <div className="inline-flex items-center gap-1.5">
                        {/* Tombol Edit */}
                        <button
                          type="button"
                          onClick={() => handleStartEdit(emp)}
                          title="Edit Data Karyawan"
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 transition-all cursor-pointer shadow-xs active:scale-95"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                          <span>Edit</span>
                        </button>

                        {/* Tombol Biometrik Wajah */}
                        <button
                          type="button"
                          onClick={() => onOpenFaceRegistrationForEmployee(emp)}
                          title="Daftarkan / Perbarui Foto Wajah"
                          className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200 cursor-pointer shadow-xs active:scale-95"
                        >
                          <Camera className="w-3.5 h-3.5" />
                        </button>

                        {/* Tombol Hapus */}
                        {emp.uid !== user?.uid ? (
                          <button
                            type="button"
                            onClick={() => setDeletingEmployee(emp)}
                            title="Hapus Karyawan"
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 transition-all cursor-pointer shadow-xs active:scale-95"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Hapus</span>
                          </button>
                        ) : (
                          <span
                            title="Akun sedang digunakan saat ini"
                            className="text-[11px] text-slate-400 italic px-1.5"
                          >
                            (Anda)
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ADD EMPLOYEE MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full max-h-[92vh] overflow-y-auto shadow-2xl border border-slate-100">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between sticky top-0 z-10">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-red-100 text-red-600 flex items-center justify-center">
                  <UserPlus className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-slate-800 text-base">Tambah Karyawan Baru</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateEmployee} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nama Lengkap *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Contoh: Ahmad Fauzi"
                  className="w-full px-3.5 py-2 rounded-xl text-sm border border-slate-200 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nomor Induk Pegawai (NIP)
                </label>
                <input
                  type="text"
                  value={formData.employeeNumber}
                  onChange={(e) => setFormData({ ...formData, employeeNumber: e.target.value })}
                  placeholder="Contoh: EMP-2026-005 (kosongkan untuk acak)"
                  className="w-full px-3.5 py-2 rounded-xl text-sm border border-slate-200 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Email Karyawan *
                </label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="ahmad.fauzi@metaranews.co"
                  className="w-full px-3.5 py-2 rounded-xl text-sm border border-slate-200 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Departemen
                  </label>
                  <select
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl text-xs border border-slate-200 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                  >
                    {DEPARTMENTS.map((dept) => (
                      <option key={dept} value={dept}>
                        {dept}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Peran (Role)
                  </label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
                    className="w-full px-3 py-2 rounded-xl text-xs border border-slate-200 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                  >
                    <option value="employee">Karyawan</option>
                    <option value="admin">HR Admin</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Jabatan / Posisi
                </label>
                <input
                  type="text"
                  value={formData.position}
                  onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                  placeholder="Contoh: Reporter Liputan Khusus"
                  className="w-full px-3.5 py-2 rounded-xl text-sm border border-slate-200 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nomor HP / WhatsApp
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="081234567890"
                  className="w-full px-3.5 py-2 rounded-xl text-sm border border-slate-200 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                />
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-red-600 text-white hover:bg-red-700 active:bg-red-800 shadow-md shadow-red-500/20 cursor-pointer"
                >
                  {submitting ? 'Menyimpan...' : 'Simpan Karyawan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT EMPLOYEE MODAL */}
      {editingEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full max-h-[92vh] overflow-y-auto shadow-2xl border border-slate-100">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between sticky top-0 z-10">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
                  <Pencil className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-base">Edit Data Karyawan</h3>
                  <p className="text-xs text-slate-400">
                    ID Dokumen: <span className="font-mono">{editingEmployee.id}</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingEmployee(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nama Lengkap *
                </label>
                <input
                  type="text"
                  required
                  value={editFormData.name}
                  onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl text-sm border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nomor Induk Pegawai (NIP) *
                </label>
                <input
                  type="text"
                  required
                  value={editFormData.employeeNumber}
                  onChange={(e) => setEditFormData({ ...editFormData, employeeNumber: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl text-sm border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Email Karyawan *
                </label>
                <input
                  type="email"
                  required
                  value={editFormData.email}
                  onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl text-sm border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Departemen
                  </label>
                  <select
                    value={editFormData.department}
                    onChange={(e) => setEditFormData({ ...editFormData, department: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl text-xs border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  >
                    {DEPARTMENTS.map((dept) => (
                      <option key={dept} value={dept}>
                        {dept}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Peran (Role)
                  </label>
                  <select
                    value={editFormData.role}
                    onChange={(e) => setEditFormData({ ...editFormData, role: e.target.value as any })}
                    className="w-full px-3 py-2 rounded-xl text-xs border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  >
                    <option value="employee">Karyawan</option>
                    <option value="admin">HR Admin</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Jabatan / Posisi
                </label>
                <input
                  type="text"
                  value={editFormData.position}
                  onChange={(e) => setEditFormData({ ...editFormData, position: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl text-sm border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nomor HP / WhatsApp
                </label>
                <input
                  type="tel"
                  value={editFormData.phone}
                  onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                  placeholder="081234567890"
                  className="w-full px-3.5 py-2 rounded-xl text-sm border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              {/* Face Biometric Status & Option to Reset */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Camera className="w-4 h-4 text-slate-500" />
                    <div>
                      <span className="text-xs font-semibold text-slate-800 block">
                        Status Biometrik Wajah
                      </span>
                      <span className="text-[11px] text-slate-500 block">
                        {editingEmployee.faceRegistered
                          ? 'Wajah telah terdaftar dalam sistem'
                          : 'Belum ada data biometrik'}
                      </span>
                    </div>
                  </div>
                  {editingEmployee.faceRegistered && (
                    <label className="flex items-center gap-1.5 cursor-pointer text-xs text-rose-600 font-semibold hover:text-rose-700">
                      <input
                        type="checkbox"
                        checked={editFormData.resetFace}
                        onChange={(e) =>
                          setEditFormData({ ...editFormData, resetFace: e.target.checked })
                        }
                        className="rounded text-rose-600 focus:ring-rose-500"
                      />
                      <span>Reset Foto Wajah</span>
                    </label>
                  )}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingEmployee(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800 shadow-md shadow-blue-500/20 cursor-pointer"
                >
                  {submitting ? 'Menyimpan...' : 'Simpan Perubahan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deletingEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full overflow-hidden shadow-2xl border border-slate-100 p-6 text-center">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <h3 className="text-lg font-bold text-slate-900 mb-1">
              Hapus Data Karyawan?
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 mb-4">
              Apakah Anda yakin ingin menghapus data karyawan berikut dari sistem HRIS?
            </p>

            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-left mb-6 space-y-1 text-xs">
              <div>
                <span className="text-slate-400">Nama: </span>
                <span className="font-bold text-slate-800">{deletingEmployee.name}</span>
              </div>
              <div>
                <span className="text-slate-400">NIP: </span>
                <span className="font-mono text-slate-700">{deletingEmployee.employeeNumber}</span>
              </div>
              <div>
                <span className="text-slate-400">Departemen: </span>
                <span className="text-slate-700">{deletingEmployee.department}</span>
              </div>
              <div>
                <span className="text-slate-400">Email: </span>
                <span className="text-slate-700">{deletingEmployee.email}</span>
              </div>
            </div>

            <p className="text-[11px] text-rose-600 mb-6 font-medium">
              * Perhatian: Tindakan ini permanen dan data profil yang dihapus tidak dapat dipulihkan.
            </p>

            <div className="flex items-center gap-2.5 justify-center">
              <button
                type="button"
                onClick={() => setDeletingEmployee(null)}
                disabled={submitting}
                className="flex-1 py-2.5 px-4 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100 border border-slate-200 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={submitting}
                className="flex-1 py-2.5 px-4 rounded-xl text-xs font-semibold bg-rose-600 text-white hover:bg-rose-700 active:bg-rose-800 shadow-md shadow-rose-500/20 cursor-pointer"
              >
                {submitting ? 'Menghapus...' : 'Ya, Hapus Karyawan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

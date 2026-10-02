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
} from 'lucide-react';
import { Employee } from '../../types';
import { db, handleFirestoreError, OperationType } from '../../firebase/config';
import {
  collection,
  onSnapshot,
  setDoc,
  doc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';

interface EmployeeManagementProps {
  onOpenFaceRegistrationForEmployee: (emp: Employee) => void;
}

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
    department: 'Teknologi Informasi',
    position: 'Software Engineer',
    phone: '',
    role: 'employee' as 'admin' | 'employee',
  });

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
        email: 'budi.santoso@metara.id',
        department: 'Operasional',
        position: 'Supervisor Lapangan',
        phone: '081234567890',
        role: 'employee',
        faceRegistered: false,
      },
      {
        uid: 'demo_emp_2',
        employeeNumber: 'EMP-2026-003',
        name: 'Siti Rahmawati',
        email: 'siti.rahmawati@metara.id',
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
        email: 'rian.pratama@metara.id',
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
    } catch (e) {
      console.error('Seed error:', e);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.email) return;

    setSubmitting(true);
    const newUid = `emp_${Date.now()}`;
    const newEmp: Employee = {
      id: newUid,
      uid: newUid,
      employeeNumber: formData.employeeNumber || `EMP-${Math.floor(1000 + Math.random() * 9000)}`,
      name: formData.name,
      email: formData.email,
      department: formData.department,
      position: formData.position,
      phone: formData.phone,
      role: formData.role,
      faceRegistered: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      await setDoc(doc(db, 'employees', newUid), newEmp);
      setShowAddModal(false);
      setFormData({
        name: '',
        email: '',
        employeeNumber: '',
        department: 'Teknologi Informasi',
        position: 'Software Engineer',
        phone: '',
        role: 'employee',
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `employees/${newUid}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteEmployee = async (id: string, name: string) => {
    if (confirm(`Apakah Anda yakin ingin menghapus data karyawan ${name}?`)) {
      try {
        await deleteDoc(doc(db, 'employees', id));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `employees/${id}`);
      }
    }
  };

  // Filtered
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
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Data Master Karyawan
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Manajemen profil karyawan dan registrasi identitas biometrik wajah
          </p>
        </div>

        <div className="flex items-center gap-2">
          {employees.length <= 1 && (
            <button
              onClick={handleSeedDemoEmployees}
              disabled={submitting}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 text-slate-700 font-semibold text-xs hover:bg-slate-200 transition-all"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Tambah Contoh Karyawan</span>
            </button>
          )}

          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 shadow-md shadow-blue-500/20 active:scale-98 transition-all"
          >
            <UserPlus className="w-4 h-4" />
            <span>Tambah Karyawan</span>
          </button>
        </div>
      </div>

      {/* Search & Counter */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari berdasarkan nama, NIP, atau departemen..."
            className="w-full pl-10 pr-3.5 py-2 rounded-xl text-sm border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-slate-50/50"
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
                <th className="py-3.5 px-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500" />
                    <span>Memuat daftar karyawan...</span>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="font-semibold text-slate-700 text-sm">Belum ada karyawan ditemukan</p>
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
                          <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-sm">
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
                      <div className="text-xs text-slate-700">{emp.email}</div>
                      <div className="text-[11px] text-slate-400">{emp.phone || '-'}</div>
                    </td>

                    {/* Department & Position */}
                    <td className="py-3.5 px-4">
                      <div className="text-xs font-semibold text-slate-800">{emp.department}</div>
                      <div className="text-[11px] text-slate-500">{emp.position}</div>
                    </td>

                    {/* Role */}
                    <td className="py-3.5 px-4">
                      <span
                        className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                          emp.role === 'admin'
                            ? 'bg-purple-100 text-purple-800 border border-purple-200'
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

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-center">
                      <div className="inline-flex items-center gap-1">
                        <button
                          onClick={() => onOpenFaceRegistrationForEmployee(emp)}
                          title="Daftarkan / Perbarui Foto Wajah"
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          <Camera className="w-4 h-4" />
                        </button>

                        {isAdmin && emp.uid !== user?.uid && (
                          <button
                            onClick={() => handleDeleteEmployee(emp.id, emp.name)}
                            title="Hapus Karyawan"
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
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

      {/* Add Employee Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full overflow-hidden shadow-2xl border border-slate-100">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
                  <UserPlus className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-slate-800 text-base">Tambah Karyawan Baru</h3>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
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
                  className="w-full px-3.5 py-2 rounded-xl text-sm border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
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
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="ahmad.fauzi@perusahaan.com"
                  className="w-full px-3.5 py-2 rounded-xl text-sm border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Departemen
                  </label>
                  <select
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl text-xs border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  >
                    <option value="Teknologi Informasi">Teknologi Informasi</option>
                    <option value="Operasional">Operasional</option>
                    <option value="Human Resources">Human Resources</option>
                    <option value="Keuangan & Akuntansi">Keuangan & Akuntansi</option>
                    <option value="Pemasaran & Penjualan">Pemasaran & Penjualan</option>
                    <option value="Customer Support">Customer Support</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Peran (Role)
                  </label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
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
                  value={formData.position}
                  onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                  placeholder="Contoh: Staff Operasional"
                  className="w-full px-3.5 py-2 rounded-xl text-sm border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
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
                  className="w-full px-3.5 py-2 rounded-xl text-sm border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 shadow-md shadow-blue-500/20"
                >
                  {submitting ? 'Menyimpan...' : 'Simpan Karyawan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

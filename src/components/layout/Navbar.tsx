import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  MapPin,
  Camera,
  Users,
  BarChart3,
  Settings,
  LogOut,
  Clock,
  ShieldCheck,
  UserCheck,
  CalendarDays,
} from 'lucide-react';

interface NavbarProps {
  activeTab: 'clock' | 'dashboard' | 'history' | 'employees' | 'settings';
  setActiveTab: (tab: 'clock' | 'dashboard' | 'history' | 'employees' | 'settings') => void;
  onOpenFaceRegistration?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  onOpenFaceRegistration,
}) => {
  const { user, employee, isAdmin, signOutUser } = useAuth();
  const [currentTime, setCurrentTime] = useState<string>('');
  const [currentDate, setCurrentDate] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString('id-ID', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }) + ' WIB'
      );
      setCurrentDate(
        now.toLocaleDateString('id-ID', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })
      );
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-white flex items-center justify-center shadow-xs border border-slate-200 overflow-hidden shrink-0">
              <img
                src="/logo-metara.png"
                alt="Metara Logo"
                className="w-full h-full object-contain"
                onError={(e) => {
                  const target = e.currentTarget;
                  target.onerror = null;
                  target.src = '/src/assets/images/metara_circular_badge_1790953093074.jpg';
                }}
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg sm:text-xl tracking-tight text-slate-900">
                  HRIS <span className="text-red-600">metaranews.co</span>
                </span>
                <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200">
                  Presensi & Biometrik
                </span>
              </div>
              <p className="text-xs text-slate-500 hidden sm:block">
                Sistem Kehadiran GPS & Pengenalan Wajah
              </p>
            </div>
          </div>

          {/* Real-time Clock Banner */}
          <div className="hidden md:flex flex-col items-center px-4 py-1.5 bg-slate-50 rounded-xl border border-slate-200/80">
            <div className="flex items-center gap-2 text-slate-800 font-mono font-bold text-sm tracking-wide">
              <Clock className="w-4 h-4 text-blue-600" />
              <span>{currentTime}</span>
            </div>
            <span className="text-[11px] text-slate-500">{currentDate}</span>
          </div>

          {/* User Profile & Actions */}
          <div className="flex items-center gap-2 sm:gap-3">
            {user && (
              <div className="flex items-center gap-2 sm:gap-3 pl-2 sm:pl-3 border-l border-slate-200">
                <div className="relative">
                  {employee?.facePhotoUrl || user.photoURL ? (
                    <img
                      src={employee?.facePhotoUrl || user.photoURL || ''}
                      alt={employee?.name || user.displayName || 'User'}
                      className="w-9 h-9 sm:w-10 sm:h-10 rounded-full object-cover border-2 border-white shadow-xs ring-2 ring-blue-500/20"
                    />
                  ) : (
                    <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-sm border-2 border-white shadow-xs">
                      {employee?.name?.[0] || user.displayName?.[0] || 'U'}
                    </div>
                  )}
                  {employee?.faceRegistered && (
                    <span
                      title="Wajah Terdaftar"
                      className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 rounded-full ring-2 ring-white"
                    />
                  )}
                </div>

                <div className="text-left hidden lg:block">
                  <div className="text-sm font-semibold text-slate-800 leading-tight flex items-center gap-1.5">
                    <span className="truncate max-w-[140px]">{employee?.name || user.displayName}</span>
                    <span
                      className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded-sm ${
                        isAdmin
                          ? 'bg-purple-100 text-purple-700 border border-purple-200'
                          : 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                      }`}
                    >
                      {isAdmin ? 'Admin HR' : 'Staff'}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 truncate max-w-[140px]">
                    {employee?.department || 'Karyawan'}
                  </div>
                </div>

                <button
                  onClick={signOutUser}
                  title="Keluar"
                  className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <LogOut className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex items-center gap-1 overflow-x-auto py-2 border-t border-slate-100 scrollbar-none">
          <button
            onClick={() => setActiveTab('clock')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all shrink-0 ${
              activeTab === 'clock'
                ? 'bg-blue-600 text-white shadow-xs shadow-blue-500/20'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Camera className="w-4 h-4" />
            <span>Presensi Harian</span>
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all shrink-0 ${
              activeTab === 'history'
                ? 'bg-blue-600 text-white shadow-xs shadow-blue-500/20'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <CalendarDays className="w-4 h-4" />
            <span>Riwayat Saya</span>
          </button>

          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all shrink-0 ${
              activeTab === 'dashboard'
                ? 'bg-blue-600 text-white shadow-xs shadow-blue-500/20'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>Rekapitulasi HR</span>
          </button>

          {isAdmin && (
            <>
              <button
                onClick={() => setActiveTab('employees')}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all shrink-0 ${
                  activeTab === 'employees'
                    ? 'bg-blue-600 text-white shadow-xs shadow-blue-500/20'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Users className="w-4 h-4" />
                <span>Kelola Karyawan</span>
              </button>

              <button
                onClick={() => setActiveTab('settings')}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all shrink-0 ${
                  activeTab === 'settings'
                    ? 'bg-blue-600 text-white shadow-xs shadow-blue-500/20'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Settings className="w-4 h-4" />
                <span>Radius GPS Kantor</span>
              </button>
            </>
          )}

          {employee && !employee.faceRegistered && onOpenFaceRegistration && (
            <button
              onClick={onOpenFaceRegistration}
              className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-300 hover:bg-amber-100 transition-all shrink-0 animate-pulse"
            >
              <UserCheck className="w-3.5 h-3.5 text-amber-600" />
              <span>Daftarkan Wajah Biometrik</span>
            </button>
          )}
        </nav>
      </div>
    </header>
  );
};

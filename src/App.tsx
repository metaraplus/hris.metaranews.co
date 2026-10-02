/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/layout/Navbar';
import { LoginView } from './components/auth/LoginView';
import { AttendanceClockIn } from './components/attendance/AttendanceClockIn';
import { AttendanceDashboard } from './components/dashboard/AttendanceDashboard';
import { PersonalHistory } from './components/attendance/PersonalHistory';
import { EmployeeManagement } from './components/employees/EmployeeManagement';
import { OfficeSettingsView } from './components/settings/OfficeSettingsModal';
import { FaceRegistrationModal } from './components/attendance/FaceRegistrationModal';
import { OfficeSetting, Employee } from './types';
import { DEFAULT_OFFICE_SETTING } from './utils/geolocation';
import { db, handleFirestoreError, OperationType } from './firebase/config';
import { doc, onSnapshot, setDoc, updateDoc } from 'firebase/firestore';
import { RefreshCw, ShieldCheck } from 'lucide-react';

function MainApp() {
  const { user, employee, isAdmin, loading, refreshEmployee } = useAuth();
  const [activeTab, setActiveTab] = useState<'clock' | 'dashboard' | 'history' | 'employees' | 'settings'>('clock');
  const [officeSetting, setOfficeSetting] = useState<OfficeSetting>(DEFAULT_OFFICE_SETTING);

  // Face Registration Modal state
  const [faceModalOpen, setFaceModalOpen] = useState(false);
  const [targetFaceEmployee, setTargetFaceEmployee] = useState<Employee | null>(null);

  // Real-time listener for office settings
  useEffect(() => {
    if (!user) return;

    const settingRef = doc(db, 'settings', 'office');
    const unsubscribe = onSnapshot(
      settingRef,
      (snapshot) => {
        if (snapshot.exists()) {
          setOfficeSetting(snapshot.data() as OfficeSetting);
        } else {
          // Initialize default office setting if not yet set (Admin only)
          if (isAdmin) {
            setDoc(settingRef, DEFAULT_OFFICE_SETTING).catch((e) =>
              console.warn('Initial office setting setup note:', e)
            );
          }
        }
      },
      (error) => {
        // Fallback to default without breaking
        console.warn('Using default office setting due to:', error);
      }
    );

    return () => unsubscribe();
  }, [user, isAdmin]);

  const handleOpenMyFaceRegistration = () => {
    // If employee document is still syncing, create fallback employee so registration modal always opens
    const target = employee || (user ? {
      id: user.uid,
      uid: user.uid,
      employeeNumber: 'EMP-0001',
      name: user.displayName || user.email?.split('@')[0] || 'Karyawan',
      email: user.email || '',
      department: 'Operasional',
      position: 'Staff Karyawan',
      role: isAdmin ? 'admin' : 'employee',
      faceRegistered: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as Employee : null);

    if (target) {
      setTargetFaceEmployee(target);
      setFaceModalOpen(true);
    }
  };

  const handleOpenEmployeeFaceRegistration = (emp: Employee) => {
    setTargetFaceEmployee(emp);
    setFaceModalOpen(true);
  };

  const handleSaveFaceProfile = async (photoUrl: string, descriptorJson: string) => {
    if (!targetFaceEmployee) return;
    try {
      const empRef = doc(db, 'employees', targetFaceEmployee.id);
      await setDoc(empRef, {
        faceRegistered: true,
        facePhotoUrl: photoUrl,
        faceDescriptor: descriptorJson,
        updatedAt: new Date().toISOString(),
      }, { merge: true });
      await refreshEmployee();
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `employees/${targetFaceEmployee.id}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white">
        <div className="w-16 h-16 rounded-2xl bg-white flex items-center justify-center mb-4 shadow-xl overflow-hidden p-1">
          <img src="/logo-metara.png" alt="Metara" className="w-full h-full object-contain" />
        </div>
        <div className="flex items-center gap-2 text-slate-300 font-medium text-sm">
          <RefreshCw className="w-4 h-4 animate-spin text-red-500" />
          <span>Memuat HRIS metaranews.co...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginView />;
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col text-slate-900 antialiased font-sans">
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenFaceRegistration={handleOpenMyFaceRegistration}
      />

      <main className="flex-1 pb-16">
        {activeTab === 'clock' && (
          <AttendanceClockIn
            officeSetting={officeSetting}
            onOpenFaceRegistration={handleOpenMyFaceRegistration}
            isFaceModalOpen={faceModalOpen}
          />
        )}

        {activeTab === 'history' && <PersonalHistory />}

        {activeTab === 'dashboard' && <AttendanceDashboard />}

        {activeTab === 'employees' && isAdmin && (
          <EmployeeManagement
            onOpenFaceRegistrationForEmployee={handleOpenEmployeeFaceRegistration}
          />
        )}

        {activeTab === 'settings' && isAdmin && (
          <OfficeSettingsView
            currentSetting={officeSetting}
            onSettingUpdated={(updated) => setOfficeSetting(updated)}
          />
        )}
      </main>

      {/* Face Biometric Enrollment Modal */}
      <FaceRegistrationModal
        isOpen={faceModalOpen}
        onClose={() => setFaceModalOpen(false)}
        targetEmployee={targetFaceEmployee}
        onSaveFace={handleSaveFaceProfile}
      />

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-4 text-center text-xs text-slate-400">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2 font-medium text-slate-700">
            <img src="/logo-metara.png" alt="Metara" className="w-5 h-5 object-contain" />
            <span>HRIS metaranews.co • Sistem Absensi GPS & Biometrik Wajah</span>
          </div>
          <div>Real-time Synchronized via Google Cloud Firebase Firestore</div>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}

import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType, testConnection } from '../firebase/config';
import { Employee } from '../types';
import { saveRecentAccount } from '../utils/recentAccounts';

interface AuthContextType {
  user: User | null;
  employee: Employee | null;
  isAdmin: boolean;
  loading: boolean;
  signInWithGoogle: (loginHint?: string) => Promise<void>;
  signOutUser: () => Promise<void>;
  updateEmployeeProfile: (data: Partial<Employee>) => Promise<void>;
  refreshEmployee: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const ADMIN_EMAIL = 'metaraplus.metaranews@gmail.com';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  // Initial connection test
  useEffect(() => {
    testConnection();
  }, []);

  // Fetch or initialize employee profile
  const syncEmployeeProfile = async (firebaseUser: User) => {
    try {
      const empRef = doc(db, 'employees', firebaseUser.uid);
      const empSnap = await getDoc(empRef);

      const isDefaultAdmin = firebaseUser.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();

      // If admin, ensure admin doc exists for security rules
      if (isDefaultAdmin) {
        try {
          const adminRef = doc(db, 'admins', firebaseUser.uid);
          await setDoc(adminRef, {
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            role: 'superadmin',
            createdAt: new Date().toISOString(),
          }, { merge: true });
        } catch (e) {
          console.warn('Admin record sync note:', e);
        }
      }

      if (empSnap.exists()) {
        const data = empSnap.data() as Employee;
        const userIsAdmin = isDefaultAdmin || data.role === 'admin';
        setIsAdmin(userIsAdmin);
        const resolvedEmp: Employee = {
          ...data,
          id: firebaseUser.uid,
          uid: firebaseUser.uid,
          role: userIsAdmin ? 'admin' : data.role,
        };
        setEmployee(resolvedEmp);

        // Save account to recent accounts for fast login
        saveRecentAccount({
          uid: firebaseUser.uid,
          name: resolvedEmp.name || firebaseUser.displayName || 'Karyawan',
          email: resolvedEmp.email || firebaseUser.email || '',
          photoUrl: resolvedEmp.facePhotoUrl || firebaseUser.photoURL || '',
          department: resolvedEmp.department || '',
          role: resolvedEmp.role,
          lastLogin: new Date().toISOString(),
        });
      } else {
        // Auto-provision initial employee record for the logged-in user
        const newEmployee: Employee = {
          id: firebaseUser.uid,
          uid: firebaseUser.uid,
          employeeNumber: `EMP-${Math.floor(1000 + Math.random() * 9000)}`,
          name: firebaseUser.displayName || 'Karyawan',
          email: firebaseUser.email || '',
          department: isDefaultAdmin ? 'Manajemen & HR' : 'Operasional',
          position: isDefaultAdmin ? 'HR / Super Admin' : 'Staff Karyawan',
          phone: '',
          role: isDefaultAdmin ? 'admin' : 'employee',
          faceRegistered: false,
          facePhotoUrl: firebaseUser.photoURL || '',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        const cleanEmployeePayload: any = {};
        for (const [k, v] of Object.entries(newEmployee)) {
          if (v !== undefined) {
            cleanEmployeePayload[k] = v;
          }
        }

        await setDoc(empRef, cleanEmployeePayload);
        setEmployee(newEmployee);
        setIsAdmin(isDefaultAdmin);

        // Save account to recent accounts for fast login
        saveRecentAccount({
          uid: firebaseUser.uid,
          name: newEmployee.name,
          email: newEmployee.email,
          photoUrl: newEmployee.facePhotoUrl,
          department: newEmployee.department,
          role: newEmployee.role,
          lastLogin: new Date().toISOString(),
        });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, `employees/${firebaseUser.uid}`);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        await syncEmployeeProfile(currentUser);
      } else {
        setEmployee(null);
        setIsAdmin(false);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async (loginHint?: string) => {
    try {
      const provider = new GoogleAuthProvider();
      if (loginHint) {
        provider.setCustomParameters({ login_hint: loginHint });
      } else {
        provider.setCustomParameters({ prompt: 'select_account' });
      }
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error('Google Sign-in failed:', error);
      throw error;
    }
  };

  const signOutUser = async () => {
    try {
      await signOut(auth);
      setEmployee(null);
      setIsAdmin(false);
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  const updateEmployeeProfile = async (data: Partial<Employee>) => {
    if (!user || !employee) return;
    try {
      const empRef = doc(db, 'employees', user.uid);
      const updateData: any = {
        ...data,
        updatedAt: new Date().toISOString(),
      };
      for (const k of Object.keys(updateData)) {
        if (updateData[k] === undefined) {
          delete updateData[k];
        }
      }
      await updateDoc(empRef, updateData);
      setEmployee((prev) => (prev ? { ...prev, ...updateData } : null));
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `employees/${user.uid}`);
    }
  };

  const refreshEmployee = async () => {
    if (user) {
      await syncEmployeeProfile(user);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        employee,
        isAdmin,
        loading,
        signInWithGoogle,
        signOutUser,
        updateEmployeeProfile,
        refreshEmployee,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

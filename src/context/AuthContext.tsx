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
  collection,
  query,
  where,
  getDocs,
  deleteDoc,
} from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../firebase/config';
import { Employee } from '../types';
import { saveRecentAccount } from '../utils/recentAccounts';

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

      let existingEmpData: Employee | null = null;

      if (empSnap.exists()) {
        existingEmpData = empSnap.data() as Employee;
      } else if (firebaseUser.email) {
        // Check if pre-registered by HR Admin by matching email
        try {
          const q = query(
            collection(db, 'employees'),
            where('email', '==', firebaseUser.email.trim())
          );
          const qSnap = await getDocs(q);
          if (!qSnap.empty) {
            const preDoc = qSnap.docs[0];
            existingEmpData = preDoc.data() as Employee;
            // Clean up pre-doc if it used an auto-generated ID (emp_*)
            if (preDoc.id !== firebaseUser.uid) {
              try {
                await deleteDoc(doc(db, 'employees', preDoc.id));
              } catch (delErr) {
                console.warn('Pre-doc cleanup note:', delErr);
              }
            }
          }
        } catch (queryErr) {
          console.warn('Pre-registered search note:', queryErr);
        }
      }

      if (existingEmpData) {
        const userIsAdmin = isDefaultAdmin || existingEmpData.role === 'admin';
        setIsAdmin(userIsAdmin);
        const resolvedEmp: Employee = {
          ...existingEmpData,
          id: firebaseUser.uid,
          uid: firebaseUser.uid,
          role: userIsAdmin ? 'admin' : existingEmpData.role,
        };
        await setDoc(empRef, cleanData(resolvedEmp), { merge: true });
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

        await setDoc(empRef, cleanData(newEmployee));
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
    if (!user) return;
    try {
      const empRef = doc(db, 'employees', user.uid);
      const updateData: any = {
        uid: user.uid,
        ...data,
        updatedAt: new Date().toISOString(),
      };
      await setDoc(empRef, cleanData(updateData), { merge: true });
      setEmployee((prev) => (prev ? { ...prev, ...data } : null));
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

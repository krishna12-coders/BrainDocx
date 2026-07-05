import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  GoogleAuthProvider,
  signInWithPopup,
} from 'firebase/auth';
import type { User } from 'firebase/auth';
import { ref, get, set } from 'firebase/database';
import { auth, db } from './firebase';

export type UserRole = 'admin' | 'student' | null;

interface AuthContextType {
  user: User | null;
  userRole: UserRole;
  loading: boolean;
  login: (email: string, password: string) => Promise<UserRole>;
  register: (email: string, password: string, name: string) => Promise<void>;
  loginWithGoogle: () => Promise<UserRole>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<UserRole>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        try {
          const snap = await get(ref(db, `users/${currentUser.uid}`));
          if (snap.exists()) {
            const data = snap.val();
            if (data.status === 'blocked') {
              alert('Your account has been suspended by the administrator.');
              await signOut(auth);
              setUser(null);
              setUserRole(null);
            } else {
              setUser(currentUser);
              setUserRole(data.role === 'admin' ? 'admin' : 'student');
            }
          } else {
            setUser(currentUser);
            setUserRole('student');
          }
        } catch {
          setUser(currentUser);
          setUserRole('student');
        }
      } else {
        setUser(null);
        setUserRole(null);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  // Returns the role of the logged-in user so the caller can redirect
  const login = async (email: string, password: string): Promise<UserRole> => {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    const snap = await get(ref(db, `users/${cred.user.uid}`));
    if (snap.exists()) {
      const data = snap.val();
      if (data.status === 'blocked') {
        await signOut(auth);
        throw new Error('Your account has been suspended.');
      }
      return data.role === 'admin' ? 'admin' : 'student';
    }
    return 'student';
  };

  const register = async (email: string, password: string, name: string) => {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await set(ref(db, `users/${cred.user.uid}`), {
      email,
      name,
      role: 'student',
      status: 'active',
      createdAt: Date.now(),
    });
  };

  const loginWithGoogle = async (): Promise<UserRole> => {
    const provider = new GoogleAuthProvider();
    const cred = await signInWithPopup(auth, provider);
    const snap = await get(ref(db, `users/${cred.user.uid}`));
    if (!snap.exists()) {
      await set(ref(db, `users/${cred.user.uid}`), {
        email: cred.user.email,
        name: cred.user.displayName || 'Student',
        role: 'student',
        status: 'active',
        createdAt: Date.now(),
      });
      return 'student';
    }
    const data = snap.val();
    return data.role === 'admin' ? 'admin' : 'student';
  };

  const logout = async () => {
    await signOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, userRole, loading, login, register, loginWithGoogle, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import type { User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../utils/firebase';

interface AuthContextType {
  currentUser: User | null;
  isAdmin: boolean;
  userRole: string | null;
  userStatus: string | null;
  loading: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userStatus, setUserStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const logout = async () => {
    await signOut(auth);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setLoading(true);
      if (user) {
        try {
          // Fetch user document from Firestore to verify role
          const userDocRef = doc(db, 'users', user.uid);
          const userDocSnap = await getDoc(userDocRef);

          if (userDocSnap.exists()) {
            const data = userDocSnap.data();
            setUserRole(data.role || 'student');
            setUserStatus(data.status || 'active');

            if (data.role === 'admin' && data.status === 'active') {
              setIsAdmin(true);
              setCurrentUser(user);
            } else {
              setIsAdmin(false);
              setCurrentUser(null);
              // Force sign out non-admins trying to access the dashboard
              await signOut(auth);
              alert(data.status === 'blocked' ? 'Your account has been suspended.' : 'Access denied. Administrator privileges required.');
            }
          } else {
            // User exists in Auth but not in Firestore yet (e.g. initial oauth)
            // Let's create an default student user or deny access
            setIsAdmin(false);
            setCurrentUser(null);
            await signOut(auth);
            alert('Access denied. Administrator account not found.');
          }
        } catch (error) {
          console.error('Error fetching user profile:', error);
          setIsAdmin(false);
          setCurrentUser(null);
          await signOut(auth);
        }
      } else {
        setCurrentUser(null);
        setIsAdmin(false);
        setUserRole(null);
        setUserStatus(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  return (
    <AuthContext.Provider value={{ currentUser, isAdmin, userRole, userStatus, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

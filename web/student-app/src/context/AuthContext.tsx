import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import type { User } from 'firebase/auth';
import { ref, get, set } from 'firebase/database';
import { httpsCallable } from 'firebase/functions';
import { Alert } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as Device from 'expo-device';
import { auth, db, functions } from '../services/firebase';

const getDocWithTimeout = (dbRef: any, timeoutMs: number = 3000) => {
  return Promise.race([
    get(dbRef),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Database connection timeout. Please verify that your Realtime Database is created and enabled in your Firebase console.')), timeoutMs)
    )
  ]) as Promise<any>;
};

interface AuthContextType {
  user: User | null;
  deviceId: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  loginWithGoogle: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Key name for device ID in Secure Store
const DEVICE_ID_KEY = 'braindocx_secure_device_id';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // 1. Get or generate installation-bound secure device ID
  const getOrCreateDeviceId = async (): Promise<string> => {
    try {
      let id = await SecureStore.getItemAsync(DEVICE_ID_KEY);
      if (!id) {
        // Generate a random unique installation ID
        id = 'dev_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        await SecureStore.setItemAsync(DEVICE_ID_KEY, id);
      }
      return id;
    } catch (e) {
      console.error('Error with secure storage:', e);
      // Fallback
      return 'fallback_device_id';
    }
  };

  // 2. Perform Device Binding check-in with Cloud Function
  const checkInDevice = async (currentUser: User, id: string): Promise<boolean> => {
    try {
      const registerDeviceFn = httpsCallable(functions, 'registerDevice');
      const deviceModel = Device.modelName || Device.designName || 'Generic Device';
      const osVersion = `${Device.osName} ${Device.osVersion}`;

      await registerDeviceFn({
        deviceId: id,
        deviceModel,
        osVersion,
      });
      return true;
    } catch (error: any) {
      console.error('Device registration failed:', error);
      alert(error.message || 'Device authorization failed. Limit of 2 devices exceeded.');
      await signOut(auth); // Sign out if device binding is rejected
      return false;
    }
  };

  // 3. Login
  const login = async (email: string, password: string) => {
    setLoading(true);
    try {
      const devId = await getOrCreateDeviceId();
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      
      // Perform device check
      const checkInSuccess = await checkInDevice(userCredential.user, devId);
      if (!checkInSuccess) {
        throw new Error('Device authorization failed. 2 active devices limit reached.');
      }
    } catch (error: any) {
      setLoading(false);
      throw error;
    }
  };

  // 4. Register
  const register = async (email: string, password: string, name: string) => {
    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const uid = userCredential.user.uid;

      // Create student user document in RTDB
      await set(ref(db, `users/${uid}`), {
        email,
        name,
        role: 'student',
        status: 'active',
        createdAt: Date.now(),
      });

      const devId = await getOrCreateDeviceId();
      await checkInDevice(userCredential.user, devId);
    } catch (error) {
      setLoading(false);
      throw error;
    }
  };

  // 5. Logout
  const logout = async () => {
    setLoading(true);
    try {
      await signOut(auth);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // 6. Sign in with Google (Integration scaffold & Simulator check-in)
  const loginWithGoogle = async () => {
    setLoading(true);
    try {
      Alert.alert(
        'Google Authentication',
        'This binds your Google account to this device. Continue?',
        [
          { text: 'Cancel', style: 'cancel', onPress: () => setLoading(false) },
          {
            text: 'Sign In',
            onPress: async () => {
              try {
                // In production:
                // const result = await GoogleSignin.signIn();
                // const credential = GoogleAuthProvider.credential(result.idToken);
                // const userCredential = await signInWithCredential(auth, credential);
                
                // For development simulation:
                const mockEmail = `google.${Math.random().toString(36).substring(7)}@gmail.com`;
                const userCredential = await createUserWithEmailAndPassword(auth, mockEmail, 'google-mock-password-123');
                const uid = userCredential.user.uid;
                
                await set(ref(db, `users/${uid}`), {
                  email: mockEmail,
                  name: 'Google Student',
                  role: 'student',
                  status: 'active',
                  createdAt: Date.now(),
                });
                
                const devId = await getOrCreateDeviceId();
                await checkInDevice(userCredential.user, devId);
              } catch (e: any) {
                Alert.alert('Google Sign-In Error', e.message || 'Verification failed.');
              } finally {
                setLoading(false);
              }
            }
          }
        ]
      );
    } catch (error) {
      setLoading(false);
      throw error;
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        const id = await getOrCreateDeviceId();
        setDeviceId(id);
        
        // Fetch student user profile status (check if blocked)
        try {
          const userSnap = await getDocWithTimeout(ref(db, `users/${currentUser.uid}`));
          if (userSnap.exists() && userSnap.val()?.status === 'blocked') {
            Alert.alert('Suspended', 'Your account has been suspended by the administrator.');
            await signOut(auth);
            setUser(null);
          } else {
            setUser(currentUser);
          }
        } catch (e: any) {
          console.error('Error checking user status:', e);
          Alert.alert('Database Connection Failed', e.message || 'Please check your internet connection or verify Realtime Database is enabled.');
          await signOut(auth);
          setUser(null);
        }
      } else {
        setUser(null);
        setDeviceId(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  return (
    <AuthContext.Provider value={{ user, deviceId, loading, login, register, logout, loginWithGoogle }}>
      {children}
    </AuthContext.Provider>
  );
};

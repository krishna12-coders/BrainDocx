import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  connectAuthEmulator 
} from 'firebase/auth';
import { 
  getFirestore, 
  connectFirestoreEmulator 
} from 'firebase/firestore';
import { 
  getStorage, 
  connectStorageEmulator 
} from 'firebase/storage';
import { 
  getFunctions, 
  connectFunctionsEmulator 
} from 'firebase/functions';
import { Platform } from 'react-native';

const firebaseConfig = {
  apiKey: "AIzaSyCS3oPQd-SD6B1ZpdtvNwt_pd6DYFOjHKc",
  authDomain: "braindocx-69f21.firebaseapp.com",
  databaseURL: "https://braindocx-69f21-default-rtdb.firebaseio.com",
  projectId: "braindocx-69f21",
  storageBucket: "braindocx-69f21.firebasestorage.app",
  messagingSenderId: "92533442918",
  appId: "1:92533442918:web:eb0148bb30fbb36998a0a7",
  measurementId: "G-8818921QHQ"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const functions = getFunctions(app);

// Helper to determine the emulator host IP based on platform
const getEmulatorHost = () => {
  if (Platform.OS === 'android') {
    // Android emulator loops back to machine localhost via 10.0.2.2
    return '10.0.2.2';
  }
  return 'localhost';
};

// Connect to Firebase Emulators ONLY if explicitly requested in environment variables
if (__DEV__ && process.env.EXPO_PUBLIC_USE_EMULATORS === 'true') {
  const host = getEmulatorHost();
  console.log(`Connecting to Firebase Emulators at ${host}...`);
  try {
    connectAuthEmulator(auth, `http://${host}:9099`, { disableWarnings: true });
    connectFirestoreEmulator(db, host, 8080);
    connectStorageEmulator(storage, host, 9199);
    connectFunctionsEmulator(functions, host, 5001);
  } catch (error) {
    console.warn('Emulator connection warning (might already be connected):', error);
  }
}

import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  connectAuthEmulator 
} from 'firebase/auth';
import { 
  getDatabase, 
  connectDatabaseEmulator 
} from 'firebase/database';
import { 
  getStorage, 
  connectStorageEmulator 
} from 'firebase/storage';
import { 
  getFunctions, 
  connectFunctionsEmulator 
} from 'firebase/functions';

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
export const db = getDatabase(app);
export const storage = getStorage(app);
export const functions = getFunctions(app);

// Connect to Firebase Emulators ONLY if explicitly requested in environment
if (import.meta.env.VITE_USE_EMULATORS === 'true') {
  console.log('Connecting to Firebase Emulators...');
  connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
  connectDatabaseEmulator(db, 'localhost', 9000);
  connectStorageEmulator(storage, 'localhost', 9199);
  connectFunctionsEmulator(functions, 'localhost', 5001);
}

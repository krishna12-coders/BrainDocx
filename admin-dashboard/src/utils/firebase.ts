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

// Automatically connect to Firebase Emulators when running locally
if (
  window.location.hostname === 'localhost' || 
  window.location.hostname === '127.0.0.1' ||
  window.location.hostname.startsWith('192.168.')
) {
  console.log('Connecting to Firebase Emulators...');
  connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, 'localhost', 8080);
  connectStorageEmulator(storage, 'localhost', 9199);
  connectFunctionsEmulator(functions, 'localhost', 5001);
}

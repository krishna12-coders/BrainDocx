import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getDatabase } from 'firebase/database';
import { getStorage } from 'firebase/storage';
import { getFunctions } from 'firebase/functions';

const firebaseConfig = {
  apiKey: "AIzaSyCS3oPQd-SD6B1ZpdtvNwt_pd6DYFOjHKc",
  authDomain: "braindocx-69f21.firebaseapp.com",
  databaseURL: "https://braindocx-69f21-default-rtdb.firebaseio.com",
  projectId: "braindocx-69f21",
  storageBucket: "braindocx-69f21.firebasestorage.app",
  messagingSenderId: "92533442918",
  appId: "1:92533442918:web:eb0148bb30fbb36998a0a7",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getDatabase(app);
export const storage = getStorage(app);
export const functions = getFunctions(app);

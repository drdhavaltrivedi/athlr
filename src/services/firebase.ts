import { initializeApp } from 'firebase/app';
import {
  initializeAuth,
  // @ts-ignore
  getReactNativePersistence,
} from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: "***REMOVED***",
  authDomain: "athlr-b.firebaseapp.com",
  projectId: "athlr-b",
  storageBucket: "athlr-b.firebasestorage.app",
  messagingSenderId: "455854898290",
  appId: "1:455854898290:web:1012b80e23eeb0396896eb",
  measurementId: "G-PPTYYRWK7N"
};

const app = initializeApp(firebaseConfig);

// Initialize Firebase Auth with persistence
export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});

export const db = getFirestore(app);
export const storage = getStorage(app);

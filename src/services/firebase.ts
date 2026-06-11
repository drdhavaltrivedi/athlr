import { initializeApp } from 'firebase/app';
import {
  initializeAuth,
  // @ts-ignore
  getReactNativePersistence,
} from 'firebase/auth';
import { initializeFirestore } from 'firebase/firestore';
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

// React Native's network stack breaks Firestore's default WebChannel streaming
// (reads/writes hang for 10-30s or never settle). Long polling is reliable in RN.
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
});
export const storage = getStorage(app);

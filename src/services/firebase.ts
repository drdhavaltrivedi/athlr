import { initializeApp } from 'firebase/app';
import {
  initializeAuth,
  // @ts-ignore
  getReactNativePersistence,
} from 'firebase/auth';
import { initializeFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import * as SecureStore from 'expo-secure-store';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: "athlr-b.firebaseapp.com",
  projectId: "athlr-b",
  storageBucket: "athlr-b.firebasestorage.app",
  messagingSenderId: "455854898290",
  appId: "1:455854898290:web:1012b80e23eeb0396896eb",
  measurementId: "G-PPTYYRWK7N"
};

const app = initializeApp(firebaseConfig);

// expo-secure-store adapter for Firebase auth persistence.
// Replaces @react-native-async-storage which requires separate native linking
// and crashes when the native module isn't in the binary (e.g. after npm install).
const secureStoreAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

// Initialize Firebase Auth with SecureStore-backed persistence
export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(secureStoreAdapter),
});

// React Native's network stack breaks Firestore's default WebChannel streaming
// (reads/writes hang for 10-30s or never settle). Long polling is reliable in RN.
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
});
export const storage = getStorage(app);

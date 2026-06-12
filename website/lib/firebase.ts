import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Same Firebase project as the Athlr mobile app.
// These values are public client identifiers — security is enforced by
// Firebase Auth + Firestore security rules (admins/{uid} gate).
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: 'athlr-b.firebaseapp.com',
  projectId: 'athlr-b',
  storageBucket: 'athlr-b.firebasestorage.app',
  messagingSenderId: '455854898290',
  appId: '1:455854898290:web:1012b80e23eeb0396896eb',
};

const app = getApps()[0] ?? initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);

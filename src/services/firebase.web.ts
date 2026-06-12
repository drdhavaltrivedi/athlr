import { browserLocalPersistence, initializeAuth } from 'firebase/auth';
import { app, db, storage } from './firebase.shared';

export const auth = initializeAuth(app, {
  persistence: browserLocalPersistence,
});

export { db, storage };
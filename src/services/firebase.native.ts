import AsyncStorage from '@react-native-async-storage/async-storage';
import { initializeAuth } from 'firebase/auth';
import { app, db, storage } from './firebase.shared';

class AsyncStoragePersistence {
  static type = 'LOCAL' as const;
  readonly type = 'LOCAL' as const;

  async _isAvailable(): Promise<boolean> {
    return true;
  }

  async _set(key: string, value: unknown): Promise<void> {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  }

  async _get<T>(key: string): Promise<T | null> {
    const stored = await AsyncStorage.getItem(key);
    if (stored == null) return null;
    try {
      return JSON.parse(stored) as T;
    } catch {
      return stored as T;
    }
  }

  async _remove(key: string): Promise<void> {
    await AsyncStorage.removeItem(key);
  }

  _addListener(_key: string, _listener: (value: unknown | null) => void): void {
    return;
  }

  _removeListener(_key: string, _listener: (value: unknown | null) => void): void {
    return;
  }
}

export const auth = initializeAuth(app, {
  persistence: [AsyncStoragePersistence],
});

export { db, storage };
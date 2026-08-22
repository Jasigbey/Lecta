import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const memoryStorage = new Map<string, string>();

export const safeStorage = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined' && window.localStorage) {
          return window.localStorage.getItem(key);
        }
        return memoryStorage.get(key) || null;
      }
      const val = await SecureStore.getItemAsync(key);
      return val ?? memoryStorage.get(key) ?? null;
    } catch (e) {
      console.warn(`[storage] getItem error for key "${key}", using memory fallback:`, e);
      return memoryStorage.get(key) || null;
    }
  },

  setItem: async (key: string, value: string): Promise<void> => {
    try {
      memoryStorage.set(key, value);
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem(key, value);
          return;
        }
        return;
      }
      await SecureStore.setItemAsync(key, value);
    } catch (e) {
      console.warn(`[storage] setItem error for key "${key}", using memory fallback:`, e);
      memoryStorage.set(key, value);
    }
  },

  removeItem: async (key: string): Promise<void> => {
    try {
      memoryStorage.delete(key);
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.removeItem(key);
          return;
        }
        return;
      }
      await SecureStore.deleteItemAsync(key);
    } catch (e) {
      console.warn(`[storage] removeItem error for key "${key}":`, e);
      memoryStorage.delete(key);
    }
  },
};

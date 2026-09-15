import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const memoryStorage = new Map<string, string>();

const sanitizeKey = (key: string): string => {
  return key.replace(/[^a-zA-Z0-9._-]/g, '_');
};

/**
 * Universal safe storage for Lecta app.
 * Uses AsyncStorage for high-capacity storage (chat sessions, offline files, cache)
 * to avoid SecureStore 2048-byte limits, with seamless fallbacks.
 */
export const safeStorage = {
  getItem: async (rawKey: string): Promise<string | null> => {
    const key = sanitizeKey(rawKey);
    try {
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined' && window.localStorage) {
          return window.localStorage.getItem(key);
        }
        return memoryStorage.get(key) || null;
      }

      // Try AsyncStorage first
      const val = await AsyncStorage.getItem(key);
      if (val !== null) return val;

      // Fallback check in SecureStore in case it was previously saved there
      try {
        const secureVal = await SecureStore.getItemAsync(key);
        if (secureVal !== null) return secureVal;
      } catch {}

      return memoryStorage.get(key) || null;
    } catch (e) {
      console.warn(`[storage] getItem error for key "${key}", using memory fallback:`, e);
      return memoryStorage.get(key) || null;
    }
  },

  setItem: async (rawKey: string, value: string): Promise<void> => {
    const key = sanitizeKey(rawKey);
    try {
      memoryStorage.set(key, value);
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem(key, value);
          return;
        }
        return;
      }

      // Use AsyncStorage to support arbitrarily large chat logs, notes, and session trees
      await AsyncStorage.setItem(key, value);
    } catch (e) {
      console.warn(`[storage] setItem error for key "${key}", using memory fallback:`, e);
      memoryStorage.set(key, value);
    }
  },

  removeItem: async (rawKey: string): Promise<void> => {
    const key = sanitizeKey(rawKey);
    try {
      memoryStorage.delete(key);
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.removeItem(key);
          return;
        }
        return;
      }
      await AsyncStorage.removeItem(key);
      try {
        await SecureStore.deleteItemAsync(key);
      } catch {}
    } catch (e) {
      console.warn(`[storage] removeItem error for key "${key}":`, e);
      memoryStorage.delete(key);
    }
  },
};

import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';

const sanitizeKey = (key: string): string => key.replace(/[^a-zA-Z0-9._-]/g, '_');

// Custom Storage Adapter for Expo SecureStore
const ExpoSecureStoreAdapter = {
  getItem: (key: string) => {
    return SecureStore.getItemAsync(sanitizeKey(key));
  },
  setItem: (key: string, value: string) => {
    return SecureStore.setItemAsync(sanitizeKey(key), value);
  },
  removeItem: (key: string) => {
    return SecureStore.deleteItemAsync(sanitizeKey(key));
  },
};

const rawUrl = (process.env.EXPO_PUBLIC_SUPABASE_URL || '').trim();
const rawKey = (
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.EXPO_PUBLIC_SUPABASE_KEY ||
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  ''
).trim();

const supabaseUrl = rawUrl || 'https://placeholder.supabase.co';
const supabaseAnonKey = rawKey || 'placeholder-anon-key';

export const isSupabaseConfigured = Boolean(
  rawUrl &&
    !rawUrl.includes('your-project-id') &&
    !rawUrl.includes('placeholder.supabase.co') &&
    rawKey &&
    !rawKey.includes('your-supabase-anon-key') &&
    !rawKey.includes('placeholder-anon-key')
);

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: ExpoSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

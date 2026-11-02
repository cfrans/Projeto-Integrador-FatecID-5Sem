import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

export const preferenceStorage = {
  async get(key: string): Promise<string | null> {
    if (Platform.OS === 'web') return globalThis.localStorage.getItem(key);
    return SecureStore.getItemAsync(key);
  },
  async set(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') globalThis.localStorage.setItem(key, value);
    else await SecureStore.setItemAsync(key, value);
  },
  async remove(key: string): Promise<void> {
    if (Platform.OS === 'web') globalThis.localStorage.removeItem(key);
    else await SecureStore.deleteItemAsync(key);
  },
};

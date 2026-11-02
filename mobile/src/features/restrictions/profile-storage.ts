import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import type { ProfileStorage } from './services/profiles';

export const profileStorage: ProfileStorage = {
  async get(key) {
    return Platform.OS === 'web' ? globalThis.localStorage.getItem(key) : SecureStore.getItemAsync(key);
  },
  async set(key, value) {
    if (Platform.OS === 'web') globalThis.localStorage.setItem(key, value);
    else await SecureStore.setItemAsync(key, value);
  },
};

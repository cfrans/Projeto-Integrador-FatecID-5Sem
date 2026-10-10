import { Platform } from 'react-native';
import type { AuthSession } from '@/features/auth/services/auth';

const storageKey = 'piplup.auth.session';
let webSession: AuthSession | null = null;
let storageQueue: Promise<void> = Promise.resolve();

export class SessionStorageError extends Error {
  constructor() {
    super('Secure session storage is unavailable.');
    this.name = 'SessionStorageError';
  }
}

function serialize<T>(operation: () => Promise<T>): Promise<T> {
  const result = storageQueue.then(operation);
  storageQueue = result.then(() => undefined, () => undefined);
  return result;
}

function parseSession(value: string | null): AuthSession | null {
  if (!value) return null;

  try {
    const session = JSON.parse(value) as Partial<AuthSession>;
    if (
      typeof session.accessToken === 'string'
      && session.accessToken.length > 0
      && typeof session.expiresAt === 'number'
      && Number.isFinite(session.expiresAt)
      && session.guardian
      && typeof session.guardian.id === 'string'
      && typeof session.guardian.name === 'string'
      && typeof session.guardian.email === 'string'
    ) return session as AuthSession;
  } catch {
    return null;
  }

  return null;
}

export const sessionStorage = {
  get(): Promise<AuthSession | null> {
    if (Platform.OS === 'web') return Promise.resolve(webSession);

    return serialize(async () => {
      try {
        const SecureStore = await import('expo-secure-store');
        const raw = await SecureStore.getItemAsync(storageKey);
        const session = parseSession(raw);
        if (raw && !session) await SecureStore.deleteItemAsync(storageKey);
        return session;
      } catch {
        throw new SessionStorageError();
      }
    });
  },

  set(session: AuthSession): Promise<void> {
    if (Platform.OS === 'web') {
      webSession = session;
      return Promise.resolve();
    }

    return serialize(async () => {
      try {
        const SecureStore = await import('expo-secure-store');
        await SecureStore.setItemAsync(storageKey, JSON.stringify(session));
      } catch {
        throw new SessionStorageError();
      }
    });
  },

  remove(): Promise<void> {
    if (Platform.OS === 'web') {
      webSession = null;
      return Promise.resolve();
    }

    return serialize(async () => {
      try {
        const SecureStore = await import('expo-secure-store');
        await SecureStore.deleteItemAsync(storageKey);
      } catch {
        throw new SessionStorageError();
      }
    });
  },
};

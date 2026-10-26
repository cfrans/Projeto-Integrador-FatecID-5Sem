import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { useSession } from '@/features/auth/SessionProvider';
import { computerIconsStorageKey, parseComputerIcons, type ComputerIconId, type ComputerIcons } from './services/computer-icons';

type AppearanceContextValue = {
  icons: ComputerIcons;
  ready: boolean;
  busy: boolean;
  error: 'load' | 'save' | null;
  reload: () => void;
  setIcon: (deviceId: string, icon: ComputerIconId) => Promise<boolean>;
};

const AppearanceContext = createContext<AppearanceContextValue | null>(null);

export function ComputerAppearanceProvider({ children }: { children: ReactNode }) {
  const { guardian } = useSession();
  const guardianId = guardian?.id ?? null;
  const [state, setState] = useState<{ guardianId: string | null; icons: ComputerIcons; ready: boolean }>({ guardianId: null, icons: {}, ready: false });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<AppearanceContextValue['error']>(null);
  const operation = useRef(0);
  const writing = useRef(false);
  const icons = state.guardianId === guardianId ? state.icons : {};
  const ready = state.guardianId === guardianId && state.ready;

  const reload = useCallback(async () => {
    const request = ++operation.current;
    if (!guardianId) return;
    const key = computerIconsStorageKey(guardianId);
    try {
      const raw = await (Platform.OS === 'web' ? Promise.resolve().then(() => globalThis.localStorage.getItem(key)) : SecureStore.getItemAsync(key));
      if (request === operation.current) {
        setState({ guardianId, icons: parseComputerIcons(raw), ready: true });
        setError(null);
      }
    } catch {
      if (request === operation.current) setError('load');
    }
  }, [guardianId]);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => { if (active) void reload(); });
    return () => { active = false; operation.current += 1; };
  }, [reload]);

  async function setIcon(deviceId: string, icon: ComputerIconId) {
    if (!guardianId || !ready || writing.current) return false;
    const request = ++operation.current;
    writing.current = true;
    setBusy(true);
    setError(null);
    try {
      const next = { ...icons, [deviceId]: icon };
      const key = computerIconsStorageKey(guardianId);
      if (Platform.OS === 'web') globalThis.localStorage.setItem(key, JSON.stringify(next));
      else await SecureStore.setItemAsync(key, JSON.stringify(next));
      if (request !== operation.current) return false;
      setState({ guardianId, icons: next, ready: true });
      return true;
    } catch {
      if (request === operation.current) setError('save');
      return false;
    } finally {
      writing.current = false;
      setBusy(false);
    }
  }

  return <AppearanceContext.Provider value={{ icons, ready, busy, error, reload, setIcon }}>{children}</AppearanceContext.Provider>;
}

export function useComputerAppearance() {
  const context = useContext(AppearanceContext);
  if (!context) throw new Error('ComputerAppearanceProvider is required');
  return context;
}

import { DEFAULT_BEDTIME, formatBedtime, parseBedtime, type Bedtime } from './bedtime-value.ts';

type Storage = { get: (key: string) => Promise<string | null>; set: (key: string, value: string) => Promise<void> };
type State = { value: Bedtime; ready: boolean; busy: boolean; error: 'load' | 'save' | null };

export function createBedtimeStore(storage: Storage) {
  const key = 'piplup.bedtime';
  let state: State = { value: DEFAULT_BEDTIME, ready: false, busy: false, error: null };
  const listeners = new Set<() => void>();
  function emit(next: State) {
    state = next;
    listeners.forEach((listener) => listener());
  }
  return {
    getSnapshot: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    async reload() {
      if (state.busy) return;
      emit({ ...state, busy: true, error: null });
      try {
        const stored = await storage.get(key);
        const value = stored === null ? DEFAULT_BEDTIME : parseBedtime(stored);
        if (!value) throw new Error('Invalid bedtime');
        emit({ value, ready: true, busy: false, error: null });
      } catch {
        emit({ ...state, ready: false, busy: false, error: 'load' });
      }
    },
    async save(next: Bedtime): Promise<boolean> {
      if (state.busy || !parseBedtime(formatBedtime(next))) return false;
      emit({ ...state, busy: true, error: null });
      try {
        await storage.set(key, formatBedtime(next));
        emit({ value: next, ready: true, busy: false, error: null });
        return true;
      } catch {
        emit({ ...state, busy: false, error: 'save' });
        return false;
      }
    },
  };
}

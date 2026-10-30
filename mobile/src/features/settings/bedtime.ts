import { useSyncExternalStore } from 'react';
import * as SecureStore from 'expo-secure-store';

export type Bedtime = { hour: number; minute: number };

const STORAGE_KEY = 'piplup.bedtime';
const DEFAULT_BEDTIME: Bedtime = { hour: 21, minute: 30 };

let current: Bedtime = DEFAULT_BEDTIME;
let changed = false;
const listeners = new Set<() => void>();

function emit(next: Bedtime) {
  current = next;
  listeners.forEach((listener) => listener());
}

export function parseBedtime(value: string): Bedtime | null {
  const match = /^([01]?\d|2[0-3])[:h]?([0-5]\d)$/.exec(value.trim());
  return match ? { hour: Number(match[1]), minute: Number(match[2]) } : null;
}

export function formatBedtime({ hour, minute }: Bedtime) {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export function getBedtime() {
  return current;
}

export function setBedtime(next: Bedtime) {
  changed = true;
  emit(next);
  void SecureStore.setItemAsync(STORAGE_KEY, formatBedtime(next)).catch(() => undefined);
}

export function useBedtime() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    () => current,
  );
}

void SecureStore.getItemAsync(STORAGE_KEY)
  .then((stored) => {
    const parsed = stored ? parseBedtime(stored) : null;
    if (parsed && !changed) emit(parsed);
  })
  .catch(() => undefined);

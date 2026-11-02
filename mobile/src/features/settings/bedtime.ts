import { useSyncExternalStore } from 'react';
import { preferenceStorage } from '@/lib/preferenceStorage';
import { createBedtimeStore } from './bedtime-store';

export { formatBedtime, parseBedtime } from './bedtime-value';

const store = createBedtimeStore(preferenceStorage);
export const reloadBedtime = store.reload;
export const setBedtime = store.save;

export function useBedtimeState() {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
}

void reloadBedtime();

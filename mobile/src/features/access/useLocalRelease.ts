import { useCallback, useEffect, useRef, useState } from 'react';
import { preferenceStorage } from '@/lib/preferenceStorage';
import { createReleaseStorage, type Release } from './services/release';

type State = { key: string | null; release: Release | null; ready: boolean; error: 'load' | 'save' | null };
const storage = createReleaseStorage(preferenceStorage);

export function useLocalRelease(key: string | null) {
  const [state, setState] = useState<State>({ key: null, release: null, ready: false, error: null });
  const generation = useRef(0);

  const reload = useCallback(async () => {
    const current = ++generation.current;
    if (!key) return;
    try {
      const release = await storage.load(key);
      if (current === generation.current) setState({ key, release, ready: true, error: null });
    } catch {
      if (current === generation.current) setState({ key, release: null, ready: true, error: 'load' });
    }
  }, [key]);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => { if (active) void reload(); });
    return () => { active = false; generation.current += 1; };
  }, [reload]);

  async function save(release: Release | null) {
    if (!key) return false;
    const current = ++generation.current;
    setState({ key, release, ready: true, error: null });
    try {
      await storage.save(key, release);
      return current === generation.current;
    } catch {
      if (current === generation.current) setState({ key, release, ready: true, error: 'save' });
      return false;
    }
  }

  return {
    release: state.key === key ? state.release : null,
    ready: key === null || (state.key === key && state.ready),
    error: key !== null && state.key === key ? state.error : null,
    save,
    retry: () => state.key === key && state.error === 'save' ? save(state.release) : reload(),
  };
}

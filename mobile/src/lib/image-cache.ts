export function createImageCache(prefetch: (uri: string) => Promise<boolean>) {
  const loaded = new Set<string>();
  const pending = new Map<string, Promise<void>>();
  return async (uris: string[]): Promise<void> => {
    await Promise.all([...new Set(uris)].map((uri) => {
      if (loaded.has(uri)) return Promise.resolve();
      const existing = pending.get(uri);
      if (existing) return existing;
      const request = Promise.resolve().then(() => prefetch(uri)).then((success) => {
        if (success) loaded.add(uri);
      }).catch(() => undefined).finally(() => pending.delete(uri));
      pending.set(uri, request);
      return request;
    }));
  };
}

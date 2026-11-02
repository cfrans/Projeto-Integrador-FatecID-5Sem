import type { SimulationSettings } from './simulation.ts';

export type ProfileSettings = Pick<SimulationSettings, 'blockBrowsers' | 'allowedBrowsers' | 'blockInstallation' | 'ageRating'>;
export type RestrictionProfile = { id: string; name: string; settings: ProfileSettings };
export type ProfileStorage = {
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string) => Promise<void>;
};

export const MAX_PROFILES = 20;
const browsers = ['firefox', 'chromium', 'brave', 'gnome-web'] as const;
const validId = /^[a-z0-9-]{1,60}$/;
const writing = new Set<string>();

async function writeProfiles<T>(key: string, operation: () => Promise<T>): Promise<T> {
  if (writing.has(key)) throw new Error('Profile write in progress');
  writing.add(key);
  try { return await operation(); }
  finally { writing.delete(key); }
}

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

export function profileSettings(settings: SimulationSettings | ProfileSettings): ProfileSettings {
  return {
    blockBrowsers: settings.blockBrowsers,
    allowedBrowsers: Object.fromEntries(browsers.map((id) => [id, settings.allowedBrowsers[id]])),
    blockInstallation: settings.blockInstallation,
    ageRating: settings.ageRating,
  };
}

export function parseProfile(value: unknown): RestrictionProfile {
  if (!record(value) || typeof value.id !== 'string' || !validId.test(value.id)
    || typeof value.name !== 'string' || !value.name.trim() || value.name.length > 40
    || !record(value.settings)) throw new Error('Invalid profile');
  const settings = value.settings;
  if (typeof settings.blockBrowsers !== 'boolean' || typeof settings.blockInstallation !== 'boolean'
    || !['L', '10', '12', '16', '18'].includes(settings.ageRating as string)
    || !record(settings.allowedBrowsers) || !browsers.every((id) => typeof (settings.allowedBrowsers as Record<string, unknown>)[id] === 'boolean')) throw new Error('Invalid profile');
  return { id: value.id, name: value.name.trim(), settings: profileSettings(settings as ProfileSettings) };
}

function storageKey(guardianId: string) {
  if (!/^[a-zA-Z0-9-]+$/.test(guardianId)) throw new Error('Invalid guardian');
  return `piplup.profiles.v1.${guardianId}`;
}

async function readIds(storage: ProfileStorage, key: string): Promise<string[]> {
  const stored = await storage.get(key);
  const ids: unknown = stored === null ? [] : JSON.parse(stored);
  if (!Array.isArray(ids) || ids.length > MAX_PROFILES || !ids.every((id) => typeof id === 'string' && validId.test(id))
    || new Set(ids).size !== ids.length) throw new Error('Invalid profile index');
  return ids;
}

export async function loadProfiles(storage: ProfileStorage, guardianId: string): Promise<RestrictionProfile[]> {
  const key = storageKey(guardianId);
  const ids = await readIds(storage, key);
  return Promise.all(ids.map(async (id) => {
    const stored = await storage.get(`${key}.${id}`);
    const profile = parseProfile(stored === null ? null : JSON.parse(stored));
    if (profile.id !== id) throw new Error('Invalid profile id');
    return profile;
  }));
}

export async function addProfile(storage: ProfileStorage, guardianId: string, value: RestrictionProfile) {
  const profile = parseProfile(value);
  const key = storageKey(guardianId);
  return writeProfiles(key, async () => {
    const profiles = await loadProfiles(storage, guardianId);
    if (profiles.length >= MAX_PROFILES || profiles.some((item) => item.id === profile.id || item.name.toLocaleLowerCase() === profile.name.toLocaleLowerCase())) throw new Error('Duplicate or full profile list');
    await storage.set(`${key}.${profile.id}`, JSON.stringify(profile));
    await storage.set(key, JSON.stringify([...profiles.map((item) => item.id), profile.id]));
    return [...profiles, profile];
  });
}

export async function deleteProfile(storage: ProfileStorage, guardianId: string, id: string) {
  if (!validId.test(id)) throw new Error('Invalid profile id');
  const key = storageKey(guardianId);
  return writeProfiles(key, async () => {
    const profiles = await loadProfiles(storage, guardianId);
    const next = profiles.filter((profile) => profile.id !== id);
    await storage.set(key, JSON.stringify(next.map((profile) => profile.id)));
    await storage.set(`${key}.${id}`, 'null').catch(() => undefined);
    return next;
  });
}

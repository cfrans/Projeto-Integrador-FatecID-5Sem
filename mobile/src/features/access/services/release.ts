import { DEFAULT_BEDTIME, type Bedtime } from '../../settings/bedtime-value.ts';

export type ReleaseOptionId = 'min30' | 'hour1' | 'hour2' | 'bedtime' | 'week' | 'unlimited';

export type Release = {
  optionId: ReleaseOptionId;
  startedAt: string;
  endsAt: string | null;
  blockAtEnd: boolean;
};

export const releaseOptions: readonly { id: ReleaseOptionId; minutes: number | null }[] = [
  { id: 'min30', minutes: 30 },
  { id: 'hour1', minutes: 60 },
  { id: 'hour2', minutes: 120 },
  { id: 'bedtime', minutes: null },
  { id: 'week', minutes: null },
  { id: 'unlimited', minutes: null },
];

export function releaseEnd(optionId: ReleaseOptionId, from: Date, bedtime: Bedtime = DEFAULT_BEDTIME): Date | null {
  if (optionId === 'unlimited') return null;

  if (optionId === 'bedtime') {
    const end = new Date(from);
    end.setHours(bedtime.hour, bedtime.minute, 0, 0);
    if (end.getTime() <= from.getTime()) end.setDate(end.getDate() + 1);
    return end;
  }

  if (optionId === 'week') {
    const end = new Date(from);
    const daysUntilMonday = (8 - end.getDay()) % 7 || 7;
    end.setDate(end.getDate() + daysUntilMonday);
    end.setHours(0, 0, 0, 0);
    return end;
  }

  const minutes = releaseOptions.find((option) => option.id === optionId)?.minutes ?? 0;
  return new Date(from.getTime() + minutes * 60_000);
}

export function createRelease(optionId: ReleaseOptionId, blockAtEnd: boolean, from = new Date(), bedtime: Bedtime = DEFAULT_BEDTIME): Release {
  return {
    optionId,
    startedAt: from.toISOString(),
    endsAt: releaseEnd(optionId, from, bedtime)?.toISOString() ?? null,
    blockAtEnd,
  };
}

export function remainingMinutes(release: Release, now = new Date()) {
  if (!release.endsAt) return null;
  return Math.max(0, Math.ceil((new Date(release.endsAt).getTime() - now.getTime()) / 60_000));
}

export function totalMinutes(release: Release) {
  if (!release.endsAt) return null;
  return Math.round((new Date(release.endsAt).getTime() - new Date(release.startedAt).getTime()) / 60_000);
}

export function releaseStorageKey(guardianId: string, deviceId: string, associationId: string, requestId: string) {
  const parts = [guardianId, deviceId, associationId, requestId];
  if (parts.some((part) => !/^[a-zA-Z0-9-]+$/.test(part))) throw new Error('Invalid release scope');
  return `piplup.release.${parts.join('.')}`;
}

export function parseRelease(raw: string | null): Release | null {
  if (raw === null) return null;
  const value: unknown = JSON.parse(raw);
  if (!value || typeof value !== 'object') throw new Error('Invalid release');
  const item = value as Record<string, unknown>;
  const validDate = (date: unknown): date is string => typeof date === 'string'
    && Number.isFinite(Date.parse(date)) && new Date(date).toISOString() === date;
  if (!releaseOptions.some((option) => option.id === item.optionId)
    || !validDate(item.startedAt) || typeof item.blockAtEnd !== 'boolean'
    || (item.endsAt !== null && (!validDate(item.endsAt) || item.endsAt <= item.startedAt))
    || ((item.optionId === 'unlimited') !== (item.endsAt === null))) throw new Error('Invalid release');
  return { optionId: item.optionId as ReleaseOptionId, startedAt: item.startedAt, endsAt: item.endsAt as string | null, blockAtEnd: item.blockAtEnd };
}

type ReleaseStorage = {
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string) => Promise<void>;
  remove: (key: string) => Promise<void>;
};

export function createReleaseStorage(storage: ReleaseStorage) {
  return {
    async load(key: string) { return parseRelease(await storage.get(key)); },
    async save(key: string, release: Release | null) {
      if (release) await storage.set(key, JSON.stringify(parseRelease(JSON.stringify(release))));
      else await storage.remove(key);
    },
  };
}

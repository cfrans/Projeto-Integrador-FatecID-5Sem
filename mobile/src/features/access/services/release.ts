export type ReleaseOptionId = 'min30' | 'hour1' | 'hour2' | 'bedtime' | 'week' | 'unlimited';

export type Release = {
  optionId: ReleaseOptionId;
  startedAt: string;
  endsAt: string | null;
  blockAtEnd: boolean;
};

export const BEDTIME = { hour: 21, minute: 30 } as const;

export const releaseOptions: readonly { id: ReleaseOptionId; minutes: number | null }[] = [
  { id: 'min30', minutes: 30 },
  { id: 'hour1', minutes: 60 },
  { id: 'hour2', minutes: 120 },
  { id: 'bedtime', minutes: null },
  { id: 'week', minutes: 120 },
  { id: 'unlimited', minutes: null },
];

export function releaseEnd(optionId: ReleaseOptionId, from: Date): Date | null {
  if (optionId === 'unlimited') return null;

  if (optionId === 'bedtime') {
    const end = new Date(from);
    end.setHours(BEDTIME.hour, BEDTIME.minute, 0, 0);
    if (end.getTime() <= from.getTime()) end.setDate(end.getDate() + 1);
    return end;
  }

  const minutes = releaseOptions.find((option) => option.id === optionId)?.minutes ?? 0;
  return new Date(from.getTime() + minutes * 60_000);
}

export function createRelease(optionId: ReleaseOptionId, blockAtEnd: boolean, from = new Date()): Release {
  return {
    optionId,
    startedAt: from.toISOString(),
    endsAt: releaseEnd(optionId, from)?.toISOString() ?? null,
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

const releases = new Map<string, Release>();

export function getRelease(requestId: string) {
  return releases.get(requestId) ?? null;
}

export function storeRelease(requestId: string, release: Release) {
  releases.set(requestId, release);
}

export function clearRelease(requestId: string) {
  releases.delete(requestId);
}

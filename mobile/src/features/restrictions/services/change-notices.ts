import type { SynchronizationEntry } from './synchronization.ts';
import { realPolicyStatus } from './simulation.ts';

export type ChangeRecord = { associationId: string; appliedRevision: number | null; failedRevision: number | null };
export type ChangeRecords = Record<string, ChangeRecord>;
export type ChangeNotice =
  | { kind: 'applied'; computerId: string; computerName: string; revision: number; appliedAt: string | null }
  | { kind: 'failed'; computerId: string; computerName: string; revision: number; code: string };

type Storage = { get(key: string): Promise<string | null>; set(key: string, value: string): Promise<void> };

export function compareChangeNotices(previous: ChangeRecords | null, entries: SynchronizationEntry[]): { records: ChangeRecords; notices: ChangeNotice[] } {
  const records: ChangeRecords = { ...previous };
  const notices: ChangeNotice[] = [];
  for (const { computer, snapshot } of entries) {
    if (!snapshot) continue;
    const failed = realPolicyStatus(snapshot) === 'failed' && snapshot.error ? snapshot.revision : null;
    const known = previous?.[computer.id];
    const sameAssociation = known?.associationId === snapshot.associationId;
    records[computer.id] = {
      associationId: snapshot.associationId,
      appliedRevision: snapshot.appliedRevision,
      failedRevision: failed ?? (sameAssociation ? known.failedRevision : null),
    };
    if (!sameAssociation) continue;
    if (snapshot.appliedRevision !== null && snapshot.appliedRevision > (known.appliedRevision ?? 0)) {
      notices.push({ kind: 'applied', computerId: computer.id, computerName: computer.name, revision: snapshot.appliedRevision, appliedAt: snapshot.appliedAt });
    }
    if (failed !== null && failed !== known.failedRevision && snapshot.error) {
      notices.push({ kind: 'failed', computerId: computer.id, computerName: computer.name, revision: failed, code: snapshot.error.code });
    }
  }
  return { records, notices };
}

function parseRecords(value: string | null): ChangeRecords | null {
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    return Object.fromEntries(Object.entries(parsed).filter(([, record]) => !!record && typeof record === 'object'
      && typeof record.associationId === 'string'
      && (record.appliedRevision === null || Number.isSafeInteger(record.appliedRevision))
      && (record.failedRevision === null || Number.isSafeInteger(record.failedRevision)))) as ChangeRecords;
  } catch {
    return null;
  }
}

export async function checkChangeNotices(storage: Storage, guardianId: string, entries: SynchronizationEntry[]): Promise<ChangeNotice[]> {
  const key = `changeNotices.${guardianId}`;
  const { records, notices } = compareChangeNotices(parseRecords(await storage.get(key)), entries);
  await storage.set(key, JSON.stringify(records));
  return notices;
}

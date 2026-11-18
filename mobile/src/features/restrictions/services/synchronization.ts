import { apiErrorMessage } from '../../../lib/api.ts';
import { readSimulation, realPolicyStatus, type SimulationSnapshot } from './simulation.ts';

type Computer = { id: string; name: string; isDemo: boolean; isPaired: boolean; associationId: string | null };
export type SynchronizationEntry = { computer: Computer; snapshot: SimulationSnapshot | null; error: string | null };
export type SynchronizationStatus = 'error' | 'offline' | 'unknown' | 'pending' | 'applied' | 'realApplied' | 'realPending' | 'realOffline' | 'realFailed' | 'realDisabled' | 'realIdle';

const realStatuses = { applied: 'realApplied', pending: 'realPending', failed: 'realFailed', disabled: 'realDisabled', idle: 'realIdle' } as const;

export function synchronizationStatus(entry: SynchronizationEntry): SynchronizationStatus {
  if (entry.error || !entry.snapshot) return 'error';
  if (!entry.computer.isDemo) {
    const status = realStatuses[realPolicyStatus(entry.snapshot)];
    return status === 'realPending' && entry.snapshot.connection.status === 'offline' ? 'realOffline' : status;
  }
  if (entry.snapshot.connection.status === 'offline') return 'offline';
  if (entry.snapshot.connection.status === 'unverified') return 'unknown';
  return entry.snapshot.revision === entry.snapshot.appliedRevision ? 'applied' : 'pending';
}

export async function loadSynchronization(computers: Computer[], read = readSimulation): Promise<SynchronizationEntry[]> {
  return Promise.all(computers.filter((computer) => computer.isPaired).map(async (computer) => {
    try {
      const snapshot = await read(computer.id);
      if (snapshot.associationId !== computer.associationId) return { computer, snapshot: null, error: 'O vínculo do computador mudou. Consulte novamente.' };
      return { computer, snapshot, error: null };
    } catch (error) {
      return { computer, snapshot: null, error: apiErrorMessage(error) };
    }
  }));
}

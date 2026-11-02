import { apiErrorMessage } from '../../../lib/api.ts';
import { readSimulation, type SimulationSnapshot } from './simulation.ts';

type Computer = { id: string; name: string; isDemo: boolean; isPaired: boolean; associationId: string | null };
export type SynchronizationEntry = { computer: Computer; snapshot: SimulationSnapshot | null; error: string | null };
export type SynchronizationStatus = 'unavailable' | 'error' | 'offline' | 'unknown' | 'pending' | 'applied';

export function synchronizationStatus(entry: SynchronizationEntry): SynchronizationStatus {
  if (!entry.computer.isDemo) return 'unavailable';
  if (entry.error || !entry.snapshot) return 'error';
  if (entry.snapshot.connection.status === 'offline') return 'offline';
  if (entry.snapshot.connection.status === 'unverified') return 'unknown';
  return entry.snapshot.revision === entry.snapshot.appliedRevision ? 'applied' : 'pending';
}

export async function loadSynchronization(computers: Computer[], read = readSimulation): Promise<SynchronizationEntry[]> {
  return Promise.all(computers.filter((computer) => computer.isPaired).map(async (computer) => {
    if (!computer.isDemo) return { computer, snapshot: null, error: null };
    try {
      const snapshot = await read(computer.id);
      if (snapshot.associationId !== computer.associationId) return { computer, snapshot: null, error: 'O vínculo do computador mudou. Consulte novamente.' };
      return { computer, snapshot, error: null };
    } catch (error) {
      return { computer, snapshot: null, error: apiErrorMessage(error) };
    }
  }));
}

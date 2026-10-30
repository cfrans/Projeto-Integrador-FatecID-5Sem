import type { PairedComputer } from '@/features/devices/services/devices';
import { listInstallationRequests, type InstallationRequest } from '@/features/restrictions/services/installation-requests';

export type PendingRequest = { computer: PairedComputer; request: InstallationRequest };

export async function loadPendingRequests(computers: PairedComputer[]): Promise<PendingRequest[]> {
  const results = await Promise.allSettled(
    computers
      .filter((computer) => computer.isPaired)
      .map(async (computer) => (await listInstallationRequests(computer.id)).map((request) => ({ computer, request }))),
  );
  return results
    .flatMap((result) => (result.status === 'fulfilled' ? result.value : []))
    .sort((a, b) => b.request.requestedAt.localeCompare(a.request.requestedAt));
}

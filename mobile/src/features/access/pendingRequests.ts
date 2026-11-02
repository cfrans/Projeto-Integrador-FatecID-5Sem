import type { PairedComputer } from '../devices/services/devices.ts';
import { listInstallationRequests, listInstallationHistory, installationRequestsErrorMessage, type InstallationRequest } from '../restrictions/services/installation-requests.ts';

export type PendingRequest = { computer: PairedComputer; request: InstallationRequest };

export async function loadPendingRequestsReport(computers: PairedComputer[], history = false) {
  const paired = computers.filter((computer) => computer.isPaired);
  const results = await Promise.allSettled(
    paired
      .map(async (computer) => (await (history ? listInstallationHistory : listInstallationRequests)(computer.id)).map((request) => ({ computer, request }))),
  );
  const pending = results
    .flatMap((result) => (result.status === 'fulfilled' ? result.value : []))
    .sort((a, b) => b.request.requestedAt.localeCompare(a.request.requestedAt));
  const failures = results.flatMap((result, index) => result.status === 'rejected'
    ? [{ computer: paired[index], message: installationRequestsErrorMessage(result.reason) }]
    : []);
  return { pending, failures };
}

import type { PairedComputer } from '../devices/services/devices.ts';
import type { InstallationRequest } from '../restrictions/services/installation-requests.ts';

export type RequestBannerItem = { computer: PairedComputer; request: InstallationRequest };
export type RequestBannerState = { queue: RequestBannerItem[]; seen: Map<string, Set<string>> };
export type RequestReport = { computer: PairedComputer; requests: InstallationRequest[] };

export function emptyRequestBanners(): RequestBannerState {
  return { queue: [], seen: new Map() };
}

const scope = (computer: PairedComputer) => `${computer.id}.${computer.associationId}`;

export function updateRequestBanners(previous: RequestBannerState, computers: PairedComputer[], reports: RequestReport[]): RequestBannerState {
  const active = new Set(computers.filter((computer) => computer.isPaired && computer.associationId).map(scope));
  const seen = new Map([...previous.seen].filter(([key]) => active.has(key)));
  const reported = new Map(reports.filter((report) => active.has(scope(report.computer))).map((report) => [scope(report.computer), report]));
  const queue = previous.queue.filter((item) => active.has(scope(item.computer))
    && (!reported.has(scope(item.computer)) || reported.get(scope(item.computer))!.requests.some((request) => request.id === item.request.id)));
  for (const [key, report] of reported) {
    const observed = seen.get(key);
    const next = new Set(observed);
    for (const request of report.requests) {
      if (observed && !next.has(request.id)) queue.push({ computer: report.computer, request });
      next.add(request.id);
    }
    seen.set(key, next);
  }
  return { queue, seen };
}

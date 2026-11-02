import { findApplicationBrand } from './application-brand.ts';
import type { InstallationRequest } from './installation-requests.ts';

export function findApprovedRequest(requests: InstallationRequest[], applicationName: string) {
  const brand = findApplicationBrand(applicationName);
  return requests.filter((request) => request.status === 'APPROVED'
    && (request.applicationName.trim().toLowerCase() === applicationName.trim().toLowerCase()
      || (brand !== null && findApplicationBrand(request.applicationName) === brand)))
    .sort((a, b) => b.requestedAt.localeCompare(a.requestedAt))[0] ?? null;
}

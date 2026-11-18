import { ApiError, api, apiErrorMessage } from '../../../lib/api.ts';

export type InstalledApplication = {
  id: string;
  name: string;
  category: string;
  allowed: boolean;
  blockable: boolean;
  executable: string | null;
};

export type ConfiguredApplication = InstalledApplication & { group: InstalledApplication[] };

export class ApplicationsResponseError extends Error {
  constructor() {
    super('A API retornou uma lista de aplicativos inválida.');
    this.name = 'ApplicationsResponseError';
  }
}

function parseApplication(value: unknown): InstalledApplication {
  if (!value || typeof value !== 'object') throw new ApplicationsResponseError();
  const application = value as Record<string, unknown>;

  if (
    typeof application.id !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(application.id) ||
    typeof application.name !== 'string' ||
    !application.name.trim() ||
    typeof application.category !== 'string' ||
    typeof application.allowed !== 'boolean' ||
    !(
      (application.blockable === undefined && application.executable === undefined) ||
      (application.blockable === true && (application.executable === null || (typeof application.executable === 'string' && application.executable.startsWith('/')))) ||
      (application.blockable === false && application.executable === null)
    )
  ) {
    throw new ApplicationsResponseError();
  }

  return {
    id: application.id,
    name: application.name,
    category: application.category,
    allowed: application.allowed,
    blockable: application.blockable !== false,
    executable: typeof application.executable === 'string' ? application.executable : null,
  };
}

export function configureApplications(applications: InstalledApplication[], rules: Record<string, boolean>): ConfiguredApplication[] {
  const allowed = (application: InstalledApplication) => rules[application.id] ?? application.allowed;
  return applications.map((application) => {
    const group = application.executable === null ? [] : applications.filter((other) => other.id !== application.id && other.executable === application.executable);
    return { ...application, group, allowed: !application.blockable || (allowed(application) && group.every(allowed)) };
  });
}

export function parseApplicationsResponse(value: unknown) {
  if (!Array.isArray(value)) throw new ApplicationsResponseError();
  return value.map(parseApplication);
}

export async function listInstalledApplications(deviceId: string) {
  try {
    const response = await api.request<unknown>(
      `/devices/${encodeURIComponent(deviceId)}/applications`,
      { method: 'GET' },
    );
    return parseApplicationsResponse(response);
  } catch (error: unknown) {
    if (error instanceof ApiError || error instanceof ApplicationsResponseError) throw error;
    throw new Error(apiErrorMessage(error));
  }
}

export function applicationsErrorMessage(error: unknown) {
  if (error instanceof ApplicationsResponseError) return error.message;
  return apiErrorMessage(error);
}

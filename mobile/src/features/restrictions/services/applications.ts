import { ApiError, api, apiErrorMessage } from '@/lib/api';

export type InstalledApplication = {
  id: string;
  name: string;
  category: string;
  allowed: boolean;
};

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
    typeof application.name !== 'string' ||
    typeof application.category !== 'string' ||
    typeof application.allowed !== 'boolean'
  ) {
    throw new ApplicationsResponseError();
  }

  return {
    id: application.id,
    name: application.name,
    category: application.category,
    allowed: application.allowed,
  };
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

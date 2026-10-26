import { ApiError, api, apiErrorMessage } from '../../../lib/api.ts';

export type InstallationRequest = {
  id: string;
  applicationName: string;
  requesterName: string;
  requestedAt: string;
  ageRating: string;
};

export class InstallationRequestsResponseError extends Error {
  constructor() {
    super('A API retornou uma lista de pedidos de instalação inválida.');
    this.name = 'InstallationRequestsResponseError';
  }
}

function parseRequest(value: unknown): InstallationRequest {
  if (!value || typeof value !== 'object') throw new InstallationRequestsResponseError();
  const request = value as Record<string, unknown>;

  if (
    typeof request.id !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(request.id) ||
    typeof request.applicationName !== 'string' ||
    !request.applicationName.trim() ||
    typeof request.requesterName !== 'string' ||
    !request.requesterName.trim() ||
    typeof request.requestedAt !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(request.requestedAt) ||
    !Number.isFinite(new Date(request.requestedAt).getTime()) ||
    new Date(request.requestedAt).toISOString() !== request.requestedAt ||
    typeof request.ageRating !== 'string'
  ) {
    throw new InstallationRequestsResponseError();
  }

  return {
    id: request.id,
    applicationName: request.applicationName,
    requesterName: request.requesterName,
    requestedAt: request.requestedAt,
    ageRating: request.ageRating,
  };
}

export function parseInstallationRequestsResponse(value: unknown) {
  if (!Array.isArray(value)) throw new InstallationRequestsResponseError();
  return value.map(parseRequest);
}

export async function listInstallationRequests(deviceId: string) {
  try {
    const response = await api.request<unknown>(
      `/devices/${encodeURIComponent(deviceId)}/installation-requests`,
      { method: 'GET' },
    );
    return parseInstallationRequestsResponse(response);
  } catch (error: unknown) {
    if (error instanceof ApiError || error instanceof InstallationRequestsResponseError) throw error;
    throw new Error(apiErrorMessage(error));
  }
}

export function installationRequestsErrorMessage(error: unknown) {
  if (error instanceof InstallationRequestsResponseError) return error.message;
  return apiErrorMessage(error);
}

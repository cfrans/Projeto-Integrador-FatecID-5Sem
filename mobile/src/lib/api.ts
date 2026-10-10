export type ApiErrorKind = 'configuration' | 'unavailable' | 'validation' | 'unauthorized' | 'server' | 'unexpected';

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status?: number;

  constructor(
    kind: ApiErrorKind,
    message: string,
    status?: number,
  ) {
    super(message);
    this.name = 'ApiError';
    this.kind = kind;
    this.status = status;
  }
}

type RequestOptions = Omit<RequestInit, 'body' | 'headers'> & {
  body?: unknown;
  headers?: Record<string, string>;
  authenticated?: boolean;
  accessToken?: string;
};

const requestTimeoutMs = 10_000;
let accessToken: string | null = null;
let unauthorizedHandler: ((token: string) => void) | null = null;

function apiBaseUrl() {
  const value = process.env.EXPO_PUBLIC_API_URL?.trim();

  if (!value) {
    throw new ApiError('configuration', 'A API não está configurada neste aplicativo.');
  }

  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error();
    return url.toString().replace(/\/$/, '');
  } catch {
    throw new ApiError('configuration', 'A URL da API é inválida.');
  }
}

function responseMessage(payload: unknown) {
  if (!payload || typeof payload !== 'object' || !('message' in payload)) return undefined;
  const message = payload.message;
  if (typeof message === 'string') return message;
  if (Array.isArray(message)) return message.filter((item): item is string => typeof item === 'string').join(' ');
  return undefined;
}

async function parseResponse(response: Response) {
  if (response.status === 204) return undefined;

  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) return undefined;

  try {
    return await response.json() as unknown;
  } catch {
    return undefined;
  }
}

export const api = {
  setAccessToken(token: string | null) {
    accessToken = token;
  },

  onUnauthorized(handler: ((token: string) => void) | null) {
    unauthorizedHandler = handler;
  },

  async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const baseUrl = apiBaseUrl();
    const { authenticated, accessToken: requestToken, body, headers: requestHeaders, ...requestOptions } = options;
    const token = authenticated === false ? null : requestToken ?? accessToken;
    const headers: Record<string, string> = {
      Accept: 'application/json',
      ...requestHeaders,
    };

    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (token) headers.Authorization = `Bearer ${token}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);

    let response: Response;
    let payload: unknown;
    try {
      response = await fetch(`${baseUrl}/${path.replace(/^\//, '')}`, {
        ...requestOptions,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });
      payload = await parseResponse(response);
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError('unavailable', 'Não foi possível conectar à API. Confira a conexão e tente novamente.');
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      const kind: ApiErrorKind = response.status === 400
        ? 'validation'
        : response.status === 401
          ? 'unauthorized'
          : response.status >= 500
            ? 'server'
            : 'unexpected';

      if (response.status === 401 && token) unauthorizedHandler?.(token);

      throw new ApiError(
        kind,
        responseMessage(payload) ?? 'A API não conseguiu concluir a solicitação.',
        response.status,
      );
    }

    return payload as T;
  },
};

export function apiErrorMessage(error: unknown) {
  if (!(error instanceof ApiError)) return 'Não foi possível concluir a solicitação. Tente novamente.';

  switch (error.kind) {
    case 'configuration':
    case 'unavailable':
      return error.message;
    case 'validation':
      return error.message || 'Confira os dados informados.';
    case 'unauthorized':
      return 'E-mail ou senha incorretos.';
    case 'server':
      return error.message || 'A API está indisponível no momento. Tente novamente.';
    case 'unexpected':
      return error.message;
  }
}

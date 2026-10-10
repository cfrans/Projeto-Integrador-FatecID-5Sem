import { ApiError, api } from '@/lib/api';

export type Guardian = {
  id: string;
  name: string;
  email: string;
};

export type AuthSession = {
  accessToken: string;
  expiresAt: number;
  guardian: Guardian;
};

type LoginResponse = {
  accessToken: string;
  expiresIn: number;
  guardian: Guardian;
};

function isGuardian(value: unknown): value is Guardian {
  if (!value || typeof value !== 'object') return false;
  const guardian = value as Record<string, unknown>;
  return typeof guardian.id === 'string'
    && typeof guardian.name === 'string'
    && typeof guardian.email === 'string';
}

function isLoginResponse(value: unknown): value is LoginResponse {
  if (!value || typeof value !== 'object') return false;
  const response = value as Record<string, unknown>;
  return typeof response.accessToken === 'string'
    && response.accessToken.length > 0
    && typeof response.expiresIn === 'number'
    && Number.isFinite(response.expiresIn)
    && response.expiresIn > 0
    && isGuardian(response.guardian);
}

export const auth = {
  async login(email: string, password: string): Promise<AuthSession> {
    const response = await api.request<unknown>('/auth/login', {
      method: 'POST',
      body: { email, password },
      authenticated: false,
    });

    if (!isLoginResponse(response)) {
      throw new ApiError('unexpected', 'A API retornou uma sessão inválida.');
    }

    return {
      accessToken: response.accessToken,
      expiresAt: Date.now() + response.expiresIn * 1000,
      guardian: response.guardian,
    };
  },

  async me(token: string) {
    const guardian = await api.request<unknown>('/auth/me', { accessToken: token });
    if (!isGuardian(guardian)) {
      throw new ApiError('unexpected', 'A API retornou um responsável inválido.');
    }
    return guardian;
  },
};

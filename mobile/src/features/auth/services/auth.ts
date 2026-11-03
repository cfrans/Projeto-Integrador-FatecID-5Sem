import { ApiError, api } from '../../../lib/api.ts';

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

function isSecurityQuestionResponse(value: unknown): value is { question: string | null } {
  if (!value || typeof value !== 'object') return false;
  const response = value as Record<string, unknown>;
  return response.question === null || typeof response.question === 'string';
}

function isVerifyRecoveryResponse(value: unknown): value is { valid: boolean } {
  if (!value || typeof value !== 'object') return false;
  const response = value as Record<string, unknown>;
  return typeof response.valid === 'boolean';
}

export const auth = {
  async register(name: string, email: string, password: string): Promise<Guardian> {
    const guardian = await api.request<unknown>('/auth/register', {
      method: 'POST',
      body: { name, email, password },
      authenticated: false,
    });

    if (!isGuardian(guardian)) {
      throw new ApiError('unexpected', 'A API retornou um responsável inválido.');
    }
    return guardian;
  },

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

  async updateEmail(email: string): Promise<Guardian> {
    const guardian = await api.request<unknown>('/auth/me/email', {
      method: 'PATCH',
      body: { email },
    });
    if (!isGuardian(guardian)) {
      throw new ApiError('unexpected', 'A API retornou um responsável inválido.');
    }
    return guardian;
  },

  async updatePassword(currentPassword: string, newPassword: string): Promise<void> {
    await api.request<undefined>('/auth/me/password', {
      method: 'PATCH',
      body: { currentPassword, newPassword },
    });
  },

  async getSecurityQuestion(): Promise<string | null> {
    const response = await api.request<unknown>('/auth/me/security-question');
    if (!isSecurityQuestionResponse(response)) {
      throw new ApiError('unexpected', 'A API retornou uma pergunta de segurança inválida.');
    }
    return response.question;
  },

  async setSecurityQuestion(question: string, answer: string): Promise<string> {
    const response = await api.request<unknown>('/auth/me/security-question', {
      method: 'PUT',
      body: { question, answer },
    });
    if (!isSecurityQuestionResponse(response) || typeof response.question !== 'string') {
      throw new ApiError('unexpected', 'A API retornou uma pergunta de segurança inválida.');
    }
    return response.question;
  },

  async getRecoveryQuestion(email: string): Promise<string | null> {
    try {
      const response = await api.request<unknown>('/auth/recovery/question', {
        method: 'POST',
        body: { email },
        authenticated: false,
      });
      if (!isSecurityQuestionResponse(response) || typeof response.question !== 'string') {
        throw new ApiError('unexpected', 'A API retornou uma pergunta de segurança inválida.');
      }
      return response.question;
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        return null;
      }
      throw error;
    }
  },

  async verifyRecoveryAnswer(email: string, answer: string): Promise<boolean> {
    try {
      const response = await api.request<unknown>('/auth/recovery/verify', {
        method: 'POST',
        body: { email, answer },
        authenticated: false,
      });
      if (!isVerifyRecoveryResponse(response)) {
        throw new ApiError('unexpected', 'A API retornou uma validação de segurança inválida.');
      }
      return response.valid;
    } catch (error) {
      if (error instanceof ApiError && error.status === 400) {
        return false;
      }
      throw error;
    }
  },

  async resetPasswordWithSecurityAnswer(email: string, answer: string, newPassword: string): Promise<void> {
    await api.request<undefined>('/auth/recovery/reset', {
      method: 'POST',
      body: { email, answer, newPassword },
      authenticated: false,
    });
  },
};

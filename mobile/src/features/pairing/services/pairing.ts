export type PairingDevice = {
  id: string;
  name: string;
  managedUser: string | null;
  isDemo: boolean;
};

export type PairingPreview = {
  device: PairingDevice;
  expiresAt: string;
};

export type PairingResult = PairingDevice & {
  paired: true;
  associationId: string;
};

type PairingRequest = (path: string, options: { method: 'POST'; body: unknown }) => Promise<unknown>;

export class PairingResponseError extends Error {
  constructor() {
    super('The pairing API returned an invalid response.');
    this.name = 'PairingResponseError';
  }
}

export class PairingTokenError extends Error {
  readonly kind: 'invalid' | 'unavailable' | 'another-guardian';

  constructor(kind: PairingTokenError['kind']) {
    super(kind);
    this.name = 'PairingTokenError';
    this.kind = kind;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function parsePairingToken(value: string): string | null {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }

  if (url.protocol !== 'piplup:'
    || url.username
    || url.password
    || url.port
    || url.hostname !== 'pair'
    || url.pathname !== ''
    || url.hash) return null;
  const tokens = url.searchParams.getAll('token');
  if (tokens.length !== 1
    || [...url.searchParams.keys()].length !== 1
    || url.search !== `?token=${tokens[0]}`) return null;
  return /^[A-Za-z0-9_-]{43}$/.test(tokens[0]) ? tokens[0] : null;
}

function parseDevice(value: unknown): PairingDevice {
  if (!isRecord(value)
    || typeof value.id !== 'string'
    || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.id)
    || typeof value.name !== 'string'
    || (typeof value.managedUser !== 'string' && value.managedUser !== null)
    || typeof value.isDemo !== 'boolean') throw new PairingResponseError();

  return { id: value.id, name: value.name, managedUser: value.managedUser, isDemo: value.isDemo };
}

export function parsePairingPreview(value: unknown, now = Date.now()): PairingPreview {
  if (!isRecord(value) || value.valid !== true || typeof value.expiresAt !== 'string') throw new PairingResponseError();
  const expiresAt = new Date(value.expiresAt);
  if (!Number.isFinite(expiresAt.getTime())) throw new PairingResponseError();
  if (expiresAt.getTime() <= now) throw new PairingTokenError('unavailable');
  return { device: parseDevice(value.device), expiresAt: expiresAt.toISOString() };
}

export function parsePairingResult(value: unknown): PairingResult {
  if (!isRecord(value)
    || value.paired !== true
    || typeof value.associationId !== 'string'
    || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.associationId)
    || ('status' in value && value.status !== 'unverified')
    || ('lastSeen' in value && value.lastSeen !== null)) {
    throw new PairingResponseError();
  }
  return { ...parseDevice(value), paired: true, associationId: value.associationId };
}

export function createPairingSource(request: PairingRequest) {
  return {
    async validate(token: string) {
      try {
        return parsePairingPreview(await request('/pairing/validate', { method: 'POST', body: { token } }));
      } catch (error) {
        throw normalizePairingError(error);
      }
    },
    async complete(token: string) {
      try {
        return parsePairingResult(await request('/pairing/complete', { method: 'POST', body: { token } }));
      } catch (error) {
        throw normalizePairingError(error);
      }
    },
  };
}

function normalizePairingError(error: unknown) {
  if (error instanceof PairingResponseError || error instanceof PairingTokenError) return error;
  if (isRecord(error)) {
    if (error.status === 400) return new PairingTokenError('invalid');
    if (error.status === 410) return new PairingTokenError('unavailable');
    if (error.status === 409) return new PairingTokenError('another-guardian');
  }
  return error;
}

export function pairingErrorMessage(error: unknown) {
  if (error instanceof PairingTokenError) {
    switch (error.kind) {
      case 'invalid': return 'Este QR Code não tem um formato válido. Aponte a câmera para um QR de pareamento.';
      case 'unavailable': return 'Este QR Code expirou, já foi usado ou foi revogado. Gere um novo no computador.';
      case 'another-guardian': return 'Este computador já tem outro responsável ativo.';
    }
  }
  if (error instanceof PairingResponseError) return 'A API retornou uma resposta de pareamento inválida.';
  if (isRecord(error) && error.status === 401) return 'Sua sessão expirou. Entre novamente.';
  return 'Não foi possível concluir a solicitação. Confira sua conexão e tente novamente.';
}

export function pairingCompletionErrorMessage(error: unknown) {
  if (!(error instanceof PairingTokenError)
    && !(error instanceof PairingResponseError)
    && !(isRecord(error) && error.status === 401)) {
    return 'A resposta do pareamento não chegou. Confira a lista de computadores antes de tentar novamente.';
  }
  return pairingErrorMessage(error);
}

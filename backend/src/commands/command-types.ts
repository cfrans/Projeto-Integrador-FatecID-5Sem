import { BadRequestException } from '@nestjs/common';

export const COMMAND_TYPES = [
  'agent.ping',
  'parental.app_filter.set',
  'parental.app_filter.read',
] as const;
export type CommandType = (typeof COMMAND_TYPES)[number];
export const GUARDIAN_COMMAND_TYPES = [
  'agent.ping',
  'parental.app_filter.read',
] as const;
export const COMMAND_TTL_MS = 300_000;

export const BASE_ERROR_CODES = [
  'UNSUPPORTED_OPERATION',
  'INVALID_PARAMETERS',
  'EXECUTION_TIMEOUT',
  'LOCAL_UNAVAILABLE',
] as const;
export const PARENTAL_ERROR_CODES = [
  ...BASE_ERROR_CODES,
  'PERMISSION_DENIED',
  'ACCOUNT_NOT_MANAGED',
  'VERIFICATION_FAILED',
  'POLICY_UNAVAILABLE',
] as const;
export const ALL_ERROR_CODES = PARENTAL_ERROR_CODES;

export const MAX_BLOCKED_APPLICATIONS = 200;
const SOURCE_ID = /^[A-Za-z0-9][A-Za-z0-9._+:-]{0,190}$/;

export type AppFilter = {
  blockedApplications: string[];
  blockInstallation: boolean;
};

export const isParental = (type: string) => type.startsWith('parental.');

export function errorCodesFor(type: string): readonly string[] {
  return isParental(type) ? PARENTAL_ERROR_CODES : BASE_ERROR_CODES;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function hasExactKeys(value: Record<string, unknown>, keys: string[]) {
  const actual = Object.keys(value).sort();
  return (
    actual.length === keys.length &&
    [...keys].sort().every((key, index) => key === actual[index])
  );
}

export function normalizeAppFilter(
  value: unknown,
  invalid: () => Error,
): AppFilter {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ['blockedApplications', 'blockInstallation']) ||
    typeof value.blockInstallation !== 'boolean' ||
    !Array.isArray(value.blockedApplications) ||
    value.blockedApplications.length > MAX_BLOCKED_APPLICATIONS ||
    value.blockedApplications.some(
      (id) => typeof id !== 'string' || !SOURCE_ID.test(id),
    )
  )
    throw invalid();
  const ids = value.blockedApplications as string[];
  if (new Set(ids).size !== ids.length) throw invalid();
  return {
    blockedApplications: [...ids].sort(),
    blockInstallation: value.blockInstallation,
  };
}

export function normalizeParameters(
  type: string,
  parameters: unknown,
): Record<string, unknown> {
  const invalid = () =>
    new BadRequestException('Parâmetros inválidos para a operação.');
  if (type === 'parental.app_filter.set')
    return normalizeAppFilter(parameters, invalid);
  if (!isRecord(parameters) || Object.keys(parameters).length > 0)
    throw invalid();
  return {};
}

export type NormalizedResult =
  | { status: 'succeeded'; result: Record<string, unknown>; errorCode: null }
  | { status: 'failed'; result: null; errorCode: string };

export function normalizeResult(
  command: { type: string; parameters: unknown },
  input: { status: 'succeeded' | 'failed'; result: unknown; error: unknown },
): NormalizedResult {
  const invalidResult = () =>
    new BadRequestException('Resultado inválido para a operação.');
  if (input.status === 'failed') {
    if (
      input.result !== null ||
      !isRecord(input.error) ||
      !hasExactKeys(input.error, ['code']) ||
      typeof input.error.code !== 'string' ||
      !errorCodesFor(command.type).includes(input.error.code)
    )
      throw new BadRequestException('Código de falha inválido.');
    return { status: 'failed', result: null, errorCode: input.error.code };
  }
  if (input.error !== null) throw invalidResult();
  if (command.type === 'agent.ping') {
    if (
      !isRecord(input.result) ||
      !hasExactKeys(input.result, ['reachable']) ||
      input.result.reachable !== true
    )
      throw new BadRequestException('Resultado de ping inválido.');
    return { status: 'succeeded', result: { reachable: true }, errorCode: null };
  }
  const observed = normalizeAppFilter(input.result, invalidResult);
  if (command.type === 'parental.app_filter.set') {
    const wanted = normalizeAppFilter(command.parameters, invalidResult);
    if (JSON.stringify(observed) !== JSON.stringify(wanted))
      throw new BadRequestException(
        'Sucesso exige que o estado observado confirme a política pedida.',
      );
  }
  return { status: 'succeeded', result: observed, errorCode: null };
}

export function canonicalResult(type: string, value: unknown) {
  return type === 'agent.ping'
    ? { reachable: true }
    : normalizeAppFilter(
        value,
        () => new Error('Resultado armazenado inválido.'),
      );
}

export type PolicyState ='pending' | 'applied' | 'drifted' | 'failed';

export function policyState(policy: {
  appFilter: unknown;
  revision: number;
  appliedRevision: number | null;
  observedAppFilter: unknown;
  lastErrorCode: string | null;
}): PolicyState {
  if (policy.appliedRevision !== policy.revision)
    return policy.lastErrorCode ? 'failed' : 'pending';
  if (
    policy.observedAppFilter &&
    JSON.stringify(normalizeAppFilter(policy.observedAppFilter, () => new Error())) !==
      JSON.stringify(normalizeAppFilter(policy.appFilter, () => new Error()))
  )
    return 'drifted';
  return 'applied';
}

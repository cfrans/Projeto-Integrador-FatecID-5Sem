import {
  canonicalResult,
  normalizeParameters,
  normalizeResult,
  policyState,
} from './command-types.js';

const set = { type: 'parental.app_filter.set' };
const filter = (ids: string[], block = false) => ({
  blockedApplications: ids,
  blockInstallation: block,
});

describe('command parameters', () => {
  it('keeps ping and read free of parameters', () => {
    expect(normalizeParameters('agent.ping', {})).toEqual({});
    expect(normalizeParameters('parental.app_filter.read', {})).toEqual({});
    expect(() => normalizeParameters('agent.ping', { a: 1 })).toThrow();
    expect(() => normalizeParameters('parental.app_filter.read', [])).toThrow();
  });

  it('sorts the blocked applications and rejects anything outside the contract', () => {
    expect(
      normalizeParameters(set.type, filter(['org.zed', 'com.apple.a'], true)),
    ).toEqual(filter(['com.apple.a', 'org.zed'], true));
    for (const invalid of [
      filter(['a', 'a']),
      filter(['bad id']),
      filter(['../etc/passwd']),
      filter(['']),
      filter(Array.from({ length: 201 }, (_, i) => `app${i}`)),
      { blockedApplications: ['a'] },
      { ...filter(['a']), extra: true },
      { blockedApplications: 'a', blockInstallation: false },
      { blockedApplications: ['a'], blockInstallation: 'yes' },
      null,
    ])
      expect(() => normalizeParameters(set.type, invalid)).toThrow();
  });
});

describe('command results', () => {
  const command = { ...set, parameters: filter(['a', 'b'], true) };
  const ok = (result: unknown) => ({
    status: 'succeeded' as const,
    result,
    error: null,
  });

  it('accepts success only when the observed state confirms the requested policy', () => {
    expect(normalizeResult(command, ok(filter(['b', 'a'], true)))).toEqual({
      status: 'succeeded',
      result: filter(['a', 'b'], true),
      errorCode: null,
    });
    expect(() => normalizeResult(command, ok(filter(['a'], true)))).toThrow();
    expect(() => normalizeResult(command, ok(filter(['a', 'b'])))).toThrow();
    expect(() =>
      normalizeResult(command, { ...ok(filter(['a', 'b'], true)), error: {} }),
    ).toThrow();
  });

  it('accepts any well-formed observation for a read and the ping result for a ping', () => {
    const read = { type: 'parental.app_filter.read', parameters: {} };
    expect(normalizeResult(read, ok(filter(['x']))).result).toEqual(
      filter(['x']),
    );
    expect(() => normalizeResult(read, ok({ reachable: true }))).toThrow();
    const ping = { type: 'agent.ping', parameters: {} };
    expect(normalizeResult(ping, ok({ reachable: true })).status).toBe(
      'succeeded',
    );
    expect(() => normalizeResult(ping, ok(filter([])))).toThrow();
  });

  it('allows parental error codes only for parental commands', () => {
    const failed = (code: string) => ({
      status: 'failed' as const,
      result: null,
      error: { code },
    });
    expect(
      normalizeResult(command, failed('VERIFICATION_FAILED')).errorCode,
    ).toBe('VERIFICATION_FAILED');
    expect(() =>
      normalizeResult({ type: 'agent.ping', parameters: {} }, failed('PERMISSION_DENIED')),
    ).toThrow();
    expect(() => normalizeResult(command, failed('OTHER'))).toThrow();
    expect(() =>
      normalizeResult(command, {
        status: 'failed',
        result: filter([]),
        error: { code: 'LOCAL_UNAVAILABLE' },
      }),
    ).toThrow();
  });

  it('canonicalizes stored results for idempotent comparison', () => {
    expect(canonicalResult('agent.ping', { reachable: true })).toEqual({
      reachable: true,
    });
    expect(canonicalResult(set.type, filter(['b', 'a']))).toEqual(
      filter(['a', 'b']),
    );
  });
});

describe('policy state', () => {
  const base = {
    appFilter: filter(['a']),
    revision: 2,
    appliedRevision: null as number | null,
    observedAppFilter: null as unknown,
    lastErrorCode: null as string | null,
  };

  it('is pending until the current revision is applied, and failed after a typed failure', () => {
    expect(policyState(base)).toBe('pending');
    expect(policyState({ ...base, appliedRevision: 1 })).toBe('pending');
    expect(policyState({ ...base, lastErrorCode: 'PERMISSION_DENIED' })).toBe(
      'failed',
    );
  });

  it('is applied when the revision matches and drifted when a later read differs', () => {
    const applied = { ...base, appliedRevision: 2, observedAppFilter: filter(['a']) };
    expect(policyState(applied)).toBe('applied');
    expect(policyState({ ...applied, observedAppFilter: filter([]) })).toBe(
      'drifted',
    );
    expect(policyState({ ...applied, observedAppFilter: null })).toBe('applied');
  });
});

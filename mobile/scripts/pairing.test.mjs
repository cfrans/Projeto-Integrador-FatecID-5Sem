import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  createPairingSource,
  PairingResponseError,
  PairingTokenError,
  pairingCompletionErrorMessage,
  parsePairingPreview,
  parsePairingResult,
  parsePairingToken,
} from '../src/features/pairing/services/pairing.ts';

const token = 'A'.repeat(43);
const device = {
  id: 'd9cdd54a-0083-4b43-b0d4-a54aa87b8998',
  name: 'Notebook da Ana',
  managedUser: null,
  isDemo: true,
};

test('accepts only the exact piplup pairing QR payload with a 43 character base64url token', () => {
  assert.equal(parsePairingToken(`piplup://pair?token=${token}`), token);

  for (const value of [
    `https://pair?token=${token}`,
    `piplup://other?token=${token}`,
    `piplup://pair/path?token=${token}`,
    `piplup://pair/?token=${token}`,
    `piplup://user@pair?token=${token}`,
    `piplup://user:password@pair?token=${token}`,
    `piplup://pair:8080?token=${token}`,
    `piplup://pair?token=${token}&other=x`,
    `piplup://pair?token=${token}&token=${token}`,
    `piplup://pair?token=${token}#fragment`,
    `piplup://pair?token=${token.slice(1)}`,
    `piplup://pair?token=${token.slice(1)}!`,
  ]) assert.equal(parsePairingToken(value), null, value);
});

test('validates the response expiry against the current clock and validates the device shape', () => {
  const now = Date.parse('2026-10-11T12:00:00.000Z');
  const valid = { valid: true, expiresAt: '2026-10-11T12:05:00.000Z', device };
  assert.deepEqual(parsePairingPreview(valid, now), { device, expiresAt: valid.expiresAt });
  assert.throws(() => parsePairingPreview({ ...valid, expiresAt: '2026-10-11T11:59:00.000Z' }, now), PairingTokenError);
  assert.throws(() => parsePairingPreview({ ...valid, expiresAt: 'not-a-date' }, now), PairingResponseError);
  assert.throws(() => parsePairingPreview({ ...valid, device: { ...device, isDemo: 'true' } }, now), PairingResponseError);
});

test('validates active association result and optional connectivity fields', () => {
  const result = { ...device, paired: true, associationId: '5a9cfd5c-9e62-4c08-94dd-d77f617c0975' };
  assert.deepEqual(parsePairingResult(result), result);
  assert.throws(() => parsePairingResult({ ...result, associationId: 'association-1' }), PairingResponseError);
  assert.throws(() => parsePairingResult({ ...result, status: 'online' }), PairingResponseError);
  assert.throws(() => parsePairingResult({ ...result, lastSeen: '2026-10-11T12:00:00Z' }), PairingResponseError);
});

test('posts the token to validate and complete without putting it in a URL', async () => {
  const calls = [];
  const source = createPairingSource(async (path, options) => {
    calls.push({ path, options });
    if (path.endsWith('/validate')) return { valid: true, expiresAt: '2099-10-11T12:05:00.000Z', device };
    return { ...device, paired: true, associationId: '5a9cfd5c-9e62-4c08-94dd-d77f617c0975' };
  });

  await source.validate(token);
  await source.complete(token);
  assert.deepEqual(calls, [
    { path: '/pairing/validate', options: { method: 'POST', body: { token } } },
    { path: '/pairing/complete', options: { method: 'POST', body: { token } } },
  ]);
});

test('maps invalid, expired and already-owned backend responses to pairing errors', async () => {
  for (const [status, kind] of [[400, 'invalid'], [410, 'unavailable'], [409, 'another-guardian']]) {
    const source = createPairingSource(async () => { throw { status }; });
    await assert.rejects(source.validate(token), (error) => error instanceof PairingTokenError && error.kind === kind);
  }
});

test('uncertain completion failures direct the guardian to check the device list', () => {
  assert.match(pairingCompletionErrorMessage(new Error('network lost')), /Confira a lista de computadores/);
});

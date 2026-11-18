import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { api, apiErrorMessage } from '../src/lib/api.ts';
import { parseSimulation, readSimulation, realPolicyStatus, updateSimulation } from '../src/features/restrictions/services/simulation.ts';

const snapshot = { associationId: '946ec23b-4fb8-4faa-94dd-471d67588c84', revision: 2, appliedRevision: 1, appliedAt: '2026-10-25T12:00:00.000Z', connection: { status: 'online', lastSeen: '2026-10-25T12:00:00.000Z' }, settings: { blockBrowsers: true, allowedBrowsers: { firefox: true, chromium: false, brave: false, 'gnome-web': true }, blockInstallation: true, ageRating: '12', applicationRules: {}, installationDecisions: {} } };
const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; api.setAccessToken(null); });

test('distinguishes pending changes from an acknowledged simulation', () => {
  assert.equal(parseSimulation(snapshot).appliedRevision, 1);
  assert.equal(parseSimulation({ ...snapshot, appliedRevision: 2 }).appliedRevision, 2);
  for (const invalid of [null, {}, { ...snapshot, connection: { status: 'online', lastSeen: null } }, { ...snapshot, connection: { status: 'other', lastSeen: null } }, { ...snapshot, associationId: 'other' }, { ...snapshot, appliedRevision: 3 }, { ...snapshot, revision: 0 }, { ...snapshot, settings: { ...snapshot.settings, allowedBrowsers: {} } }, { ...snapshot, settings: { ...snapshot.settings, applicationRules: { arbitrary: true } } }]) assert.throws(() => parseSimulation(invalid));
});

test('loads and updates only the selected computer using guardian authentication and revision', async () => {
  process.env.EXPO_PUBLIC_API_URL = 'http://127.0.0.1:3000';
  api.setAccessToken('guardian');
  const calls = [];
  globalThis.fetch = async (url, options) => { calls.push({ url, options }); return Response.json(snapshot); };
  await readSimulation('device');
  await updateSimulation('device', 2, { ageRating: '16' });
  assert.equal(calls[0].url, 'http://127.0.0.1:3000/simulation/devices/device');
  assert.equal(calls[1].options.headers.Authorization, 'Bearer guardian');
  assert.deepEqual(JSON.parse(calls[1].options.body), { revision: 2, settings: { ageRating: '16' } });
  globalThis.fetch = async () => Response.json({ message: 'As configurações mudaram.' }, { status: 409 });
  await assert.rejects(updateSimulation('device', 2, { ageRating: '16' }), { status: 409 });
});

test('accepts the real computer policy fields and derives a status that never shows pending as applied', () => {
  const real = { ...snapshot, connection: { status: 'unverified', lastSeen: null }, error: null, enforcement: 'enabled' };
  assert.equal(realPolicyStatus(parseSimulation(real)), 'pending');
  assert.equal(realPolicyStatus(parseSimulation({ ...real, appliedRevision: 2 })), 'applied');
  assert.equal(realPolicyStatus(parseSimulation({ ...real, error: { code: 'POLICY_UNAVAILABLE', at: '2026-11-17T12:00:00.000Z' } })), 'failed');
  assert.equal(realPolicyStatus(parseSimulation({ ...real, error: { code: 'EXECUTION_TIMEOUT', at: null } })), 'failed');
  assert.equal(realPolicyStatus(parseSimulation({ ...real, enforcement: 'disabled' })), 'disabled');
  assert.equal(realPolicyStatus(parseSimulation({ ...real, revision: 1, appliedRevision: null, appliedAt: null })), 'idle');
  assert.equal(realPolicyStatus(parseSimulation({ ...real, revision: 2, appliedRevision: null, appliedAt: null })), 'pending');
  for (const invalid of [{ ...real, error: { code: '' , at: null } }, { ...real, error: { code: 'X', at: 'yesterday' } }, { ...real, error: 'failed' }, { ...real, enforcement: 'on' }]) assert.throws(() => parseSimulation(invalid));
});

test('keeps the backend message when a group rule is refused', async () => {
  process.env.EXPO_PUBLIC_API_URL = 'http://127.0.0.1:3000';
  const message = 'LibreOffice Writer não pode ser bloqueado com segurança. Nenhuma alteração foi salva.';
  globalThis.fetch = async () => Response.json({ statusCode: 400, message, error: 'Bad Request' }, { status: 400 });
  const error = await updateSimulation('device', 2, { applicationRules: {} }).catch((cause) => cause);
  assert.equal(apiErrorMessage(error), message);
});

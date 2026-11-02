import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadSynchronization, synchronizationStatus } from '../src/features/restrictions/services/synchronization.ts';

const computer = { id: 'pc', name: 'PC', isDemo: true, isPaired: true, associationId: 'association' };
const snapshot = { associationId: 'association', revision: 2, appliedRevision: 1, appliedAt: null, connection: { status: 'online', lastSeen: '2026-11-02T12:00:00Z' } };

test('synchronization distinguishes acknowledgement, pending, offline, unknown and read failures', () => {
  const entry = { computer, snapshot, error: null };
  assert.equal(synchronizationStatus(entry), 'pending');
  assert.equal(synchronizationStatus({ ...entry, snapshot: { ...snapshot, appliedRevision: 2 } }), 'applied');
  assert.equal(synchronizationStatus({ ...entry, snapshot: { ...snapshot, appliedRevision: 2, connection: { status: 'offline' } } }), 'offline');
  assert.equal(synchronizationStatus({ ...entry, snapshot: { ...snapshot, connection: { status: 'unverified' } } }), 'unknown');
  assert.equal(synchronizationStatus({ ...entry, error: 'network' }), 'error');
  assert.equal(synchronizationStatus({ ...entry, snapshot: null }), 'error');
  assert.equal(synchronizationStatus({ ...entry, computer: { ...computer, isDemo: false } }), 'unavailable');
});

test('synchronization skips real or revoked computers and isolates individual read failures', async () => {
  const calls = [];
  const entries = await loadSynchronization([computer, { ...computer, id: 'failed' }, { ...computer, id: 'real', isDemo: false }, { ...computer, id: 'revoked', isPaired: false }], async (id) => {
    calls.push(id);
    if (id === 'failed') throw new Error('network');
    return snapshot;
  });
  assert.deepEqual(calls, ['pc', 'failed']);
  assert.equal(entries.length, 3);
  assert.equal(synchronizationStatus(entries[0]), 'pending');
  assert.equal(synchronizationStatus(entries[1]), 'error');
  assert.equal(entries[1].snapshot, null);
  assert.equal(synchronizationStatus(entries[2]), 'unavailable');
});

test('reports from a previous association cannot appear as confirmed for a new association', async () => {
  const [entry] = await loadSynchronization([computer], async () => ({ ...snapshot, associationId: 'old-association', appliedRevision: 2 }));
  assert.equal(synchronizationStatus(entry), 'error');
  assert.equal(entry.snapshot, null);
  assert.match(entry.error, /vínculo/);
});

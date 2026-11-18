import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkChangeNotices, compareChangeNotices } from '../src/features/restrictions/services/change-notices.ts';

const association = '11111111-1111-4111-8111-111111111111';
const computer = { id: 'pc', name: 'PC', isDemo: false, isPaired: true, associationId: association };
const snapshot = { associationId: association, revision: 3, appliedRevision: 2, appliedAt: '2026-11-18T12:00:00Z', connection: { status: 'unverified', lastSeen: null }, error: null, enforcement: 'enabled' };
const entry = (changes = {}) => ({ computer, snapshot: { ...snapshot, ...changes }, error: null });

test('change notices only record the state on the first comparison', () => {
  const { records, notices } = compareChangeNotices(null, [entry()]);
  assert.deepEqual(notices, []);
  assert.deepEqual(records, { pc: { associationId: association, appliedRevision: 2, failedRevision: null } });
});

test('change notices report an applied revision once', () => {
  const first = compareChangeNotices(null, [entry()]).records;
  const applied = compareChangeNotices(first, [entry({ appliedRevision: 3 })]);
  assert.deepEqual(applied.notices, [{ kind: 'applied', computerId: 'pc', computerName: 'PC', revision: 3, appliedAt: snapshot.appliedAt }]);
  assert.deepEqual(compareChangeNotices(applied.records, [entry({ appliedRevision: 3 })]).notices, []);
});

test('change notices report each failed revision once and ignore disabled enforcement', () => {
  const first = compareChangeNotices(null, [entry()]).records;
  const failed = compareChangeNotices(first, [entry({ error: { code: 'PERMISSION_DENIED', at: null } })]);
  assert.deepEqual(failed.notices, [{ kind: 'failed', computerId: 'pc', computerName: 'PC', revision: 3, code: 'PERMISSION_DENIED' }]);
  assert.deepEqual(compareChangeNotices(failed.records, [entry({ error: { code: 'PERMISSION_DENIED', at: null } })]).notices, []);
  assert.deepEqual(compareChangeNotices(failed.records, [entry()]).records.pc.failedRevision, 3);
  assert.equal(compareChangeNotices(failed.records, [entry({ revision: 4, error: { code: 'VERIFICATION_FAILED', at: null } })]).notices[0].revision, 4);
  assert.deepEqual(compareChangeNotices(first, [entry({ enforcement: 'disabled', error: { code: 'PERMISSION_DENIED', at: null } })]).notices, []);
});

test('change notices restart after a new association and keep records of unreadable computers', () => {
  const first = compareChangeNotices(null, [entry()]).records;
  const other = '22222222-2222-4222-8222-222222222222';
  assert.deepEqual(compareChangeNotices(first, [entry({ associationId: other, appliedRevision: 3 })]).notices, []);
  const unreadable = compareChangeNotices(first, [{ computer, snapshot: null, error: 'network' }]);
  assert.deepEqual(unreadable, { records: first, notices: [] });
});

test('change notices are stored per guardian and survive invalid storage', async () => {
  const values = new Map([['changeNotices.other', '{"pc":{"associationId":"' + association + '","appliedRevision":1,"failedRevision":null}}'], ['changeNotices.broken', '{']]);
  const storage = { get: async (key) => values.get(key) ?? null, set: async (key, value) => { values.set(key, value); } };
  assert.equal((await checkChangeNotices(storage, 'other', [entry()])).length, 1);
  assert.deepEqual(await checkChangeNotices(storage, 'guardian', [entry()]), []);
  assert.deepEqual(await checkChangeNotices(storage, 'broken', [entry()]), []);
  assert.equal(JSON.parse(values.get('changeNotices.guardian')).pc.appliedRevision, 2);
});

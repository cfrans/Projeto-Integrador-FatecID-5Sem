import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequestNotifier } from '../src/features/notifications/request-notifier.ts';

const computer = { id: 'pc-1', name: 'PC da sala', status: 'online', managedUser: null, lastSeen: null, isDemo: true, isPaired: true, associationId: 'a-1' };
const item = (id, application = 'Discord') => ({ computer, request: { id, applicationName: application, requesterName: 'Pedro', requestedAt: '2026-11-16T12:00:00.000Z', ageRating: '12' } });
const text = {
  title: 'Pedido de liberação',
  single: ({ requester, application, computer: name }) => `${requester} pediu ${application} em ${name}`,
  many: (count) => `${count} novos pedidos`,
};

function port(state) {
  const calls = { requests: 0, scheduled: [] };
  return {
    calls,
    permission: async () => state.current,
    requestPermission: async () => { calls.requests += 1; return state.next ?? state.current; },
    schedule: async (notification) => { calls.scheduled.push(notification); },
  };
}

test('a single new request names the requester, application and computer and links to its screen', async () => {
  const fake = port({ current: 'granted' });
  assert.equal(await createRequestNotifier(fake, text).notify([item('r1')]), true);
  assert.deepEqual(fake.calls.scheduled, [{
    title: 'Pedido de liberação',
    body: 'Pedro pediu Discord em PC da sala',
    data: { route: 'access-request', deviceId: 'pc-1', requestId: 'r1' },
  }]);
});

test('several new requests are grouped into one notification for the list screen', async () => {
  const fake = port({ current: 'granted' });
  await createRequestNotifier(fake, text).notify([item('r1'), item('r2', 'Steam')]);
  assert.equal(fake.calls.scheduled.length, 1);
  assert.equal(fake.calls.scheduled[0].body, '2 novos pedidos');
  assert.deepEqual(fake.calls.scheduled[0].data, { route: 'access-requests' });
});

test('nothing is scheduled without permission or without requests, and notify never prompts', async () => {
  for (const current of ['denied', 'undetermined']) {
    const fake = port({ current });
    assert.equal(await createRequestNotifier(fake, text).notify([item('r1')]), false);
    assert.equal(fake.calls.scheduled.length, 0);
    assert.equal(fake.calls.requests, 0);
  }
  const granted = port({ current: 'granted' });
  assert.equal(await createRequestNotifier(granted, text).notify([]), false);
});

test('ensurePermission asks only while undetermined and reports the outcome', async () => {
  const undetermined = port({ current: 'undetermined', next: 'granted' });
  assert.equal(await createRequestNotifier(undetermined, text).ensurePermission(), true);
  assert.equal(undetermined.calls.requests, 1);
  const refused = port({ current: 'undetermined', next: 'denied' });
  assert.equal(await createRequestNotifier(refused, text).ensurePermission(), false);
  const denied = port({ current: 'denied' });
  assert.equal(await createRequestNotifier(denied, text).ensurePermission(), false);
  assert.equal(denied.calls.requests, 0);
  const granted = port({ current: 'granted' });
  assert.equal(await createRequestNotifier(granted, text).ensurePermission(), true);
  assert.equal(granted.calls.requests, 0);
});

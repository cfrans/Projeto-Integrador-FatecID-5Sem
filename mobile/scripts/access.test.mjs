import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { api } from '../src/lib/api.ts';
import { loadPendingRequestsReport } from '../src/features/access/pendingRequests.ts';
import { createRelease, createReleaseStorage, parseRelease, releaseEnd, releaseStorageKey, remainingMinutes } from '../src/features/access/services/release.ts';
import { formatBedtime, parseBedtime } from '../src/features/settings/bedtime-value.ts';
import { createBedtimeStore } from '../src/features/settings/bedtime-store.ts';
import { parseInstallationHistory, listInstallationHistory } from '../src/features/restrictions/services/installation-requests.ts';
import { emptyRequestBanners, updateRequestBanners } from '../src/features/access/request-banner-state.ts';
import { findApprovedRequest } from '../src/features/restrictions/services/application-release.ts';
import { applicationCatalog } from '../../simulated-client/catalog.mjs';
import { findApplicationBrand, flathubIds } from '../src/features/restrictions/services/application-brand.ts';
import { fetchCatalogDetails } from '../src/features/access/services/flathub.ts';

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; api.setAccessToken(null); });

test('every simulator app resolves to its own catalog entry, including desktop ID aliases', async () => {
  const signal = new AbortController().signal;
  for (const { name, id } of applicationCatalog) {
    const brand = findApplicationBrand(name);
    assert.equal(brand, id);
    const flatpak = flathubIds[brand];
    assert.equal(findApplicationBrand(flatpak), brand);
    globalThis.fetch = async (url) => {
      assert.equal(url, `https://flathub.org/api/v2/appstream/${flatpak}?locale=pt-BR`);
      return Response.json({ id: flatpak, summary: name });
    };
    assert.equal((await fetchCatalogDetails(brand, 'pt-BR', signal)).summary, name);
  }
  assert.equal(findApplicationBrand('Unknown program'), null);
});

test('GIMP requests public localized metadata and selects a display-sized Flathub image', async () => {
  const signal = new AbortController().signal;
  const uri = 'https://dl.flathub.org/media/gimp/624.png';
  globalThis.fetch = async (url, options) => {
    assert.equal(url, 'https://flathub.org/api/v2/appstream/org.gimp.GIMP?locale=es');
    assert.deepEqual(options, { credentials: 'omit', signal });
    return Response.json({ id: 'org.gimp.GIMP', summary: ' Editor ', screenshots: [
      { caption: 'Credit', sizes: [
        { width: '1920', src: 'https://dl.flathub.org/media/gimp/original.png' },
        { width: '600', src: 'https://example.org/other.png' },
        { width: '624', src: uri },
      ] },
    ] });
  };
  const details = await fetchCatalogDetails('gimp', 'es', signal);
  assert.equal(details.summary, 'Editor');
  assert.deepEqual(details.screenshot, { uri, caption: 'Credit' });
});

test('GIMP accepts a missing screenshot and rejects a wrong entry or failed request', async () => {
  const signal = new AbortController().signal;
  globalThis.fetch = async () => Response.json({ id: 'org.gimp.GIMP', summary: 'Editor' });
  assert.deepEqual(await fetchCatalogDetails('gimp', 'en', signal), { summary: 'Editor', screenshot: null, description: [], version: null, rating: null });
  globalThis.fetch = async () => Response.json({ id: 'other', summary: 'Editor' });
  await assert.rejects(fetchCatalogDetails('gimp', 'pt-BR', signal));
  globalThis.fetch = async () => new Response(null, { status: 503 });
  await assert.rejects(fetchCatalogDetails('gimp', 'pt-BR', signal));
});

test('GIMP keeps updated catalog text, selects the local rating and the stable release', async () => {
  globalThis.fetch = async () => Response.json({
    id: 'org.gimp.GIMP', summary: 'High-end image creation and manipulation',
    description: '<p>Novo texto do catálogo.</p><p>Um <em>segundo</em> parágrafo.</p>',
    releases: [{ type: 'development', version: '4' }, { type: 'stable', version: '3' }],
    content_rating_details: {
      en_US: { minimumAgeText: 'Early Childhood' },
      pt_BR: { minimumAge: 3, minimumAgeText: 'L', contentRatingSystem: 'DJCTQ', categories: [
        null, { description: 'Impossível conversar com outros usuários' }, { description: 123 },
      ] },
    },
    screenshots: [{ caption: 'A new caption and credit', sizes: [{ width: 624, src: 'https://dl.flathub.org/media/test.png' }] }],
  });
  const details = await fetchCatalogDetails('gimp', 'pt-BR', new AbortController().signal);
  assert.match(details.summary, /retocar fotos/);
  assert.deepEqual(details.description, ['Novo texto do catálogo.', 'Um segundo parágrafo.']);
  assert.equal(details.version, '3');
  assert.deepEqual(details.rating, { label: 'L', system: 'DJCTQ', indicators: ['Impossível conversar com outros usuários'] });
  assert.equal(details.screenshot.caption, 'A new caption and credit');
});

test('local deadlines handle calendar weeks, year changes and configured bedtime', () => {
  for (const [start, expected] of [
    [new Date(2026, 10, 2, 10), new Date(2026, 10, 9)],
    [new Date(2026, 10, 8, 23, 59), new Date(2026, 10, 9)],
    [new Date(2026, 11, 31, 18), new Date(2027, 0, 4)],
  ]) assert.equal(releaseEnd('week', start).getTime(), expected.getTime());
  const from = new Date(2026, 10, 2, 22);
  assert.equal(releaseEnd('bedtime', from, { hour: 20, minute: 15 }).getTime(), new Date(2026, 10, 3, 20, 15).getTime());
  assert.equal(releaseEnd('bedtime', new Date(2026, 10, 2, 20, 15), { hour: 20, minute: 15 }).getDate(), 3);
  assert.equal(releaseEnd('hour2', from).getTime(), from.getTime() + 120 * 60_000);
  assert.equal(releaseEnd('unlimited', from), null);
  assert.equal(remainingMinutes(createRelease('min30', false, from), new Date(from.getTime() + 31 * 60_000)), 0);
});

test('bedtime accepts HH:MM and rejects invalid or ambiguous values', () => {
  for (const value of ['00:00', '21:30', '23:59']) assert.equal(formatBedtime(parseBedtime(value)), value);
  for (const value of ['24:00', '21:60', '9:30', '2130', '21h30', '', '-1:30']) assert.equal(parseBedtime(value), null);
});

test('restores only valid local deadlines, including expired and unlimited ones', () => {
  for (const option of ['week', 'hour1', 'unlimited']) {
    const release = createRelease(option, false, new Date('2026-01-01T00:00:00.000Z'));
    assert.deepEqual(parseRelease(JSON.stringify(release)), release);
  }
  assert.equal(parseRelease(null), null);
  const valid = createRelease('hour1', false);
  for (const item of [{}, { ...valid, optionId: 'unknown' }, { ...valid, blockAtEnd: 'yes' }, { ...valid, startedAt: 'yesterday' }, { ...valid, endsAt: valid.startedAt }, { ...valid, endsAt: null }]) {
    assert.throws(() => parseRelease(JSON.stringify(item)));
  }
  assert.throws(() => parseRelease('{broken'));
});

test('local deadlines survive reopening and stay isolated by guardian, device, link and request', async () => {
  const data = new Map();
  const storage = { get: async (key) => data.get(key) ?? null, set: async (key, value) => { data.set(key, value); }, remove: async (key) => { data.delete(key); } };
  const parts = ['guardian-1', 'computer-1', 'link-1', 'request-1'];
  const key = releaseStorageKey(...parts);
  const release = createRelease('hour1', false);
  await createReleaseStorage(storage).save(key, release);
  const reopened = createReleaseStorage(storage);
  assert.deepEqual(await reopened.load(key), release);
  for (let index = 0; index < parts.length; index++) {
    const other = [...parts]; other[index] += '-other';
    assert.equal(await reopened.load(releaseStorageKey(...other)), null);
  }
  await reopened.save(key, null);
  assert.equal(await reopened.load(key), null);
  assert.throws(() => releaseStorageKey('invalid.id', ...parts.slice(1)));
});

test('local storage failures remain failures instead of confirming persistence', async () => {
  const fail = async () => { throw new Error('Storage unavailable'); };
  const storage = createReleaseStorage({ get: fail, set: fail, remove: fail });
  await assert.rejects(storage.load('key'), /Storage unavailable/);
  await assert.rejects(storage.save('key', createRelease('hour1', false)), /Storage unavailable/);
  await assert.rejects(storage.save('key', null), /Storage unavailable/);
});

test('bedtime keeps the previous value on save failure and allows recovery after load failure', async () => {
  let stored = '20:45';
  let failing = false;
  let finish;
  const store = createBedtimeStore({
    get: async () => { if (failing) throw new Error('Unavailable'); return stored; },
    set: async (_key, value) => {
      if (failing) throw new Error('Unavailable');
      await new Promise((resolve) => { finish = resolve; });
      stored = value;
    },
  });
  await store.reload();
  assert.deepEqual(store.getSnapshot().value, { hour: 20, minute: 45 });
  failing = true;
  assert.equal(await store.save({ hour: 22, minute: 30 }), false);
  assert.equal(store.getSnapshot().error, 'save');
  assert.deepEqual(store.getSnapshot().value, { hour: 20, minute: 45 });
  await store.reload();
  assert.equal(store.getSnapshot().ready, false);
  assert.equal(store.getSnapshot().error, 'load');
  failing = false;
  const saving = store.save({ hour: 22, minute: 30 });
  assert.equal(store.getSnapshot().busy, true);
  assert.deepEqual(store.getSnapshot().value, { hour: 20, minute: 45 });
  assert.equal(await store.save({ hour: 23, minute: 0 }), false);
  finish();
  assert.equal(await saving, true);
  assert.deepEqual(store.getSnapshot(), { value: { hour: 22, minute: 30 }, ready: true, busy: false, error: null });
  const reopened = createBedtimeStore({ get: async () => stored, set: async () => {} });
  await reopened.reload();
  assert.deepEqual(reopened.getSnapshot().value, { hour: 22, minute: 30 });
});

test('request lists distinguish empty reports, unavailable computers and revoked links', async () => {
  process.env.EXPO_PUBLIC_API_URL = 'http://127.0.0.1:3000';
  api.setAccessToken('test-token');
  const computers = ['available', 'empty', 'offline', 'revoked', 'unpaired'].map((id) => ({ id, name: id, isPaired: id !== 'unpaired' }));
  const request = { id: '0a38ce2d-9654-41f1-8098-944e0874752c', applicationName: 'Firefox', requesterName: 'Child', requestedAt: '2026-10-20T12:00:00.000Z', ageRating: 'L' };
  globalThis.fetch = async (url) => {
    assert.ok(!url.includes('unpaired'));
    if (url.includes('offline')) throw new TypeError('Network unavailable');
    if (url.includes('revoked')) return new Response('{}', { status: 403, headers: { 'Content-Type': 'application/json' } });
    return new Response(JSON.stringify(url.includes('empty') ? [] : [request]), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  const result = await loadPendingRequestsReport(computers);
  assert.deepEqual(result.pending.map((item) => item.computer.id), ['available']);
  assert.deepEqual(result.failures.map((item) => item.computer.id), ['offline', 'revoked']);
  assert.deepEqual(await loadPendingRequestsReport([computers[1]]), { pending: [], failures: [] });
  assert.deepEqual(await loadPendingRequestsReport([]), { pending: [], failures: [] });
});

test('history validates terminal status and uses only the authorized device endpoint', async () => {
  const request = { id: '0a38ce2d-9654-41f1-8098-944e0874752c', applicationName: 'GIMP', requesterName: 'Child', requestedAt: '2026-11-02T12:00:00.000Z', ageRating: 'L' };
  for (const status of ['APPROVED', 'DENIED']) assert.equal(parseInstallationHistory([{ ...request, status }])[0].status, status);
  for (const status of [undefined, 'PENDING', 'OTHER']) assert.throws(() => parseInstallationHistory([{ ...request, status }]));
  process.env.EXPO_PUBLIC_API_URL = 'http://127.0.0.1:3000';
  api.setAccessToken('test-token');
  globalThis.fetch = async (url, options) => {
    assert.equal(url, 'http://127.0.0.1:3000/devices/selected%2Fcomputer/installation-requests/history');
    assert.equal(options.headers.Authorization, 'Bearer test-token');
    return Response.json([{ ...request, status: 'APPROVED' }]);
  };
  assert.equal((await listInstallationHistory('selected/computer'))[0].status, 'APPROVED');
});

test('request banners establish a silent baseline and do not repeat dismissed requests', () => {
  const computer = { id: 'pc', associationId: 'link', isPaired: true };
  const existing = { id: 'existing' };
  const fresh = { id: 'new' };
  const report = (requests) => [{ computer, requests }];
  const first = updateRequestBanners(emptyRequestBanners(), [computer], report([existing]));
  assert.deepEqual(first.queue, []);
  const second = updateRequestBanners(first, [computer], report([existing, fresh]));
  assert.deepEqual(second.queue.map((item) => item.request.id), ['new']);
  const dismissed = { ...second, queue: [] };
  assert.deepEqual(updateRequestBanners(dismissed, [computer], report([existing, fresh])).queue, []);
  const answered = updateRequestBanners(second, [computer], report([existing]));
  assert.deepEqual(answered.queue, []);
  assert.deepEqual(updateRequestBanners(answered, [computer], report([existing, fresh])).queue, []);
});

test('request banners isolate accounts, remove revoked links and preserve partial reports', () => {
  const computer = { id: 'pc', associationId: 'link', isPaired: true };
  const empty = updateRequestBanners(emptyRequestBanners(), [computer], [{ computer, requests: [] }]);
  const report = [{ computer, requests: [{ id: 'new' }] }];
  const active = updateRequestBanners(empty, [computer], report);
  assert.equal(active.queue.length, 1);
  assert.equal(updateRequestBanners(active, [computer], []).queue.length, 1);
  const revoked = updateRequestBanners(active, [], []);
  assert.equal(revoked.queue.length, 0);
  assert.equal(revoked.seen.size, 0);
  assert.equal(updateRequestBanners(emptyRequestBanners(), [computer], report).queue.length, 0);
  const newComputer = { ...computer, associationId: 'other-link' };
  const pairedAgain = updateRequestBanners(active, [newComputer], [{ computer: newComputer, requests: [{ id: 'new' }] }]);
  assert.equal(pairedAgain.queue.length, 0);
});

test('application deadlines use the most recent approved matching identity, without loose name matches', () => {
  const request = { id: 'first', applicationName: 'GIMP', requesterName: 'Child', requestedAt: '2026-11-02T12:00:00.000Z', ageRating: 'L', status: 'APPROVED' };
  const requests = [request, { ...request, id: 'latest', requestedAt: '2026-11-02T13:00:00.000Z' }, { ...request, id: 'denied', requestedAt: '2026-11-02T14:00:00.000Z', status: 'DENIED' }];
  assert.equal(findApprovedRequest(requests, 'org.gimp.GIMP').id, 'latest');
  assert.equal(findApprovedRequest(requests, 'GIMP tools'), null);
  assert.equal(findApprovedRequest(requests, 'Steam'), null);
});

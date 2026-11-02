import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { request as httpRequest } from 'node:http';
import { backendUrl, createSimulator, validateSnapshot } from '../server.mjs';

const deviceId = '0a38ce2d-9654-41f1-8098-944e0874752c';
const associationId = '946ec23b-4fb8-4faa-94dd-471d67588c84';
const credential = 'd'.repeat(43);
const defaults = () => ({ associationId, revision: 1, appliedRevision: null, appliedAt: null, connection: { status: 'unverified', lastSeen: null }, settings: { blockBrowsers: true, allowedBrowsers: { firefox: true, chromium: false, brave: false, 'gnome-web': true }, blockInstallation: true, ageRating: '12', applicationRules: {}, installationDecisions: {} } });

async function fixture(t) {
  const directory = await mkdtemp(join(tmpdir(), 'piplup-client-test-'));
  let snapshot = defaults();
  let status = 200;
  let acknowledgeStatus = 200;
  let heartbeatStatus = 200;
  let reports = 0;
  let lastReport;
  let inFlight = 0;
  let maximum = 0;
  const calls = [];
  const client = await createSimulator({ statePath: join(directory, 'identity.json'), fetchImpl: async (url, options) => {
    calls.push({ url, options });
    inFlight += 1;
    maximum = Math.max(maximum, inFlight);
    try {
      await new Promise((done) => setTimeout(done, 1));
      if (url.endsWith('/auth/login')) return Response.json({ accessToken: 'guardian-token' });
      if (url.endsWith('/simulation/devices')) return Response.json({ device: { id: deviceId, name: 'PC sala', managedUser: 'Ana', isDemo: true }, credential });
      assert.equal(options.headers.Authorization, `Bearer ${credential}`);
      assert.equal(options.redirect, 'error');
      if (url.endsWith('/pairing-sessions')) return Response.json({ qrPayload: `piplup://pair?token=${'t'.repeat(43)}`, expiresAt: new Date(Date.now() + 300000).toISOString() });
      if (status !== 200) return Response.json({}, { status });
      if (url.endsWith('/heartbeat')) {
        assert.deepEqual(JSON.parse(options.body), { associationId: snapshot.associationId });
        if (heartbeatStatus !== 200) return Response.json({}, { status: heartbeatStatus });
        snapshot = { ...snapshot, connection: { status: 'online', lastSeen: new Date().toISOString() } };
      }
      if (options.method === 'PUT') {
        reports += 1;
        lastReport = JSON.parse(options.body);
        if (acknowledgeStatus !== 200) return Response.json({}, { status: acknowledgeStatus });
        snapshot = { ...snapshot, appliedRevision: snapshot.revision, appliedAt: new Date().toISOString() };
      }
      return Response.json(snapshot);
    } finally { inFlight -= 1; }
  } });
  await new Promise((done) => client.server.listen(0, '127.0.0.1', done));
  const url = `http://127.0.0.1:${client.server.address().port}`;
  async function post(path, body, origin = url) {
    return fetch(`${url}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin }, body: JSON.stringify(body) });
  }
  async function register() {
    const response = await post('/api/register', { email: 'guardian@example.test', password: 'test-password', name: 'PC sala', managedUser: 'Ana' });
    assert.equal(response.status, 200);
    return response.json();
  }
  t.after(async () => { await client.close(); await rm(directory, { recursive: true, force: true }); });
  return { client, url, post, register, calls, directory, get reports() { return reports; }, get lastReport() { return lastReport; }, get maximum() { return maximum; }, setSnapshot(value) { snapshot = value; }, setStatus(value) { status = value; }, setAcknowledgeStatus(value) { acknowledgeStatus = value; }, setHeartbeatStatus(value) { heartbeatStatus = value; } };
}

test('accepts explicit trusted backend origins and refuses credential-bearing or insecure remote URLs', () => {
  assert.equal(backendUrl('http://127.0.0.1:3000'), 'http://127.0.0.1:3000');
  assert.equal(backendUrl('https://api.example.test'), 'https://api.example.test');
  assert.equal(backendUrl('http://192.168.1.2:3000', true), 'http://192.168.1.2:3000');
  for (const url of ['ftp://localhost', 'https://user:secret@example.test', 'https://api.example.test/path', 'https://api.example.test/?token=x', 'http://192.168.1.2:3000']) assert.throws(() => backendUrl(url));
});

test('registers a demo PC, persists its identity and exposes only temporary pairing QR to the browser', async (t) => {
  const f = await fixture(t);
  const state = await f.register();
  assert.equal(state.device.isDemo, true);
  assert.match(state.pairing.qr, /^data:image\/png;base64,/);
  assert.equal(JSON.stringify(state).includes(credential), false);
  assert.equal(JSON.stringify(state).includes('guardian-token'), false);
  const stored = JSON.parse(await readFile(join(f.directory, 'identity.json'), 'utf8'));
  assert.equal(stored.credential, credential);
  assert.equal(stored.password, undefined);
  assert.equal(stored.applications.length, 4);
  assert.equal((await f.post('/api/register', {})).status, 400);
});

test('reflects app settings only after successful acknowledgement and sends inventory once per change', async (t) => {
  const f = await fixture(t);
  await f.register();
  await Promise.all([f.client.synchronize(), f.client.synchronize()]);
  assert.equal(f.client.publicState().snapshot.appliedRevision, 1);
  assert.equal(f.lastReport.applications.length, 4);
  assert.equal(f.maximum, 1);
  await f.client.synchronize();
  assert.equal(f.reports, 1);
  f.setSnapshot({ ...defaults(), revision: 2, settings: { ...defaults().settings, ageRating: '16', blockBrowsers: false } });
  f.setAcknowledgeStatus(409);
  await f.client.synchronize();
  assert.equal(f.client.publicState().snapshot.revision, 1);
  assert.equal(f.client.publicState().connected, false);
  f.setAcknowledgeStatus(200);
  await f.client.synchronize();
  assert.equal(f.client.publicState().snapshot.settings.ageRating, '16');
  assert.equal(f.client.publicState().snapshot.settings.blockBrowsers, false);
  assert.equal(f.client.publicState().snapshot.appliedRevision, 2);
});

test('sends installation requests with stable IDs and reflects independent decisions', async (t) => {
  const f = await fixture(t);
  await f.register();
  await f.client.synchronize();
  assert.equal((await f.post('/api/installation-request', { applicationName: 'GIMP', ageRating: '12' })).status, 200);
  await f.client.synchronize();
  const request = f.lastReport.installationRequests[0];
  assert.equal(request.applicationName, 'GIMP');
  f.setSnapshot({ ...defaults(), revision: 2, settings: { ...defaults().settings, installationDecisions: { [request.id]: 'DENIED' } } });
  await f.client.synchronize();
  assert.equal(f.lastReport.installationRequests[0].id, request.id);
  assert.equal(f.client.publicState().snapshot.settings.installationDecisions[request.id], 'DENIED');
});

test('catalog requests install approved apps into the inventory once and serve their local logos', async (t) => {
  const f = await fixture(t);
  const registered = await f.register();
  assert.ok(registered.catalog.length >= 10);
  for (const app of registered.catalog) {
    const response = await fetch(`${f.url}${app.logo}`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'image/png');
  }
  await f.client.synchronize();
  assert.equal((await f.post('/api/installation-request', { applicationId: 'unknown' })).status, 400);
  assert.equal((await f.post('/api/installation-request', { applicationId: 'firefox' })).status, 400);
  assert.equal((await f.post('/api/installation-request', { applicationId: 'gimp' })).status, 200);
  assert.equal((await f.post('/api/installation-request', { applicationId: 'gimp' })).status, 400);
  await f.client.synchronize();
  const request = f.lastReport.installationRequests[0];
  f.setSnapshot({ ...defaults(), revision: 2, settings: { ...defaults().settings, installationDecisions: { [request.id]: 'APPROVED' } } });
  await f.client.synchronize();
  assert.equal(f.lastReport.applications.find((app) => app.name === 'GIMP').id, request.id);
  await f.client.synchronize();
  assert.equal(f.client.publicState().applications.filter((app) => app.name === 'GIMP').length, 1);
  const stored = JSON.parse(await readFile(join(f.directory, 'identity.json'), 'utf8'));
  assert.ok(stored.applications.some((app) => app.name === 'GIMP'));
});

test('sends contact even with no changes and keeps contact separate from applying settings', async (t) => {
  const f = await fixture(t);
  await f.register();
  await f.client.synchronize();
  await f.client.synchronize();
  assert.equal(f.calls.filter((call) => call.url.endsWith('/heartbeat')).length, 2);
  assert.equal(f.reports, 1);
  f.setHeartbeatStatus(409);
  await f.client.synchronize();
  assert.equal(f.client.publicState().connected, false);
  assert.equal(f.reports, 1);
  f.setHeartbeatStatus(200);
  await f.client.synchronize();
  assert.equal(f.client.publicState().connected, true);
});

test('clears revoked associations, stops on invalid identity and never reports a connection failure as applied', async (t) => {
  const f = await fixture(t);
  await f.register();
  await f.client.synchronize();
  f.setStatus(503);
  await f.client.synchronize();
  assert.equal(f.client.publicState().connected, false);
  f.setStatus(404);
  await f.client.synchronize();
  assert.equal(f.client.publicState().snapshot, null);
  f.setStatus(401);
  await f.client.synchronize();
  assert.equal(f.client.publicState().stopped, true);
  const calls = f.calls.length;
  await f.client.synchronize();
  assert.equal(f.calls.length, calls);
});

test('isolates local HTTP mutations from foreign origins and serves a self-contained interface', async (t) => {
  const f = await fixture(t);
  assert.equal((await f.post('/api/register', {}, 'https://foreign.test')).status, 403);
  const foreignHostStatus = await new Promise((resolve, reject) => {
    const request = httpRequest(`${f.url}/api/state`, { headers: { Host: 'foreign.test' } }, (response) => { response.resume(); resolve(response.statusCode); });
    request.on('error', reject);
    request.end();
  });
  assert.equal(foreignHostStatus, 403);
  const page = await fetch(f.url);
  assert.match(page.headers.get('content-security-policy'), /frame-ancestors 'none'/);
  assert.match(await page.text(), /Computador simulado/);
  assert.equal((await fetch(`${f.url}/../server.mjs`)).status, 404);
});

test('refuses malformed configurations before treating them as applied', () => {
  assert.equal(validateSnapshot(defaults()).revision, 1);
  for (const value of [null, {}, { ...defaults(), connection: { status: 'online', lastSeen: null } }, { ...defaults(), connection: { status: 'other', lastSeen: null } }, { ...defaults(), revision: 0 }, { ...defaults(), appliedRevision: 2 }, { ...defaults(), settings: { ...defaults().settings, ageRating: '99' } }, { ...defaults(), settings: { ...defaults().settings, allowedBrowsers: {} } }]) assert.throws(() => validateSnapshot(value));
});

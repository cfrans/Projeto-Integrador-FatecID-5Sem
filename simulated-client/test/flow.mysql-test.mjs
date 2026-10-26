import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createSimulator } from '../server.mjs';
import { api } from '../../mobile/src/lib/api.ts';
import { readSimulation, updateSimulation } from '../../mobile/src/features/restrictions/services/simulation.ts';
import { listInstalledApplications } from '../../mobile/src/features/restrictions/services/applications.ts';
import { listInstallationRequests } from '../../mobile/src/features/restrictions/services/installation-requests.ts';
import { AppModule } from '../../backend/dist/src/app.module.js';
import { PrismaService } from '../../backend/dist/src/prisma/prisma.service.js';

const requireBackend = createRequire(new URL('../../backend/package.json', import.meta.url));
const { NestFactory } = requireBackend('@nestjs/core');
const { ValidationPipe } = requireBackend('@nestjs/common');
const { hash } = requireBackend('argon2');

test('mobile services, real API/MySQL and local client complete the demonstration together', async () => {
  assert.equal(process.env.NODE_ENV, 'test');
  assert.match(process.env.MYSQL_DATABASE ?? '', /_test$/);
  const app = await NestFactory.create(AppModule, { logger: false });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  await app.listen(0, '127.0.0.1');
  const apiUrl = await app.getUrl();
  const prisma = app.get(PrismaService);
  const temporary = await mkdtemp(join(tmpdir(), 'piplup-flow-test-'));
  const password = randomUUID();
  const guardian = await prisma.guardian.create({ data: { email: `${randomUUID()}@example.test`, name: 'Flow test', passwordHash: await hash(password) } });
  let pairingToken;
  let deviceId;
  const client = await createSimulator({ apiUrl, statePath: join(temporary, 'identity.json'), fetchImpl: async (url, options) => {
    const response = await fetch(url, options);
    if (url.endsWith('/agent/pairing-sessions') && response.ok) pairingToken = (await response.clone().json()).token;
    return response;
  } });
  await new Promise((done) => client.server.listen(0, '127.0.0.1', done));
  const clientUrl = `http://127.0.0.1:${client.server.address().port}`;
  const post = (path, body) => fetch(`${clientUrl}${path}`, { method: 'POST', headers: { Origin: clientUrl, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  try {
    const registration = await post('/api/register', { email: guardian.email, password, name: 'PC integrado', managedUser: 'Ana' });
    assert.equal(registration.status, 200);
    deviceId = (await registration.json()).device.id;
    const login = await fetch(`${apiUrl}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: guardian.email, password }) });
    const token = (await login.json()).accessToken;
    process.env.EXPO_PUBLIC_API_URL = apiUrl;
    api.setAccessToken(token);
    const paired = await fetch(`${apiUrl}/pairing/complete`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ token: pairingToken }) });
    assert.equal(paired.status, 200);
    await client.synchronize();
    const applications = await listInstalledApplications(deviceId);
    assert.equal(applications.length, 4);
    let state = await readSimulation(deviceId);
    assert.equal(state.connection.status, 'online');
    assert.ok(state.connection.lastSeen);
    await updateSimulation(deviceId, state.revision, { ageRating: '16', blockBrowsers: false, blockInstallation: false, applicationRules: { [applications[0].id]: false } });
    state = await readSimulation(deviceId);
    assert.notEqual(state.appliedRevision, state.revision);
    assert.equal(state.connection.status, 'online');
    await client.synchronize();
    state = await readSimulation(deviceId);
    assert.equal(state.appliedRevision, state.revision);
    assert.equal(client.publicState().snapshot.settings.ageRating, '16');
    assert.equal((await listInstalledApplications(deviceId)).find((application) => application.id === applications[0].id).allowed, false);
    assert.equal((await post('/api/installation-request', { applicationName: 'GIMP', ageRating: '12' })).status, 200);
    await client.synchronize();
    const requests = await listInstallationRequests(deviceId);
    assert.equal(requests.length, 1);
    await updateSimulation(deviceId, state.revision, { installationDecisions: { [requests[0].id]: 'APPROVED' } });
    await client.synchronize();
    assert.equal(client.publicState().snapshot.settings.installationDecisions[requests[0].id], 'APPROVED');
    assert.deepEqual(await listInstallationRequests(deviceId), []);
    await fetch(`${apiUrl}/devices/${deviceId}/association`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    await client.synchronize();
    assert.equal(client.publicState().paired, false);
    assert.equal(client.publicState().snapshot, null);
  } finally {
    api.setAccessToken(null);
    await client.close();
    if (deviceId) {
      await prisma.deviceAssociation.deleteMany({ where: { deviceId } });
      await prisma.device.delete({ where: { id: deviceId } });
    }
    await prisma.guardian.delete({ where: { id: guardian.id } });
    await app.close();
    await rm(temporary, { recursive: true, force: true });
  }
});

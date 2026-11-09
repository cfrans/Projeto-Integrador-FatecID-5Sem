import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createSimulator } from '../simulated-client/server.mjs';
import { PrismaService } from '../backend/dist/src/prisma/prisma.service.js';

export async function createTasks() {
  assert.equal(process.env.NODE_ENV, 'test');
  assert.match(process.env.MYSQL_DATABASE ?? '', /_test$/);
  const apiUrl = process.env.PIPLUP_E2E_API_URL;
  assert.ok(apiUrl && new URL(apiUrl).hostname === '127.0.0.1');
  const prisma = new PrismaService();
  let fixture;

  async function cleanup() {
    if (fixture) {
      await fixture.client?.close();
      if (fixture.deviceId) {
        const deviceId = fixture.deviceId;
        await prisma.agentCommand.deleteMany({ where: { deviceId } });
        await prisma.deviceAssociation.deleteMany({ where: { deviceId } });
        await prisma.device.deleteMany({ where: { id: deviceId } });
      }
      if (fixture.guardianId) await prisma.guardian.deleteMany({ where: { id: fixture.guardianId } });
      await rm(fixture.directory, { recursive: true, force: true });
      fixture = undefined;
    }
    await prisma.$disconnect();
    return null;
  }

  async function post(url, body, headers = {}) {
    const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
    const result = await response.json();
    assert.ok(response.ok, `HTTP ${response.status} em ${new URL(url).pathname}`);
    return result;
  }

  return {
    'demo:cleanup': cleanup,
    async 'demo:create'() {
      await cleanup();
      fixture = { directory: await mkdtemp(join(tmpdir(), 'piplup-cypress-')) };
      const email = `${randomUUID()}@example.test`;
      const password = randomUUID();
      const guardian = await post(`${apiUrl}/auth/register`, { email, password, name: 'Responsável Cypress' });
      fixture.guardianId = guardian.id;
      const login = await post(`${apiUrl}/auth/login`, { email, password });
      let token;
      fixture.client = await createSimulator({ apiUrl, statePath: join(fixture.directory, 'identity.json'), fetchImpl: async (url, options) => {
        const response = await fetch(url, options);
        if (url.endsWith('/agent/pairing-sessions') && response.ok) token = (await response.clone().json()).token;
        return response;
      } });
      await new Promise((done) => fixture.client.server.listen(0, '127.0.0.1', done));
      fixture.clientUrl = `http://127.0.0.1:${fixture.client.server.address().port}`;
      const registered = await post(`${fixture.clientUrl}/api/register`, { email, password, name: 'PC Cypress', managedUser: 'Ana' }, { Origin: fixture.clientUrl });
      fixture.deviceId = registered.device.id;
      assert.ok(token, 'O client deve gerar uma sessão real de pareamento.');
      const headers = { Authorization: `Bearer ${login.accessToken}` };
      await post(`${apiUrl}/pairing/validate`, { token }, headers);
      await post(`${apiUrl}/pairing/complete`, { token }, headers);
      await fixture.client.synchronize();
      return { email, password, deviceId: fixture.deviceId };
    },
    async 'demo:synchronize'() {
      assert.ok(fixture?.client);
      await fixture.client.synchronize();
      return fixture.client.publicState();
    },
    async 'demo:requestInstallation'() {
      assert.ok(fixture?.client);
      await post(`${fixture.clientUrl}/api/installation-request`, { applicationName: 'GIMP', ageRating: '12' }, { Origin: fixture.clientUrl });
      await fixture.client.synchronize();
      return null;
    },
    async 'demo:revoke'() {
      assert.ok(fixture?.deviceId);
      const { PairingService } = await import('../backend/dist/src/pairing/pairing.service.js');
      await new PairingService(prisma).revokeGuardianAssociation(fixture.guardianId, fixture.deviceId);
      return null;
    },
  };
}

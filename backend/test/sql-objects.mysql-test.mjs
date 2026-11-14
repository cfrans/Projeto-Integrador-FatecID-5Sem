import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import test from 'node:test';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../dist/src/app.module.js';
import { PrismaService } from '../dist/src/prisma/prisma.service.js';
import { PairingService } from '../dist/src/pairing/pairing.service.js';
import { getMysqlConnection } from '../dist/src/config/mysql-connection.js';

const requireAdapter = createRequire(import.meta.resolve('@prisma/adapter-mariadb'));
const { createConnection } = requireAdapter('mariadb');

test('SQL objects preserve pairing invariants and participate in API transactions', async (suite) => {
  assert.equal(process.env.NODE_ENV, 'test');
  assert.match(process.env.MYSQL_DATABASE ?? '', /_test$/);
  const app = await NestFactory.create(AppModule, { logger: false });
  await app.init();
  const prisma = app.get(PrismaService);
  const pairing = app.get(PairingService);
  const connection = await createConnection({ ...getMysqlConnection(), allowPublicKeyRetrieval: process.env.MYSQL_ALLOW_PUBLIC_KEY_RETRIEVAL === 'true' });
  const guardian = await prisma.guardian.create({ data: { email: `${randomUUID()}@example.test`, name: 'SQL fixture', passwordHash: 'not-a-login-account' } });
  const devices = [];
  const now = new Date('2026-11-09T12:00:00.000Z');

  async function fixture(name = 'SQL fixture') {
    const device = await prisma.device.create({ data: { name, guardianId: guardian.id, isDemo: true } });
    devices.push(device);
    const association = await prisma.deviceAssociation.create({ data: { deviceId: device.id, guardianId: guardian.id, activeDeviceId: device.id } });
    const session = await prisma.pairingSession.create({ data: { deviceId: device.id, tokenHash: randomUUID().replaceAll('-', '').padEnd(64, '0'), expiresAt: new Date(Date.now() + 300000) } });
    const commands = [];
    for (const status of ['pending', 'running', 'succeeded']) {
      commands.push(await prisma.agentCommand.create({ data: { deviceId: device.id, associationId: association.id, requestId: randomUUID(), type: 'agent.ping', version: 1, parameters: {}, status, expiresAt: new Date(Date.now() + 300000) } }));
    }
    return { device, association, session, commands };
  }

  try {
    await suite.test('function gives precedence to revocation and consumption, and expires at the boundary', async () => {
      const cases = [
        [null, null, new Date(now.getTime() + 1), 'pending'],
        [null, null, now, 'expired'],
        [null, null, new Date(now.getTime() - 1), 'expired'],
        [now, null, now, 'consumed'],
        [now, now, now, 'revoked'],
      ];
      for (const [consumedAt, revokedAt, expiresAt, expected] of cases) {
        const [result] = await prisma.$queryRaw`SELECT fn_pairing_session_status(${consumedAt}, ${revokedAt}, ${expiresAt}, ${now}) AS status`;
        assert.equal(result.status, expected);
      }
    });

    await suite.test('trigger refuses to reopen or reassign a consumed token while allowing revocation', async () => {
      const { session } = await fixture();
      await prisma.pairingSession.update({ where: { id: session.id }, data: { consumedAt: now, consumedByGuardianId: guardian.id } });
      for (const data of [{ consumedAt: null }, { consumedAt: new Date(now.getTime() + 1) }, { consumedByGuardianId: null }]) {
        await assert.rejects(prisma.pairingSession.update({ where: { id: session.id }, data }));
      }
      await assert.rejects(
        connection.query('UPDATE PairingSession SET consumedAt = NULL WHERE id = ?', [session.id]),
        (error) => error.sqlState === '45000' && error.errno === 1644 && error.message.includes('PAIRING_SESSION_CONSUMED'),
      );
      const unchanged = await prisma.pairingSession.findUniqueOrThrow({ where: { id: session.id } });
      assert.equal(unchanged.consumedAt.toISOString(), now.toISOString());
      assert.equal(unchanged.consumedByGuardianId, guardian.id);
      await prisma.pairingSession.update({ where: { id: session.id }, data: { revokedAt: now } });
    });

    await suite.test('procedure revokes access, sessions and unfinished commands through the service', async () => {
      const { device, association, session, commands } = await fixture();
      await assert.rejects(pairing.revokeGuardianAssociation(randomUUID(), device.id), (error) => error.getStatus() === 404);
      assert.equal((await prisma.device.findUniqueOrThrow({ where: { id: device.id } })).guardianId, guardian.id);
      await pairing.revokeGuardianAssociation(guardian.id, device.id);
      assert.equal((await prisma.device.findUniqueOrThrow({ where: { id: device.id } })).guardianId, null);
      const revoked = await prisma.deviceAssociation.findUniqueOrThrow({ where: { id: association.id } });
      assert.ok(revoked.revokedAt);
      assert.equal(revoked.activeDeviceId, null);
      assert.ok((await prisma.pairingSession.findUniqueOrThrow({ where: { id: session.id } })).revokedAt);
      const statuses = await Promise.all(commands.map((command) => prisma.agentCommand.findUniqueOrThrow({ where: { id: command.id } }).then((entry) => entry.status)));
      assert.deepEqual(statuses, ['cancelled', 'unknown', 'succeeded']);
      await assert.rejects(prisma.$transaction((tx) => tx.$executeRaw`CALL sp_revoke_device_association(${device.id}, ${association.id})`));
    });

    await suite.test('view exposes one current link and discards presence after identity revocation', async () => {
      const { device, association } = await fixture();
      const identity = await prisma.agentIdentity.create({ data: { deviceId: device.id, credentialHash: randomUUID().replaceAll('-', '').padEnd(64, '0') } });
      await prisma.simulationState.create({ data: { associationId: association.id, settings: {}, lastSeenAt: now } });
      const read = () => prisma.$queryRaw`SELECT associationId, lastSeenAt FROM vw_device_overview WHERE id = ${device.id} AND guardianId = ${guardian.id}`;
      const [active] = await read();
      assert.equal(active.associationId, association.id);
      assert.equal(active.lastSeenAt.toISOString(), now.toISOString());
      await prisma.agentIdentity.update({ where: { id: identity.id }, data: { revokedAt: now } });
      assert.equal((await read())[0].lastSeenAt, null);
      await pairing.revokeGuardianAssociation(guardian.id, device.id);
      assert.deepEqual(await read(), []);
    });
  } finally {
    for (const device of devices) {
      await prisma.agentCommand.deleteMany({ where: { deviceId: device.id } });
      await prisma.deviceAssociation.deleteMany({ where: { deviceId: device.id } });
      await prisma.pairingSession.deleteMany({ where: { deviceId: device.id } });
      await prisma.device.delete({ where: { id: device.id } });
    }
    await prisma.guardian.delete({ where: { id: guardian.id } });
    await connection.end();
    await app.close();
  }
});

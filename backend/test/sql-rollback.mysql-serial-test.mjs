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

test('SQL error inside the revocation procedure rolls back the API transaction', async (suite) => {
  assert.equal(process.env.NODE_ENV, 'test');
  assert.match(process.env.MYSQL_DATABASE ?? '', /_test$/);
  const app = await NestFactory.create(AppModule, { logger: false });
  await app.init();
  const prisma = app.get(PrismaService);
  const pairing = app.get(PairingService);
  const connection = await createConnection({ ...getMysqlConnection(), allowPublicKeyRetrieval: process.env.MYSQL_ALLOW_PUBLIC_KEY_RETRIEVAL === 'true' });
  const guardian = await prisma.guardian.create({ data: { email: `${randomUUID()}@example.test`, name: 'SQL fixture', passwordHash: 'not-a-login-account' } });
  const devices = [];
  let failureTriggerCreated = false;

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
    await suite.test('an SQL error after partial updates rolls back commands, association, device and session', async () => {
      const { device, association, session, commands } = await fixture('SQL rollback fixture');
      await connection.query(`CREATE TRIGGER trg_test_revoke_failure BEFORE UPDATE ON Device FOR EACH ROW
        BEGIN
          IF OLD.name = 'SQL rollback fixture' AND NEW.guardianId IS NULL THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'TEST_REVOKE_FAILURE';
          END IF;
        END`);
      failureTriggerCreated = true;
      await assert.rejects(pairing.revokeGuardianAssociation(guardian.id, device.id), (error) => error.getStatus() === 503);
      assert.equal((await prisma.device.findUniqueOrThrow({ where: { id: device.id } })).guardianId, guardian.id);
      const unchanged = await prisma.deviceAssociation.findUniqueOrThrow({ where: { id: association.id } });
      assert.equal(unchanged.revokedAt, null);
      assert.equal(unchanged.activeDeviceId, device.id);
      assert.equal((await prisma.pairingSession.findUniqueOrThrow({ where: { id: session.id } })).revokedAt, null);
      const statuses = await Promise.all(commands.map((command) => prisma.agentCommand.findUniqueOrThrow({ where: { id: command.id } }).then((entry) => entry.status)));
      assert.deepEqual(statuses, ['pending', 'running', 'succeeded']);
      await connection.query('DROP TRIGGER trg_test_revoke_failure');
      failureTriggerCreated = false;
    });
  } finally {
    if (failureTriggerCreated) await connection.query('DROP TRIGGER trg_test_revoke_failure');
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

import assert from 'node:assert/strict';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { argon2id, hash } from 'argon2';
import request from 'supertest';
import { AppModule } from '../dist/src/app.module.js';
import { PrismaService } from '../dist/src/prisma/prisma.service.js';

const digest = (value) => createHash('sha256').update(value).digest('hex');

test('pairing authorizes one guardian, consumes atomically, and revokes access', async () => {
  assert.equal(process.env.NODE_ENV, 'test', 'Use NODE_ENV=test.');
  assert.match(
    process.env.MYSQL_DATABASE ?? '',
    /_test$/,
    'Use a dedicated database ending in _test.',
  );
  const app = await NestFactory.create(AppModule, { logger: false });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  await app.init();
  const prisma = app.get(PrismaService);
  const http = request(app.getHttpServer());
  const password = randomUUID();
  const guardians = [];
  const devices = [];
  const temporaryDirectories = [];

  async function createGuardian() {
    const guardian = await prisma.guardian.create({
      data: {
        email: `${randomUUID()}@example.test`,
        name: `Pairing ${guardians.length + 1}`,
        passwordHash: await hash(password, { type: argon2id }),
      },
    });
    guardians.push(guardian);
    const login = await http
      .post('/auth/login')
      .send({ email: guardian.email, password })
      .expect(200);
    return { guardian, token: login.body.accessToken };
  }

  async function createAgent(name, isDemo = false) {
    const device = await prisma.device.create({
      data: { name, isDemo, guardianId: null },
    });
    devices.push(device);
    const raw = randomBytes(32).toString('base64url');
    const identity = await prisma.agentIdentity.create({
      data: { deviceId: device.id, credentialHash: digest(raw) },
    });
    return { device, identity, raw };
  }

  const agentHeader = (raw) => ({ Authorization: `Bearer ${raw}` });
  const guardianHeader = (raw) => ({ Authorization: `Bearer ${raw}` });

  try {
    const firstGuardian = await createGuardian();
    const secondGuardian = await createGuardian();
    const { device, raw } = await createAgent('Pairing fixture one');

    await http.post('/agent/pairing-sessions').expect(401);
    await http.get('/agent/associations').expect(401);
    await http
      .get('/agent/associations')
      .set(guardianHeader(firstGuardian.token))
      .expect(401);
    await http
      .get('/agent/associations')
      .set(agentHeader(raw))
      .expect(200)
      .expect([]);
    await http
      .post('/agent/pairing-sessions')
      .set(agentHeader('x'.repeat(43)))
      .expect(401);
    await http
      .post('/agent/pairing-sessions')
      .set(agentHeader(raw))
      .send({ deviceId: randomUUID() })
      .expect(400);

    const stale = await http
      .post('/agent/pairing-sessions')
      .set(agentHeader(raw))
      .expect(201);
    const created = await http
      .post('/agent/pairing-sessions')
      .set(agentHeader(raw))
      .expect(201);
    await http
      .post('/pairing/validate')
      .set(guardianHeader(firstGuardian.token))
      .send({ token: stale.body.token })
      .expect(410);
    assert.equal(created.body.token.length, 43);
    assert.equal(
      created.body.qrPayload,
      `piplup://pair?token=${created.body.token}`,
    );
    assert.ok(Date.parse(created.body.expiresAt) > Date.now());
    assert.ok(
      await prisma.pairingSession.findUnique({
        where: { tokenHash: digest(created.body.token) },
      }),
    );
    assert.equal(
      await prisma.pairingSession.findUnique({
        where: { tokenHash: created.body.token },
      }),
      null,
    );

    await http
      .post('/pairing/validate')
      .send({ token: created.body.token })
      .expect(401);
    await http
      .post('/pairing/validate')
      .set(guardianHeader(firstGuardian.token))
      .send({ token: 'bad' })
      .expect(400);
    await http
      .post('/pairing/validate')
      .set(guardianHeader(firstGuardian.token))
      .send({ token: created.body.token, deviceId: device.id })
      .expect(400);
    await http
      .post('/pairing/validate')
      .set(agentHeader(raw))
      .send({ token: created.body.token })
      .expect(401);
    await http
      .post('/pairing/validate')
      .set(guardianHeader(firstGuardian.token))
      .send({ token: 'x'.repeat(43) })
      .expect(410);
    const validated = await http
      .post('/pairing/validate')
      .set(guardianHeader(firstGuardian.token))
      .send({ token: created.body.token })
      .expect(200);
    assert.deepEqual(validated.body, {
      valid: true,
      expiresAt: created.body.expiresAt,
      device: {
        id: device.id,
        name: device.name,
        managedUser: null,
        isDemo: false,
      },
    });

    const expiringDevice = await createAgent('Pairing fixture expired');
    const expired = await http
      .post('/agent/pairing-sessions')
      .set(agentHeader(expiringDevice.raw))
      .expect(201);
    await prisma.pairingSession.update({
      where: { tokenHash: digest(expired.body.token) },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    const expiredResult = await http
      .post('/pairing/validate')
      .set(guardianHeader(firstGuardian.token))
      .send({ token: expired.body.token })
      .expect(410);
    assert.match(expiredResult.body.message, /expirada/);

    await http
      .post('/pairing/complete')
      .send({ token: created.body.token })
      .expect(401);
    const completed = await http
      .post('/pairing/complete')
      .set(guardianHeader(firstGuardian.token))
      .send({ token: created.body.token })
      .expect(200);
    assert.deepEqual(completed.body, {
      id: device.id,
      name: device.name,
      managedUser: null,
      isDemo: false,
      status: 'unverified',
      lastSeen: null,
      paired: true,
      associationId: completed.body.associationId,
    });
    await http
      .post('/pairing/complete')
      .set(guardianHeader(firstGuardian.token))
      .send({ token: created.body.token })
      .expect(410);
    await http
      .post('/agent/pairing-sessions')
      .set(agentHeader(raw))
      .expect(409);
    await http
      .delete(`/devices/${device.id}/association`)
      .set(guardianHeader(secondGuardian.token))
      .expect(404);
    await http
      .delete('/devices/not-a-uuid/association')
      .set(guardianHeader(firstGuardian.token))
      .expect(400);
    await http
      .get('/agent/associations')
      .set(agentHeader(raw))
      .expect(200)
      .expect([
        {
          id: completed.body.associationId,
          createdAt: (
            await prisma.deviceAssociation.findUnique({
              where: { id: completed.body.associationId },
            })
          ).createdAt.toISOString(),
          revokedAt: null,
          guardian: {
            id: firstGuardian.guardian.id,
            name: firstGuardian.guardian.name,
          },
        },
      ]);
    const ownerDevices = await http
      .get('/devices')
      .set(guardianHeader(firstGuardian.token))
      .expect(200);
    assert.ok(
      ownerDevices.body.some(
        (entry) =>
          entry.id === device.id &&
          entry.paired &&
          entry.associationId === completed.body.associationId,
      ),
    );
    await http
      .delete(`/devices/${device.id}/association`)
      .set(agentHeader(expiringDevice.raw))
      .expect(401);
    await http
      .delete(`/devices/${device.id}/association`)
      .set(guardianHeader(firstGuardian.token))
      .expect(204);
    await http
      .get('/devices')
      .set(guardianHeader(firstGuardian.token))
      .expect(200)
      .expect([]);
    await http
      .post('/pairing/validate')
      .set(guardianHeader(firstGuardian.token))
      .send({ token: created.body.token })
      .expect(410);
    const history = await http
      .get('/agent/associations')
      .set(agentHeader(raw))
      .expect(200);
    assert.equal(history.body[0].revokedAt !== null, true);

    const reassociationSession = await http
      .post('/agent/pairing-sessions')
      .set(agentHeader(raw))
      .expect(201);
    const reassociated = await http
      .post('/pairing/complete')
      .set(guardianHeader(secondGuardian.token))
      .send({ token: reassociationSession.body.token })
      .expect(200);
    assert.equal(reassociated.body.paired, true);
    await http
      .get('/devices')
      .set(guardianHeader(firstGuardian.token))
      .expect(200)
      .expect([]);
    const secondOwnerDevices = await http
      .get('/devices')
      .set(guardianHeader(secondGuardian.token))
      .expect(200);
    assert.ok(secondOwnerDevices.body.some((entry) => entry.id === device.id));
    await http
      .delete(`/agent/associations/${reassociated.body.associationId}`)
      .set(agentHeader(expiringDevice.raw))
      .expect(404);
    await http
      .delete(`/agent/associations/${reassociated.body.associationId}`)
      .set(agentHeader(raw))
      .expect(204);
    await http
      .get('/devices')
      .set(guardianHeader(secondGuardian.token))
      .expect(200)
      .expect([]);

    const secondDevice = await createAgent('Pairing fixture concurrent');
    const concurrentSession = await http
      .post('/agent/pairing-sessions')
      .set(agentHeader(secondDevice.raw))
      .expect(201);
    const results = await Promise.all([
      http
        .post('/pairing/complete')
        .set(guardianHeader(firstGuardian.token))
        .send({ token: concurrentSession.body.token }),
      http
        .post('/pairing/complete')
        .set(guardianHeader(secondGuardian.token))
        .send({ token: concurrentSession.body.token }),
    ]);
    assert.deepEqual(results.map((result) => result.status).sort(), [200, 410]);
    const association = await prisma.deviceAssociation.findFirst({
      where: {
        deviceId: secondDevice.device.id,
        activeDeviceId: secondDevice.device.id,
      },
    });
    assert.ok(association);
    assert.equal(
      await prisma.deviceAssociation.count({
        where: {
          deviceId: secondDevice.device.id,
          activeDeviceId: { not: null },
        },
      }),
      1,
    );

    const rollbackDevice = await createAgent('Pairing fixture rollback');
    const competingAssociation = await prisma.deviceAssociation.create({
      data: {
        deviceId: rollbackDevice.device.id,
        guardianId: firstGuardian.guardian.id,
        activeDeviceId: rollbackDevice.device.id,
      },
    });
    await assert.rejects(() =>
      prisma.deviceAssociation.create({
        data: {
          deviceId: rollbackDevice.device.id,
          guardianId: secondGuardian.guardian.id,
          activeDeviceId: null,
        },
      }),
    );
    const rollbackSession = await http
      .post('/agent/pairing-sessions')
      .set(agentHeader(rollbackDevice.raw))
      .expect(201);
    await http
      .post('/pairing/complete')
      .set(guardianHeader(secondGuardian.token))
      .send({ token: rollbackSession.body.token })
      .expect(409);
    const unconsumed = await prisma.pairingSession.findUnique({
      where: { tokenHash: digest(rollbackSession.body.token) },
    });
    assert.equal(unconsumed.consumedAt, null);
    await prisma.deviceAssociation.delete({
      where: { id: competingAssociation.id },
    });

    const lockDevice = await createAgent('Pairing fixture lock expiry');
    const lockSession = await http
      .post('/agent/pairing-sessions')
      .set(agentHeader(lockDevice.raw))
      .expect(201);
    let releaseDeviceLock;
    let signalDeviceLock;
    const deviceLocked = new Promise((resolve) => {
      signalDeviceLock = resolve;
    });
    const blockedTransaction = prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM Device WHERE id = ${lockDevice.device.id} FOR UPDATE`;
      signalDeviceLock();
      await new Promise((resolve) => {
        releaseDeviceLock = resolve;
      });
      await tx.pairingSession.update({
        where: { tokenHash: digest(lockSession.body.token) },
        data: { expiresAt: new Date(0) },
      });
    });
    await deviceLocked;
    const blockedCompletion = http
      .post('/pairing/complete')
      .set(guardianHeader(firstGuardian.token))
      .send({ token: lockSession.body.token })
      .then((response) => response);
    await new Promise((resolve) => setImmediate(resolve));
    releaseDeviceLock();
    await blockedTransaction;
    const expiredWhileLocked = await blockedCompletion;
    assert.equal(expiredWhileLocked.status, 410);
    assert.match(expiredWhileLocked.body.message, /expirada/);

    const revokedIdentityDevice = await createAgent(
      'Pairing fixture revoked identity',
    );
    const revokedIdentitySession = await http
      .post('/agent/pairing-sessions')
      .set(agentHeader(revokedIdentityDevice.raw))
      .expect(201);
    await prisma.agentIdentity.update({
      where: { id: revokedIdentityDevice.identity.id },
      data: { revokedAt: new Date() },
    });
    await http
      .post('/agent/pairing-sessions')
      .set(agentHeader(revokedIdentityDevice.raw))
      .expect(401);
    const revokedToken = await http
      .post('/pairing/validate')
      .set(guardianHeader(firstGuardian.token))
      .send({ token: revokedIdentitySession.body.token })
      .expect(410);
    assert.match(revokedToken.body.message, /Identidade/);

    const demo = await createAgent('Pairing demo fixture', true);
    const demoSession = await http
      .post('/agent/pairing-sessions')
      .set(agentHeader(demo.raw))
      .expect(201);
    process.env.NODE_ENV = 'production';
    try {
      await http
        .post('/agent/pairing-sessions')
        .set(agentHeader(demo.raw))
        .expect(401);
      await http
        .post('/pairing/validate')
        .set(guardianHeader(firstGuardian.token))
        .send({ token: demoSession.body.token })
        .expect(410);
    } finally {
      process.env.NODE_ENV = 'test';
    }

    const directory = await mkdtemp(join(tmpdir(), 'piplup-agent-admin-'));
    temporaryDirectories.push(directory);
    const credentialPath = join(directory, 'agent-credential');
    const provisioning = spawnSync(
      process.execPath,
      [
        'dist/src/agent/agent-admin.js',
        'provision',
        '--name',
        'Pairing fixture provisioned',
        '--managed-user',
        'ana',
        '--output',
        credentialPath,
      ],
      { encoding: 'utf8', env: process.env },
    );
    assert.equal(provisioning.status, 0, provisioning.stderr);
    assert.match(provisioning.stdout, /Computador provisionado:/);
    const provisionedId = provisioning.stdout.match(
      /Computador provisionado: ([0-9a-f-]{36})/,
    )?.[1];
    assert.ok(provisionedId);
    const provisioned = await prisma.device.findUnique({
      where: { id: provisionedId },
    });
    assert.ok(provisioned);
    devices.push(provisioned);
    assert.equal(provisioned.managedUser, 'ana');
    const fileStats = await stat(credentialPath);
    assert.equal(fileStats.mode & 0o777, 0o600);
    const provisionedCredential = (
      await readFile(credentialPath, 'utf8')
    ).trim();
    assert.equal(provisionedCredential.length, 43);
    assert.ok(!provisioning.stdout.includes(provisionedCredential));
    const provisionedIdentity = await prisma.agentIdentity.findUnique({
      where: { deviceId: provisionedId },
    });
    assert.equal(
      provisionedIdentity.credentialHash,
      digest(provisionedCredential),
    );
    const provisionedSession = await http
      .post('/agent/pairing-sessions')
      .set(agentHeader(provisionedCredential))
      .expect(201);
    const provisionedAssociation = await http
      .post('/pairing/complete')
      .set(guardianHeader(firstGuardian.token))
      .send({ token: provisionedSession.body.token })
      .expect(200);
    const duplicateOutputName = `Duplicate output ${randomUUID()}`;
    const duplicateIdentityScope = { device: { name: duplicateOutputName } };
    const secretHashBeforeProvisionRetry = await prisma.agentIdentity.count({
      where: duplicateIdentityScope,
    });
    const retryProvision = spawnSync(
      process.execPath,
      [
        'dist/src/agent/agent-admin.js',
        'provision',
        '--name',
        duplicateOutputName,
        '--output',
        credentialPath,
      ],
      { encoding: 'utf8', env: process.env },
    );
    assert.notEqual(retryProvision.status, 0);
    assert.match(retryProvision.stderr, /Provisionamento falhou/);
    assert.equal(
      await prisma.agentIdentity.count({ where: duplicateIdentityScope }),
      secretHashBeforeProvisionRetry,
    );
    assert.equal(
      await prisma.device.count({ where: { name: duplicateOutputName } }),
      0,
    );
    const revocation = spawnSync(
      process.execPath,
      ['dist/src/agent/agent-admin.js', 'revoke', '--device-id', provisionedId],
      { encoding: 'utf8', env: process.env },
    );
    assert.equal(revocation.status, 0, revocation.stderr);
    await http
      .get('/agent/associations')
      .set(agentHeader(provisionedCredential))
      .expect(401);
    const devicesAfterIdentityRevocation = await http
      .get('/devices')
      .set(guardianHeader(firstGuardian.token))
      .expect(200);
    assert.ok(
      !devicesAfterIdentityRevocation.body.some(
        (entry) => entry.id === provisionedId,
      ),
    );
    const provisionedAssociationHistory =
      await prisma.deviceAssociation.findUnique({
        where: { id: provisionedAssociation.body.associationId },
      });
    assert.ok(provisionedAssociationHistory.revokedAt);

    const demoProvisioning = spawnSync(
      process.execPath,
      [
        'dist/src/agent/agent-admin.js',
        'provision',
        '--name',
        'Forbidden demo fixture',
        '--output',
        join(directory, 'demo-credential'),
        '--demo',
      ],
      { encoding: 'utf8', env: process.env },
    );
    assert.notEqual(demoProvisioning.status, 0);
    assert.match(demoProvisioning.stderr, /NODE_ENV=development/);
    assert.equal(
      await prisma.device.count({ where: { name: 'Forbidden demo fixture' } }),
      0,
    );
    assert.equal(
      await prisma.device.count({
        where: { id: { not: provisionedId }, name: 'Duplicate output fixture' },
      }),
      0,
    );
    await rm(directory, { recursive: true, force: true });
    temporaryDirectories.splice(temporaryDirectories.indexOf(directory), 1);
  } finally {
    for (const device of devices) {
      await prisma.deviceAssociation.deleteMany({
        where: { deviceId: device.id },
      });
      await prisma.pairingSession.deleteMany({
        where: { deviceId: device.id },
      });
      await prisma.agentIdentity.deleteMany({ where: { deviceId: device.id } });
      await prisma.device
        .delete({ where: { id: device.id } })
        .catch(() => undefined);
    }
    for (const guardian of guardians) {
      await prisma.guardian.delete({ where: { id: guardian.id } });
    }
    await Promise.all(
      temporaryDirectories.map((directory) =>
        rm(directory, { recursive: true, force: true }),
      ),
    );
    await app.close();
  }
});

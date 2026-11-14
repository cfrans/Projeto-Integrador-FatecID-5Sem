import assert from 'node:assert/strict';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import test from 'node:test';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { argon2id, hash } from 'argon2';
import request from 'supertest';
import { AppModule } from '../dist/src/app.module.js';
import { PrismaService } from '../dist/src/prisma/prisma.service.js';

const digest = (value) => createHash('sha256').update(value).digest('hex');
const bearer = (raw) => ({ Authorization: `Bearer ${raw}` });

function newCredential() {
  const raw = randomBytes(32).toString('base64url');
  return { raw, credentialHash: digest(raw) };
}

async function withApp(run) {
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
  const fixtures = { hashes: [], guardians: [], devices: [] };
  try {
    await run({ http: request(app.getHttpServer()), prisma, fixtures });
  } finally {
    const sessions = await prisma.pairingSession.findMany({
      where: { registrationCredentialHash: { in: fixtures.hashes } },
      select: { registrationDeviceId: true },
    });
    const deviceIds = [
      ...fixtures.devices,
      ...sessions.map((session) => session.registrationDeviceId),
    ];
    await prisma.deviceAssociation.deleteMany({
      where: { deviceId: { in: deviceIds } },
    });
    await prisma.pairingSession.deleteMany({
      where: {
        OR: [
          { deviceId: { in: deviceIds } },
          { registrationCredentialHash: { in: fixtures.hashes } },
        ],
      },
    });
    await prisma.agentIdentity.deleteMany({
      where: { deviceId: { in: deviceIds } },
    });
    await prisma.device.deleteMany({ where: { id: { in: deviceIds } } });
    await prisma.guardian.deleteMany({
      where: { id: { in: fixtures.guardians } },
    });
    await app.close();
  }
}

async function createGuardian(http, prisma, fixtures) {
  const password = randomUUID();
  const guardian = await prisma.guardian.create({
    data: {
      email: `${randomUUID()}@example.test`,
      name: 'Registration guardian',
      passwordHash: await hash(password, { type: argon2id }),
    },
  });
  fixtures.guardians.push(guardian.id);
  const login = await http
    .post('/auth/login')
    .send({ email: guardian.email, password })
    .expect(200);
  return { guardian, token: login.body.accessToken };
}

test('registration validates the body strictly and refuses used credentials', async () => {
  await withApp(async ({ http, prisma, fixtures }) => {
    const { credentialHash } = newCredential();
    fixtures.hashes.push(credentialHash);
    const valid = { credentialHash, name: 'lux-pc', managedUser: 'ana' };

    for (const body of [
      { ...valid, deviceId: randomUUID() },
      { ...valid, credentialHash: credentialHash.toUpperCase() },
      { ...valid, name: 'x'.repeat(101) },
      { ...valid, managedUser: '' },
    ]) {
      await http.post('/agent/registrations').send(body).expect(400);
    }

    const device = await prisma.device.create({
      data: { name: 'Revoked registration fixture', isDemo: false },
    });
    fixtures.devices.push(device.id);
    await prisma.agentIdentity.create({
      data: { deviceId: device.id, credentialHash, revokedAt: new Date() },
    });
    await http.post('/agent/registrations').send(valid).expect(409);
    assert.equal(
      await prisma.pairingSession.count({
        where: { registrationCredentialHash: credentialHash },
      }),
      0,
    );

    await assert.rejects(
      prisma.pairingSession.create({
        data: {
          deviceId: device.id,
          registrationDeviceId: randomUUID(),
          registrationCredentialHash: credentialHash,
          registrationName: 'both',
          registrationManagedUser: 'both',
          tokenHash: digest(randomUUID()),
          expiresAt: new Date(Date.now() + 60_000),
        },
      }),
    );
    await assert.rejects(
      prisma.pairingSession.create({
        data: {
          tokenHash: digest(randomUUID()),
          expiresAt: new Date(Date.now() + 60_000),
        },
      }),
    );
  });
});

test('registration creates the computer only when a guardian completes pairing', async () => {
  await withApp(async ({ http, prisma, fixtures }) => {
    const { guardian, token } = await createGuardian(http, prisma, fixtures);
    const credential = newCredential();
    fixtures.hashes.push(credential.credentialHash);
    const body = {
      credentialHash: credential.credentialHash,
      name: 'lux-pc',
      managedUser: 'ana',
    };

    const stale = await http
      .post('/agent/registrations')
      .send(body)
      .expect(201);
    const created = await http
      .post('/agent/registrations')
      .send(body)
      .expect(201);
    assert.equal(created.body.token.length, 43);
    assert.equal(
      created.body.qrPayload,
      `piplup://pair?token=${created.body.token}`,
    );
    const ttl = Date.parse(created.body.expiresAt) - Date.now();
    assert.ok(ttl > 0 && ttl <= 5 * 60 * 1000);

    const session = await prisma.pairingSession.findUniqueOrThrow({
      where: { tokenHash: digest(created.body.token) },
    });
    assert.equal(session.deviceId, null);
    assert.equal(
      await prisma.device.count({
        where: { id: session.registrationDeviceId },
      }),
      0,
    );
    assert.equal(
      await prisma.agentIdentity.count({
        where: { credentialHash: credential.credentialHash },
      }),
      0,
    );

    await http
      .post('/pairing/validate')
      .set(bearer(token))
      .send({ token: stale.body.token })
      .expect(410);
    await http
      .get('/agent/associations')
      .set(bearer(credential.raw))
      .expect(401);

    const validated = await http
      .post('/pairing/validate')
      .set(bearer(token))
      .send({ token: created.body.token })
      .expect(200);
    assert.deepEqual(validated.body, {
      valid: true,
      expiresAt: created.body.expiresAt,
      device: {
        id: session.registrationDeviceId,
        name: 'lux-pc',
        managedUser: 'ana',
        isDemo: false,
      },
    });

    const completed = await http
      .post('/pairing/complete')
      .set(bearer(token))
      .send({ token: created.body.token })
      .expect(200);
    assert.deepEqual(completed.body, {
      id: session.registrationDeviceId,
      name: 'lux-pc',
      managedUser: 'ana',
      isDemo: false,
      status: 'unverified',
      lastSeen: null,
      paired: true,
      associationId: completed.body.associationId,
    });
    const device = await prisma.device.findUniqueOrThrow({
      where: { id: session.registrationDeviceId },
      include: { agentIdentity: true },
    });
    assert.equal(device.guardianId, guardian.id);
    assert.equal(device.isDemo, false);
    assert.equal(
      device.agentIdentity.credentialHash,
      credential.credentialHash,
    );

    await http
      .post('/pairing/complete')
      .set(bearer(token))
      .send({ token: created.body.token })
      .expect(410);
    const associations = await http
      .get('/agent/associations')
      .set(bearer(credential.raw))
      .expect(200);
    assert.equal(associations.body.length, 1);
    assert.equal(associations.body[0].id, completed.body.associationId);
    assert.equal(associations.body[0].revokedAt, null);

    await http.post('/agent/registrations').send(body).expect(409);

    const late = newCredential();
    fixtures.hashes.push(late.credentialHash);
    const expired = await http
      .post('/agent/registrations')
      .send({ ...body, credentialHash: late.credentialHash })
      .expect(201);
    await prisma.pairingSession.update({
      where: { tokenHash: digest(expired.body.token) },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    for (const path of ['/pairing/validate', '/pairing/complete']) {
      const result = await http
        .post(path)
        .set(bearer(token))
        .send({ token: expired.body.token })
        .expect(410);
      assert.match(result.body.message, /expirada/);
    }
    assert.equal(
      await prisma.agentIdentity.count({
        where: { credentialHash: late.credentialHash },
      }),
      0,
    );
  });
});

test('registration is rate limited per address without affecting other routes', async () => {
  await withApp(async ({ http }) => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await http.post('/agent/registrations').send({}).expect(400);
    }
    await http.post('/agent/registrations').send({}).expect(429);
    await http.post('/agent/pairing-sessions').expect(401);
    await http.post('/pairing/validate').expect(401);
  });
});

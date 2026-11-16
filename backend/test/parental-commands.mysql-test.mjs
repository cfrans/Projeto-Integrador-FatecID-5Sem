import assert from 'node:assert/strict';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import test from 'node:test';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { hash } from 'argon2';
import request from 'supertest';
import { AppModule } from '../dist/src/app.module.js';
import { PrismaService } from '../dist/src/prisma/prisma.service.js';

const SET = 'parental.app_filter.set';
const READ = 'parental.app_filter.read';
const filter = (blockedApplications, blockInstallation = false) => ({
  blockedApplications,
  blockInstallation,
});
const intent = (type, parameters = {}, requestId = randomUUID()) => ({
  requestId,
  type,
  version: 1,
  parameters,
});

test('parental commands reconcile the desired policy with what the simulated agent observes', async () => {
  assert.equal(process.env.NODE_ENV, 'test');
  assert.match(process.env.MYSQL_DATABASE ?? '', /_test$/);
  process.env.ENABLE_PARENTAL_COMMANDS = 'true';
  const app = await NestFactory.create(AppModule, { logger: false });
  app.useBodyParser('json', { limit: '16kb' });
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );
  await app.init();
  const prisma = app.get(PrismaService);
  const http = request(app.getHttpServer());
  const guardianIds = [];
  const deviceIds = [];
  const password = randomUUID();

  async function guardian() {
    const record = await prisma.guardian.create({
      data: {
        email: `${randomUUID()}@example.test`,
        name: 'Parental test',
        passwordHash: await hash(password),
      },
    });
    guardianIds.push(record.id);
    const login = await http
      .post('/auth/login')
      .send({ email: record.email, password })
      .expect(200);
    return {
      id: record.id,
      headers: { Authorization: `Bearer ${login.body.accessToken}` },
    };
  }

  async function pairedDevice(owner) {
    const credential = randomBytes(32).toString('base64url');
    const device = await prisma.device.create({
      data: { name: 'Parental fixture', isDemo: true },
    });
    deviceIds.push(device.id);
    await prisma.agentIdentity.create({
      data: {
        deviceId: device.id,
        credentialHash: createHash('sha256').update(credential).digest('hex'),
      },
    });
    const headers = { Authorization: `Bearer ${credential}` };
    const session = await http
      .post('/agent/pairing-sessions')
      .set(headers)
      .expect(201);
    await http
      .post('/pairing/complete')
      .set(owner.headers)
      .send({ token: session.body.token })
      .expect(200);
    return { deviceId: device.id, headers };
  }

  const owner = await guardian();
  const stranger = await guardian();
  const f = await pairedDevice(owner);
  const commandsUrl = `/devices/${f.deviceId}/commands`;
  const policyUrl = `/devices/${f.deviceId}/parental-policy`;

  const create = (type, parameters, requestId) =>
    http.post(commandsUrl).set(owner.headers).send(intent(type, parameters, requestId));
  const policy = async () =>
    (await http.get(policyUrl).set(owner.headers).expect(200)).body;
  const command = async (id) =>
    (await http.get(`${commandsUrl}/${id}`).set(owner.headers).expect(200)).body;

  // The simulated agent: polls, claims and reports like the Python agent will.
  const local = { current: filter([]) };
  async function agentStep(respond) {
    const polled = await http.get('/agent/commands').set(f.headers).expect(200);
    const [pending] = polled.body.commands;
    if (!pending) return null;
    const claimId = randomUUID();
    await http
      .post(`/agent/commands/${pending.id}/claim`)
      .set(f.headers)
      .send({ claimId })
      .expect(200);
    const body = respond(pending);
    const response = await http
      .put(`/agent/commands/${pending.id}/result`)
      .set(f.headers)
      .send({ claimId, ...body });
    return { pending, claimId, response, body };
  }
  const obedient = (pending) => {
    if (pending.type === SET) local.current = pending.parameters;
    return { status: 'succeeded', result: local.current, error: null };
  };

  try {
    process.env.ENABLE_PARENTAL_COMMANDS = 'false';
    await create(SET, filter(['org.mozilla.firefox'])).expect(501);
    process.env.ENABLE_PARENTAL_COMMANDS = 'true';

    for (const parameters of [
      {},
      filter(['bad id']),
      filter(['a', 'a']),
      { ...filter(['a']), extra: 1 },
    ])
      await create(SET, parameters).expect(400);
    await create(READ, { x: 1 }).expect(400);
    await create('parental.unknown', {}).expect(400);
    await http.get(policyUrl).set(owner.headers).expect(404);
    await http.get(policyUrl).set(stranger.headers).expect(404);

    const requestId = randomUUID();
    const first = await create(SET, filter(['zed', 'alpha'], true), requestId).expect(201);
    assert.deepEqual(first.body.parameters, filter(['alpha', 'zed'], true));
    assert.equal(first.body.type, SET);
    const repeat = await create(SET, filter(['alpha', 'zed'], true), requestId).expect(200);
    assert.equal(repeat.body.id, first.body.id);
    await create(SET, filter(['alpha']), requestId).expect(409);
    let current = await policy();
    assert.equal(current.revision, 1);
    assert.equal(current.state, 'pending');
    assert.equal(current.appliedRevision, null);

    const second = await create(SET, filter(['firefox'], false)).expect(201);
    assert.equal((await command(first.body.id)).status, 'cancelled');
    current = await policy();
    assert.equal(current.revision, 2);
    assert.deepEqual(current.appFilter, filter(['firefox']));

    const applied = await agentStep(obedient);
    assert.equal(applied.pending.id, second.body.id);
    assert.equal(applied.response.status, 200);
    assert.equal(applied.response.body.status, 'succeeded');
    assert.equal((await command(second.body.id)).status, 'succeeded');
    current = await policy();
    assert.equal(current.state, 'applied');
    assert.equal(current.appliedRevision, 2);
    assert.deepEqual(current.observedAppFilter, filter(['firefox']));
    assert.equal(current.error, null);

    const repeatedResult = await http
      .put(`/agent/commands/${applied.pending.id}/result`)
      .set(f.headers)
      .send({ claimId: applied.claimId, ...applied.body })
      .expect(200);
    assert.equal(repeatedResult.body.completedAt, applied.response.body.completedAt);
    await http
      .put(`/agent/commands/${applied.pending.id}/result`)
      .set(f.headers)
      .send({
        claimId: applied.claimId,
        status: 'succeeded',
        result: filter(['firefox'], true),
        error: null,
      })
      .expect(400);

    local.current = filter([]);
    await create(READ, {}).expect(201);
    await agentStep(obedient);
    current = await policy();
    assert.equal(current.state, 'drifted');
    assert.deepEqual(current.observedAppFilter, filter([]));
    assert.equal(current.appliedRevision, 2);

    await create(SET, filter(['firefox'])).expect(201);
    const denied = await agentStep(() => ({
      status: 'failed',
      result: null,
      error: { code: 'PERMISSION_DENIED' },
    }));
    assert.equal(denied.response.body.status, 'failed');
    current = await policy();
    assert.equal(current.state, 'failed');
    assert.deepEqual(current.error, { code: 'PERMISSION_DENIED' });

    const retry = await create(SET, filter(['firefox'])).expect(201);
    assert.equal((await policy()).state, 'pending');
    assert.equal((await policy()).error, null);
    const mismatch = await agentStep(() => ({
      status: 'succeeded',
      result: filter(['other']),
      error: null,
    }));
    assert.equal(mismatch.response.status, 400);
    assert.equal((await command(retry.body.id)).status, 'running');
    assert.notEqual((await policy()).state, 'applied');
    await http
      .put(`/agent/commands/${retry.body.id}/result`)
      .set(f.headers)
      .send({
        claimId: mismatch.claimId,
        status: 'failed',
        result: null,
        error: { code: 'VERIFICATION_FAILED' },
      })
      .expect(200);
    assert.equal((await policy()).state, 'failed');
    await http
      .put(`/agent/commands/${retry.body.id}/result`)
      .set(f.headers)
      .send({
        claimId: mismatch.claimId,
        status: 'failed',
        result: null,
        error: { code: 'PERMISSION_DENIED' },
      })
      .expect(409);

    const older = await create(SET, filter(['steam'])).expect(201);
    const olderRevision = (await policy()).revision;
    const olderClaim = randomUUID();
    await http
      .post(`/agent/commands/${older.body.id}/claim`)
      .set(f.headers)
      .send({ claimId: olderClaim })
      .expect(200);
    const newer = await create(SET, filter(['discord'], true)).expect(201);
    await http
      .post(`/agent/commands/${newer.body.id}/claim`)
      .set(f.headers)
      .send({ claimId: randomUUID() })
      .expect(409);
    await http
      .put(`/agent/commands/${older.body.id}/result`)
      .set(f.headers)
      .send({
        claimId: olderClaim,
        status: 'succeeded',
        result: filter(['steam']),
        error: null,
      })
      .expect(200);
    current = await policy();
    assert.equal(current.state, 'pending');
    assert.equal(current.appliedRevision, olderRevision);
    local.current = filter(['steam']);
    await agentStep(obedient);
    current = await policy();
    assert.equal(current.state, 'applied');
    assert.equal(current.appliedRevision, current.revision);
    assert.deepEqual(current.observedAppFilter, filter(['discord'], true));

    const pendingAtRevocation = await create(SET, filter(['gimp'])).expect(201);
    await http
      .delete(`/devices/${f.deviceId}/association`)
      .set(owner.headers)
      .expect(204);
    assert.equal(
      (
        await prisma.agentCommand.findUniqueOrThrow({
          where: { id: pendingAtRevocation.body.id },
        })
      ).status,
      'cancelled',
    );
    await http.get(policyUrl).set(owner.headers).expect(404);
    await create(SET, filter(['gimp'])).expect(404);
  } finally {
    await prisma.parentalPolicy.deleteMany({
      where: { association: { deviceId: { in: deviceIds } } },
    });
    await prisma.agentCommand.deleteMany({
      where: { deviceId: { in: deviceIds } },
    });
    await prisma.deviceAssociation.deleteMany({
      where: { deviceId: { in: deviceIds } },
    });
    await prisma.pairingSession.deleteMany({
      where: { deviceId: { in: deviceIds } },
    });
    await prisma.device.deleteMany({ where: { id: { in: deviceIds } } });
    await prisma.guardian.deleteMany({ where: { id: { in: guardianIds } } });
    await app.close();
  }
});

import assert from 'node:assert/strict';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { hash } from 'argon2';
import request from 'supertest';
import { AppModule } from '../dist/src/app.module.js';
import { PrismaService } from '../dist/src/prisma/prisma.service.js';
import { CommandsService } from '../dist/src/commands/commands.service.js';

const intent = (requestId = randomUUID()) => ({
  requestId,
  type: 'agent.ping',
  version: 1,
  parameters: {},
});
const claimBody = (claimId = randomUUID()) => ({ claimId });
const success = (claimId) => ({
  claimId,
  status: 'succeeded',
  result: { reachable: true },
  error: null,
});

test('command protocol with real MySQL', async (t) => {
  assert.equal(process.env.NODE_ENV, 'test');
  assert.match(process.env.MYSQL_DATABASE ?? '', /_test$/);
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
  const service = app.get(CommandsService);
  const http = request(app.getHttpServer());
  const guardianIds = [];
  const deviceIds = [];
  const password = randomUUID();

  async function guardian() {
    const record = await prisma.guardian.create({
      data: {
        email: `${randomUUID()}@example.test`,
        name: 'Command test',
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

  async function fixture(owner, paired = true) {
    const credential = randomBytes(32).toString('base64url');
    const device = await prisma.device.create({
      data: { name: 'Isolated command fixture', isDemo: true },
    });
    deviceIds.push(device.id);
    const identity = await prisma.agentIdentity.create({
      data: {
        deviceId: device.id,
        credentialHash: createHash('sha256').update(credential).digest('hex'),
      },
    });
    const headers = { Authorization: `Bearer ${credential}` };
    let associationId;
    if (paired) {
      const session = await http
        .post('/agent/pairing-sessions')
        .set(headers)
        .expect(201);
      const pairedResponse = await http
        .post('/pairing/complete')
        .set(owner.headers)
        .send({ token: session.body.token })
        .expect(200);
      associationId = pairedResponse.body.associationId;
    }
    return {
      deviceId: device.id,
      identity,
      headers,
      associationId,
      url: `/devices/${device.id}/commands`,
      agent: { id: identity.id, deviceId: device.id },
    };
  }

  async function create(f, owner, body = intent()) {
    const response = await http
      .post(f.url)
      .set(owner.headers)
      .send(body)
      .expect(201);
    assert.equal(response.headers['cache-control'], 'no-store');
    return response.body;
  }

  async function claim(f, command, body = claimBody()) {
    const response = await http
      .post(`/agent/commands/${command.id}/claim`)
      .set(f.headers)
      .send(body)
      .expect(200);
    return response.body.command;
  }

  try {
    const owner = await guardian();
    const stranger = await guardian();

    await t.test(
      'requires an active original association, identity and correct authentication',
      async () => {
        const f = await fixture(owner, false);
        await http.post(f.url).send(intent()).expect(401);
        await http.get('/agent/commands').set(owner.headers).expect(401);
        await http
          .get('/agent/commands')
          .set(f.headers)
          .expect(200)
          .expect((response) => assert.deepEqual(response.body.commands, []));
        await prisma.device.update({
          where: { id: f.deviceId },
          data: { guardianId: owner.id },
        });
        await http.post(f.url).set(owner.headers).send(intent()).expect(404);
        const paired = await fixture(owner);
        await http
          .post(paired.url)
          .set(stranger.headers)
          .send(intent())
          .expect(404);
        await prisma.agentIdentity.update({
          where: { id: paired.identity.id },
          data: { revokedAt: new Date() },
        });
        await http
          .post(paired.url)
          .set(owner.headers)
          .send(intent())
          .expect(410);
        await http.get('/agent/commands').set(paired.headers).expect(401);
      },
    );

    await t.test(
      'creation is idempotent under concurrency and scopes requestId to the association',
      async () => {
        const f = await fixture(owner);
        const body = intent();
        const responses = await Promise.all(
          [1, 2].map(() => http.post(f.url).set(owner.headers).send(body)),
        );
        assert.deepEqual(
          responses.map((response) => response.status).sort(),
          [200, 201],
        );
        assert.equal(responses[0].body.id, responses[1].body.id);
        assert.equal(
          await prisma.agentCommand.count({
            where: {
              associationId: f.associationId,
              requestId: body.requestId,
            },
          }),
          1,
        );
        const other = await fixture(owner);
        const otherCommand = await create(other, owner, body);
        assert.notEqual(otherCommand.id, responses[0].body.id);
        await http
          .post(f.url)
          .set(owner.headers)
          .send({ ...body, requestId: body.requestId.toUpperCase() })
          .expect(200);
        await prisma.agentCommand.update({
          where: { id: responses[0].body.id },
          data: { version: 2 },
        });
        await http.post(f.url).set(owner.headers).send(body).expect(409);
      },
    );

    await t.test(
      'rejects untyped operations, parameters, extra fields and excessive bodies',
      async () => {
        const f = await fixture(owner);
        for (const body of [
          { ...intent(), type: 'shell.exec' },
          { ...intent(), version: 2 },
          { ...intent(), version: true },
          { ...intent(), parameters: { command: 'id' } },
          { ...intent(), parameters: [] },
          { ...intent(), guardianId: owner.id },
          { ...intent(), requestId: 'invalid' },
        ])
          await http.post(f.url).set(owner.headers).send(body).expect(400);
        await http
          .post(f.url)
          .set(owner.headers)
          .send({ ...intent(), arbitrary: 'x'.repeat(17 * 1024) })
          .expect(413);
      },
    );

    await t.test(
      'isolates devices, guardians, claimIds and limits the poll to one command',
      async () => {
        const f = await fixture(owner);
        const other = await fixture(stranger);
        const command = await create(f, owner);
        await create(f, owner);
        const poll = await http
          .get('/agent/commands')
          .set(f.headers)
          .expect(200);
        assert.equal(poll.body.commands.length, 1);
        assert.equal(poll.body.commands[0].id, command.id);
        assert.equal(poll.headers['cache-control'], 'no-store');
        const empty = await http
          .get('/agent/commands')
          .set(other.headers)
          .expect(200);
        assert.deepEqual(empty.body.commands, []);
        await http
          .get(`${f.url}/${command.id}`)
          .set(stranger.headers)
          .expect(404);
        await http
          .get(`${other.url}/${command.id}`)
          .set(stranger.headers)
          .expect(404);
        await http
          .post(`/agent/commands/${command.id}/claim`)
          .set(other.headers)
          .send(claimBody())
          .expect(404);
        await http
          .put(`/agent/commands/${command.id}/result`)
          .set(other.headers)
          .send(success(randomUUID()))
          .expect(404);
        const reserved = await claim(f, command);
        await http
          .put(`/agent/commands/${command.id}/result`)
          .set(f.headers)
          .send(success(randomUUID()))
          .expect(409);
        assert.equal(reserved.status, 'running');
      },
    );

    await t.test(
      'concurrent claims have one winner and same-claim retries keep the deadline',
      async () => {
        const f = await fixture(owner);
        const command = await create(f, owner);
        const bodies = [claimBody(), claimBody()];
        const responses = await Promise.all(
          bodies.map((body) =>
            http
              .post(`/agent/commands/${command.id}/claim`)
              .set(f.headers)
              .send(body),
          ),
        );
        assert.deepEqual(
          responses.map((response) => response.status).sort(),
          [200, 409],
        );
        const winner = responses.find((response) => response.status === 200)
          .body.command;
        const retried = await claim(f, command, { claimId: winner.claimId });
        assert.equal(retried.executionDeadlineAt, winner.executionDeadlineAt);
        const second = await create(f, owner);
        await http
          .post(`/agent/commands/${second.id}/claim`)
          .set(f.headers)
          .send(claimBody())
          .expect(409);
        await http
          .put(`/agent/commands/${command.id}/result`)
          .set(f.headers)
          .send(success(winner.claimId))
          .expect(200);
        await http
          .post(`/agent/commands/${second.id}/claim`)
          .set(f.headers)
          .send({ claimId: winner.claimId })
          .expect(409);
        const other = await fixture(owner);
        const otherCommand = await create(other, owner);
        await claim(other, otherCommand, { claimId: winner.claimId });
      },
    );

    await t.test(
      'simultaneous retries of one claim preserve one reservation',
      async () => {
        const f = await fixture(owner);
        const command = await create(f, owner);
        const body = claimBody();
        const responses = await Promise.all(
          [1, 2].map(() =>
            http
              .post(`/agent/commands/${command.id}/claim`)
              .set(f.headers)
              .send(body)
              .expect(200),
          ),
        );
        assert.equal(responses[0].body.command.claimId, body.claimId);
        assert.equal(
          responses[0].body.command.executionDeadlineAt,
          responses[1].body.command.executionDeadlineAt,
        );
      },
    );

    await t.test(
      'agent association revocation atomically invalidates command authorization',
      async () => {
        const f = await fixture(owner);
        const command = await create(f, owner);
        await http
          .delete(`/agent/associations/${f.associationId}`)
          .set(f.headers)
          .expect(204);
        assert.equal(
          (
            await prisma.agentCommand.findUniqueOrThrow({
              where: { id: command.id },
            })
          ).status,
          'cancelled',
        );
        await http
          .post(`/agent/commands/${command.id}/claim`)
          .set(f.headers)
          .send(claimBody())
          .expect(410);
      },
    );

    await t.test(
      'different devices pair and claim concurrently without gap-lock conflicts',
      async () => {
        const fixtures = await Promise.all(
          Array.from({ length: 8 }, () => fixture(owner)),
        );
        const commands = await Promise.all(
          fixtures.map((f) => create(f, owner)),
        );
        const reservations = await Promise.all(
          fixtures.map((f, index) => claim(f, commands[index])),
        );
        assert.ok(
          reservations.every((reservation) => reservation.status === 'running'),
        );
      },
    );

    await t.test(
      'results are immutable, safely repeatable and queryable by the authorized guardian',
      async () => {
        const f = await fixture(owner);
        const command = await create(f, owner);
        const reserved = await claim(f, command);
        const url = `/agent/commands/${command.id}/result`;
        const result = success(reserved.claimId);
        const responses = await Promise.all(
          [1, 2].map(() =>
            http.put(url).set(f.headers).send(result).expect(200),
          ),
        );
        assert.deepEqual(responses[0].body, responses[1].body);
        await http
          .put(url)
          .set(f.headers)
          .send({
            ...result,
            status: 'failed',
            result: null,
            error: { code: 'LOCAL_UNAVAILABLE' },
          })
          .expect(409);
        await http
          .put(url)
          .set(f.headers)
          .send({ ...result, result: { reachable: false } })
          .expect(400);
        await http
          .put(url)
          .set(f.headers)
          .send({ ...result, result: { reachable: true, hostname: 'private' } })
          .expect(400);
        const read = await http
          .get(`${f.url}/${command.id}`)
          .set(owner.headers)
          .expect(200);
        assert.equal(read.body.status, 'succeeded');
        assert.deepEqual(read.body.result, { reachable: true });
        const stored = await prisma.agentCommand.findUniqueOrThrow({
          where: { id: command.id },
        });
        assert.equal(stored.status, 'succeeded');
        assert.equal(
          JSON.stringify(read.body).includes('credentialHash'),
          false,
        );
      },
    );

    await t.test(
      'accepts only bounded typed failure codes and deduplicates failures',
      async () => {
        const f = await fixture(owner);
        const command = await create(f, owner);
        const reserved = await claim(f, command);
        const url = `/agent/commands/${command.id}/result`;
        const body = {
          claimId: reserved.claimId,
          status: 'failed',
          result: null,
          error: { code: 'LOCAL_UNAVAILABLE' },
        };
        await http
          .put(url)
          .set(f.headers)
          .send({ ...body, error: { code: 'arbitrary traceback' } })
          .expect(400);
        const first = await http.put(url).set(f.headers).send(body).expect(200);
        const repeat = await http
          .put(url)
          .set(f.headers)
          .send(body)
          .expect(200);
        assert.deepEqual(first.body, repeat.body);
        await http
          .put(url)
          .set(f.headers)
          .send({ ...body, error: { code: 'EXECUTION_TIMEOUT' } })
          .expect(409);
      },
    );

    await t.test(
      'expires pending commands, never redelivers claims and accepts late same-claim results',
      async () => {
        const f = await fixture(owner);
        const expired = await create(f, owner);
        await prisma.agentCommand.update({
          where: { id: expired.id },
          data: { expiresAt: new Date(0) },
        });
        const state = await http
          .get(`${f.url}/${expired.id}`)
          .set(owner.headers)
          .expect(200);
        assert.equal(state.body.status, 'expired');
        await http
          .post(`/agent/commands/${expired.id}/claim`)
          .set(f.headers)
          .send(claimBody())
          .expect(410);
        const command = await create(f, owner);
        const reserved = await claim(f, command);
        await prisma.agentCommand.update({
          where: { id: command.id },
          data: { executionDeadlineAt: new Date(0) },
        });
        const unknown = await http
          .get(`${f.url}/${command.id}`)
          .set(owner.headers)
          .expect(200);
        assert.equal(unknown.body.status, 'unknown');
        const poll = await http
          .get('/agent/commands')
          .set(f.headers)
          .expect(200);
        assert.deepEqual(poll.body.commands, []);
        await http
          .post(`/agent/commands/${command.id}/claim`)
          .set(f.headers)
          .send(claimBody())
          .expect(409);
        const repeat = await claim(f, command, { claimId: reserved.claimId });
        assert.equal(repeat.status, 'unknown');
        const next = await create(f, owner);
        await claim(f, next);
        await http
          .put(`/agent/commands/${command.id}/result`)
          .set(f.headers)
          .send(success(reserved.claimId))
          .expect(200);
      },
    );

    await t.test(
      'revocation cancels pending, makes running unknown and does not transfer history to a new association',
      async () => {
        const f = await fixture(owner);
        const running = await create(f, owner);
        const reserved = await claim(f, running);
        const pending = await create(f, owner);
        await http
          .delete(`/devices/${f.deviceId}/association`)
          .set(owner.headers)
          .expect(204);
        assert.equal(
          (
            await prisma.agentCommand.findUniqueOrThrow({
              where: { id: pending.id },
            })
          ).status,
          'cancelled',
        );
        assert.equal(
          (
            await prisma.agentCommand.findUniqueOrThrow({
              where: { id: running.id },
            })
          ).status,
          'unknown',
        );
        await http
          .post(`/agent/commands/${pending.id}/claim`)
          .set(f.headers)
          .send(claimBody())
          .expect(410);
        await http
          .put(`/agent/commands/${running.id}/result`)
          .set(f.headers)
          .send(success(reserved.claimId))
          .expect(410);
        await http.get(`${f.url}/${running.id}`).set(owner.headers).expect(404);
        const session = await http
          .post('/agent/pairing-sessions')
          .set(f.headers)
          .expect(201);
        await http
          .post('/pairing/complete')
          .set(owner.headers)
          .send({ token: session.body.token })
          .expect(200);
        await http.get(`${f.url}/${running.id}`).set(owner.headers).expect(404);
        const newCommand = await create(f, owner, intent(pending.requestId));
        assert.notEqual(newCommand.id, pending.id);
      },
    );

    await t.test(
      'administrative identity revocation cancels commands and stale guard state cannot authorize',
      async () => {
        const f = await fixture(owner);
        const running = await create(f, owner);
        const reserved = await claim(f, running);
        const pending = await create(f, owner);
        const revoked = spawnSync(
          process.execPath,
          [
            'dist/src/agent/agent-admin.js',
            'revoke',
            '--device-id',
            f.deviceId,
          ],
          { encoding: 'utf8', env: process.env, timeout: 15000 },
        );
        assert.equal(revoked.status, 0, revoked.stderr);
        assert.equal(
          (
            await prisma.agentCommand.findUniqueOrThrow({
              where: { id: pending.id },
            })
          ).status,
          'cancelled',
        );
        assert.equal(
          (
            await prisma.agentCommand.findUniqueOrThrow({
              where: { id: running.id },
            })
          ).status,
          'unknown',
        );
        await http.get('/agent/commands').set(f.headers).expect(401);
        await http
          .put(`/agent/commands/${running.id}/result`)
          .set(f.headers)
          .send(success(reserved.claimId))
          .expect(401);
        await assert.rejects(
          service.claim(f.agent, pending.id, claimBody()),
          (error) => error.getStatus() === 401,
        );
      },
    );

    await t.test(
      'claims recheck expiry after waiting for the device lock',
      async () => {
        const f = await fixture(owner);
        const command = await create(f, owner);
        let locked;
        let release;
        const ready = new Promise((resolve) => {
          locked = resolve;
        });
        const gate = new Promise((resolve) => {
          release = resolve;
        });
        const blocker = prisma.$transaction(async (tx) => {
          await tx.$queryRaw`SELECT id FROM Device WHERE id = ${f.deviceId} FOR UPDATE`;
          locked();
          await gate;
          await tx.agentCommand.update({
            where: { id: command.id },
            data: { expiresAt: new Date(0) },
          });
        });
        await ready;
        const blockedClaim = service.claim(f.agent, command.id, claimBody());
        release();
        await blocker;
        await assert.rejects(
          blockedClaim,
          (error) => error.getStatus() === 410,
        );
      },
    );
  } finally {
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

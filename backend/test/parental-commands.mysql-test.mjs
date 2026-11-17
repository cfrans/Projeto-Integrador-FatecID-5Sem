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

test('real computer settings queue parental commands reconciled with what the agent observes', async () => {
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

  async function pairedDevice(owner, isDemo) {
    const credential = randomBytes(32).toString('base64url');
    const device = await prisma.device.create({
      data: { name: 'Parental fixture', isDemo },
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
    const apps = {};
    for (const sourceId of [
      'desktop:firefox-esr.desktop',
      'desktop:gimp.desktop',
      'desktop:steam.desktop',
      'desktop:discord.desktop',
    ]) {
      const app = await prisma.installedApplication.create({
        data: {
          deviceId: device.id,
          sourceId,
          name: sourceId,
          category: 'test',
          allowed: true,
        },
      });
      apps[sourceId.slice(8, -8)] = app.id;
    }
    return { deviceId: device.id, headers, apps };
  }

  const owner = await guardian();
  const stranger = await guardian();
  const f = await pairedDevice(owner, false);
  const demo = await pairedDevice(owner, true);
  const commandsUrl = `/devices/${f.deviceId}/commands`;
  const policyUrl = `/devices/${f.deviceId}/parental-policy`;
  const settingsUrl = `/simulation/devices/${f.deviceId}`;

  const create = (type, parameters, requestId) =>
    http.post(commandsUrl).set(owner.headers).send(intent(type, parameters, requestId));
  const policy = async () =>
    (await http.get(policyUrl).set(owner.headers).expect(200)).body;
  const command = async (id) =>
    (await http.get(`${commandsUrl}/${id}`).set(owner.headers).expect(200)).body;
  const pendingCommands = async (deviceId) =>
    prisma.agentCommand.findMany({
      where: { deviceId, type: SET, status: 'pending' },
    });
  async function change(settings, url = settingsUrl) {
    const current = await http.get(url).set(owner.headers).expect(200);
    const updated = await http
      .patch(url)
      .set(owner.headers)
      .send({ revision: current.body.revision, settings })
      .expect(200);
    return updated.body.revision;
  }
  async function changeAndQueue(settings) {
    const revision = await change(settings);
    const [queued] = await pendingCommands(f.deviceId);
    assert.ok(queued);
    assert.equal(queued.policyRevision, revision);
    return { revision, id: queued.id };
  }
  const block = (...names) =>
    Object.fromEntries(
      Object.entries(f.apps).map(([name, id]) => [id, !names.includes(name)]),
    );

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
    await change({ blockInstallation: false });
    assert.deepEqual(await pendingCommands(f.deviceId), []);
    await create(READ, {}).expect(501);
    process.env.ENABLE_PARENTAL_COMMANDS = 'true';

    await create(SET, filter(['desktop:gimp.desktop'])).expect(400);
    await create(READ, { x: 1 }).expect(400);
    await create('parental.unknown', {}).expect(400);
    await http.get(policyUrl).set(owner.headers).expect(404);
    await http.get(policyUrl).set(stranger.headers).expect(404);
    await http.get(settingsUrl).set(stranger.headers).expect(404);

    await change(
      {
        applicationRules: { [demo.apps.gimp]: false },
        allowedBrowsers: { firefox: false },
      },
      `/simulation/devices/${demo.deviceId}`,
    );
    assert.deepEqual(await pendingCommands(demo.deviceId), []);

    const first = await changeAndQueue({
      applicationRules: block('gimp', 'steam'),
      blockInstallation: true,
    });
    assert.deepEqual(
      (await command(first.id)).parameters,
      filter(['desktop:gimp.desktop', 'desktop:steam.desktop'], true),
    );
    let current = await policy();
    assert.equal(current.revision, first.revision);
    assert.equal(current.state, 'pending');
    assert.equal(current.appliedRevision, null);

    const second = await changeAndQueue({
      applicationRules: block(),
      blockInstallation: false,
      allowedBrowsers: { firefox: false },
    });
    assert.equal((await command(first.id)).status, 'cancelled');
    current = await policy();
    assert.equal(current.revision, second.revision);
    assert.deepEqual(current.appFilter, filter(['desktop:firefox-esr.desktop']));

    const applied = await agentStep(obedient);
    assert.equal(applied.pending.id, second.id);
    assert.equal(applied.pending.type, SET);
    assert.equal(applied.response.status, 200);
    assert.equal(applied.response.body.status, 'succeeded');
    assert.equal((await command(second.id)).status, 'succeeded');
    current = await policy();
    assert.equal(current.state, 'applied');
    assert.equal(current.appliedRevision, second.revision);
    assert.deepEqual(current.observedAppFilter, filter(['desktop:firefox-esr.desktop']));
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
        result: filter(['desktop:firefox-esr.desktop'], true),
        error: null,
      })
      .expect(400);

    local.current = filter([]);
    await create(READ, {}).expect(201);
    await agentStep(obedient);
    current = await policy();
    assert.equal(current.state, 'drifted');
    assert.deepEqual(current.observedAppFilter, filter([]));
    assert.equal(current.appliedRevision, second.revision);

    await changeAndQueue({ blockInstallation: true });
    const denied = await agentStep(() => ({
      status: 'failed',
      result: null,
      error: { code: 'PERMISSION_DENIED' },
    }));
    assert.equal(denied.response.body.status, 'failed');
    current = await policy();
    assert.equal(current.state, 'failed');
    assert.equal(current.error.code, 'PERMISSION_DENIED');
    assert.ok(Date.parse(current.error.at) >= Date.parse(current.appliedAt));

    const retry = await changeAndQueue({ blockInstallation: false });
    assert.equal((await policy()).state, 'pending');
    assert.equal((await policy()).error, null);
    const mismatch = await agentStep(() => ({
      status: 'succeeded',
      result: filter(['desktop:other.desktop']),
      error: null,
    }));
    assert.equal(mismatch.response.status, 400);
    assert.equal((await command(retry.id)).status, 'running');
    assert.notEqual((await policy()).state, 'applied');
    await http
      .put(`/agent/commands/${retry.id}/result`)
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
      .put(`/agent/commands/${retry.id}/result`)
      .set(f.headers)
      .send({
        claimId: mismatch.claimId,
        status: 'failed',
        result: null,
        error: { code: 'PERMISSION_DENIED' },
      })
      .expect(409);

    const older = await changeAndQueue({
      applicationRules: block('steam'),
      allowedBrowsers: { firefox: true },
    });
    const olderClaim = randomUUID();
    await http
      .post(`/agent/commands/${older.id}/claim`)
      .set(f.headers)
      .send({ claimId: olderClaim })
      .expect(200);
    const newer = await changeAndQueue({
      applicationRules: block('discord'),
      blockInstallation: true,
    });
    assert.equal((await command(older.id)).status, 'running');
    await http
      .post(`/agent/commands/${newer.id}/claim`)
      .set(f.headers)
      .send({ claimId: randomUUID() })
      .expect(409);
    await http
      .put(`/agent/commands/${older.id}/result`)
      .set(f.headers)
      .send({
        claimId: olderClaim,
        status: 'succeeded',
        result: filter(['desktop:steam.desktop']),
        error: null,
      })
      .expect(200);
    current = await policy();
    assert.equal(current.state, 'pending');
    assert.equal(current.appliedRevision, older.revision);
    local.current = filter(['desktop:steam.desktop']);
    await agentStep(obedient);
    current = await policy();
    assert.equal(current.state, 'applied');
    assert.equal(current.appliedRevision, newer.revision);
    assert.deepEqual(
      current.observedAppFilter,
      filter(['desktop:discord.desktop'], true),
    );

    const poll = async () =>
      (await http.get('/agent/commands').set(f.headers).expect(200)).body
        .commands;
    const setsOf = (revision) =>
      prisma.agentCommand.findMany({
        where: { deviceId: f.deviceId, type: SET, policyRevision: revision },
      });
    const past = () => new Date(Date.now() - 1000);
    const expire = (id) =>
      prisma.agentCommand.update({
        where: { id },
        data: { expiresAt: past() },
      });
    const settings = async () =>
      (await http.get(settingsUrl).set(owner.headers).expect(200)).body;

    const lost = await changeAndQueue({ applicationRules: block('steam') });
    await expire(lost.id);
    assert.equal((await command(lost.id)).status, 'expired');
    assert.equal((await policy()).state, 'pending');
    const [reissued] = await poll();
    assert.notEqual(reissued.id, lost.id);
    assert.equal(reissued.type, SET);
    assert.notEqual(reissued.requestId, (await command(lost.id)).requestId);
    assert.deepEqual(reissued.parameters, (await command(lost.id)).parameters);
    assert.deepEqual(
      (await poll()).map(({ id }) => id),
      [reissued.id],
    );
    assert.equal((await setsOf(lost.revision)).length, 2);
    assert.equal((await policy()).revision, lost.revision);

    const crashedClaim = randomUUID();
    await http
      .post(`/agent/commands/${reissued.id}/claim`)
      .set(f.headers)
      .send({ claimId: crashedClaim })
      .expect(200);
    assert.deepEqual(await poll(), []);
    await prisma.agentCommand.update({
      where: { id: reissued.id },
      data: { executionDeadlineAt: past() },
    });
    assert.equal((await command(reissued.id)).status, 'unknown');
    const [afterUnknown] = await poll();
    assert.ok(afterUnknown);
    assert.notEqual(afterUnknown.id, reissued.id);
    await http
      .put(`/agent/commands/${reissued.id}/result`)
      .set(f.headers)
      .send({
        claimId: crashedClaim,
        status: 'succeeded',
        result: reissued.parameters,
        error: null,
      })
      .expect(200);
    assert.equal((await policy()).state, 'applied');
    assert.equal((await command(afterUnknown.id)).status, 'cancelled');
    assert.deepEqual(await poll(), []);
    let snapshot = await settings();
    assert.equal(snapshot.appliedRevision, lost.revision);
    assert.equal(snapshot.appliedRevision, snapshot.revision);
    assert.equal(snapshot.error, null);
    assert.equal(snapshot.enforcement, 'enabled');

    const stuck = await changeAndQueue({ applicationRules: block('gimp') });
    await expire(stuck.id);
    await expire((await poll())[0].id);
    await expire((await poll())[0].id);
    assert.deepEqual(await poll(), []);
    assert.deepEqual(await poll(), []);
    assert.equal((await setsOf(stuck.revision)).length, 3);
    current = await policy();
    assert.equal(current.state, 'failed');
    assert.equal(current.error.code, 'EXECUTION_TIMEOUT');
    assert.ok(Date.parse(current.error.at));
    snapshot = await settings();
    assert.deepEqual(snapshot.error, current.error);
    assert.equal(snapshot.appliedRevision, lost.revision);

    const offline = await changeAndQueue({ applicationRules: block() });
    assert.equal((await policy()).error, null);
    process.env.ENABLE_PARENTAL_COMMANDS = 'false';
    await expire(offline.id);
    assert.deepEqual(await poll(), []);
    assert.equal((await setsOf(offline.revision)).length, 1);
    snapshot = await settings();
    assert.equal(snapshot.enforcement, 'disabled');
    assert.notEqual(snapshot.appliedRevision, snapshot.revision);
    process.env.ENABLE_PARENTAL_COMMANDS = 'true';

    const runningAtRevocation = await changeAndQueue({
      applicationRules: block('discord'),
    });
    await http
      .post(`/agent/commands/${runningAtRevocation.id}/claim`)
      .set(f.headers)
      .send({ claimId: randomUUID() })
      .expect(200);
    const pendingAtRevocation = await changeAndQueue({
      applicationRules: block('gimp'),
    });
    await http
      .delete(`/devices/${f.deviceId}/association`)
      .set(owner.headers)
      .expect(204);
    assert.equal(
      (
        await prisma.agentCommand.findUniqueOrThrow({
          where: { id: pendingAtRevocation.id },
        })
      ).status,
      'cancelled',
    );
    assert.equal(
      (
        await prisma.agentCommand.findUniqueOrThrow({
          where: { id: runningAtRevocation.id },
        })
      ).status,
      'unknown',
    );
    assert.deepEqual(await poll(), []);
    assert.equal((await setsOf(pendingAtRevocation.revision)).length, 1);
    await http.get(policyUrl).set(owner.headers).expect(404);
    await http.get(settingsUrl).set(owner.headers).expect(404);
  } finally {
    await prisma.parentalPolicy.deleteMany({
      where: { association: { deviceId: { in: deviceIds } } },
    });
    await prisma.agentCommand.deleteMany({
      where: { deviceId: { in: deviceIds } },
    });
    await prisma.simulationState.deleteMany({
      where: { association: { deviceId: { in: deviceIds } } },
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

import assert from 'node:assert/strict';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import test from 'node:test';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { hash } from 'argon2';
import request from 'supertest';
import { AppModule } from '../dist/src/app.module.js';
import { PrismaService } from '../dist/src/prisma/prisma.service.js';

const report = (reportId = randomUUID()) => ({
  protocolVersion: 1,
  reportId,
  collectedAt: new Date().toISOString(),
  applications: [
    {
      sourceId: 'org.mozilla.firefox',
      name: 'Firefox',
      category: 'browser',
      allowed: true,
    },
  ],
  installationRequests: [
    {
      sourceId: randomUUID(),
      applicationName: 'GIMP',
      requesterName: 'Conta gerenciada',
      requestedAt: new Date().toISOString(),
      ageRating: 'L',
    },
  ],
});

test('authenticated agent reports are transactional and idempotent', async () => {
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
  const http = request(app.getHttpServer());
  const guardianIds = [];
  const deviceIds = [];

  try {
    const password = randomUUID();
    const guardian = await prisma.guardian.create({
      data: {
        email: `${randomUUID()}@example.test`,
        name: 'Report test',
        passwordHash: await hash(password),
      },
    });
    guardianIds.push(guardian.id);
    const login = await http
      .post('/auth/login')
      .send({ email: guardian.email, password })
      .expect(200);
    const guardianHeaders = {
      Authorization: `Bearer ${login.body.accessToken}`,
    };

    const credential = randomBytes(32).toString('base64url');
    const device = await prisma.device.create({
      data: { name: 'Report fixture', isDemo: true },
    });
    deviceIds.push(device.id);
    await prisma.agentIdentity.create({
      data: {
        deviceId: device.id,
        credentialHash: createHash('sha256').update(credential).digest('hex'),
      },
    });
    const agentHeaders = { Authorization: `Bearer ${credential}` };
    const session = await http
      .post('/agent/pairing-sessions')
      .set(agentHeaders)
      .send({})
      .expect(201);
    await http
      .post('/pairing/complete')
      .set(guardianHeaders)
      .send({ token: session.body.token })
      .expect(200);

    const first = report();
    const firstResponse = await http
      .put('/agent/reports')
      .set(agentHeaders)
      .send(first)
      .expect(201);
    assert.equal(firstResponse.body.accepted, true);
    assert.equal(firstResponse.body.reportId, first.reportId);
    assert.equal(
      await prisma.installedApplication.count({ where: { deviceId: device.id } }),
      1,
    );
    assert.equal(
      await prisma.installationRequest.count({ where: { deviceId: device.id } }),
      1,
    );
    const marked = await prisma.device.findUniqueOrThrow({
      where: { id: device.id },
      select: { applicationsReportedAt: true, installationRequestsReportedAt: true },
    });
    assert.ok(marked.applicationsReportedAt);
    assert.ok(marked.installationRequestsReportedAt);

    const repeated = await http
      .put('/agent/reports')
      .set(agentHeaders)
      .send(first)
      .expect(200);
    assert.deepEqual(repeated.body, firstResponse.body);
    assert.equal(
      await prisma.agentReport.count({ where: { deviceId: device.id } }),
      1,
    );

    await http
      .put('/agent/reports')
      .set(agentHeaders)
      .send({ ...first, applications: [{ ...first.applications[0], name: 'Other' }] })
      .expect(409);

    const requestId = first.installationRequests[0].sourceId;
    await prisma.installationRequest.update({
      where: { deviceId_sourceId: { deviceId: device.id, sourceId: requestId } },
      data: { status: 'APPROVED' },
    });
    const second = report();
    second.installationRequests[0].sourceId = requestId;
    await http
      .put('/agent/reports')
      .set(agentHeaders)
      .send(second)
      .expect(201);
    assert.equal(
      (
        await prisma.installationRequest.findUniqueOrThrow({
          where: { deviceId_sourceId: { deviceId: device.id, sourceId: requestId } },
        })
      ).status,
      'APPROVED',
    );

    const otherFlow = await prisma.installationRequest.create({
      data: {
        deviceId: device.id,
        sourceId: `simulated:${randomUUID()}`,
        applicationName: 'Pedido do simulador',
        requesterName: 'Conta gerenciada',
        requestedAt: new Date(),
        ageRating: 'L',
        status: 'PENDING',
      },
    });
    await http
      .put('/agent/reports')
      .set(agentHeaders)
      .send({ ...report(), installationRequests: [] })
      .expect(201);
    assert.equal(
      (
        await prisma.installationRequest.findUniqueOrThrow({
          where: { id: otherFlow.id },
        })
      ).status,
      'PENDING',
    );

    const duplicated = report();
    duplicated.applications.push({ ...duplicated.applications[0] });
    await http.put('/agent/reports').set(agentHeaders).send(duplicated).expect(422);

    await prisma.agentIdentity.updateMany({
      where: { deviceId: device.id },
      data: { revokedAt: new Date() },
    });
    await http.put('/agent/reports').set(agentHeaders).send(report()).expect(401);
  } finally {
    await prisma.agentReport.deleteMany({ where: { deviceId: { in: deviceIds } } });
    await prisma.deviceAssociation.deleteMany({ where: { deviceId: { in: deviceIds } } });
    await prisma.pairingSession.deleteMany({ where: { deviceId: { in: deviceIds } } });
    await prisma.device.deleteMany({ where: { id: { in: deviceIds } } });
    await prisma.guardian.deleteMany({ where: { id: { in: guardianIds } } });
    await app.close();
  }
});

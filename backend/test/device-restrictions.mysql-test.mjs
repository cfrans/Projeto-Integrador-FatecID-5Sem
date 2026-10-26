import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { AppModule } from '../dist/src/app.module.js';
import { PrismaService } from '../dist/src/prisma/prisma.service.js';

test('restriction queries isolate active links and distinguish absent reports in MySQL', async () => {
  assert.equal(process.env.NODE_ENV, 'test', 'Use NODE_ENV=test.');
  assert.match(process.env.MYSQL_DATABASE ?? '', /_test$/, 'Use a dedicated database ending in _test.');
  const app = await NestFactory.create(AppModule, { logger: false });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  await app.init();
  const prisma = app.get(PrismaService);
  const guardianIds = [];
  const deviceIds = [];

  try {
    for (let i = 0; i < 2; i += 1) {
      const guardian = await prisma.guardian.create({ data: { email: `${randomUUID()}@example.test`, name: 'Restriction fixture', passwordHash: 'unused-test-hash' } });
      guardianIds.push(guardian.id);
      const device = await prisma.device.create({ data: { guardianId: guardian.id, name: 'Restriction fixture', isDemo: true } });
      deviceIds.push(device.id);
      await prisma.deviceAssociation.create({ data: { guardianId: guardian.id, deviceId: device.id, activeDeviceId: device.id } });
    }
    const token = await app.get(JwtService).signAsync({ sub: guardianIds[0] });
    const http = request(app.getHttpServer());
    const get = (deviceId, endpoint) => http.get(`/devices/${deviceId}/${endpoint}`).set('Authorization', `Bearer ${token}`);
    const endpoints = ['applications', 'installation-requests'];
    for (const endpoint of endpoints) {
      await http.get(`/devices/${deviceIds[0]}/${endpoint}`).expect(401);
      await get(deviceIds[1], endpoint).expect(404);
      await get(randomUUID(), endpoint).expect(404);
      await get('invalid', endpoint).expect(400);
      await get(deviceIds[0], endpoint).expect(503);
    }
    const reportedAt = new Date('2026-10-20T12:00:00.000Z');
    await prisma.device.update({ where: { id: deviceIds[0] }, data: { applicationsReportedAt: reportedAt, installationRequestsReportedAt: reportedAt } });
    for (const endpoint of endpoints) await get(deviceIds[0], endpoint).expect(200).expect([]);
    const firstApp = await prisma.installedApplication.create({ data: { deviceId: deviceIds[0], name: 'Zulu', category: 'Games', allowed: false } });
    const secondApp = await prisma.installedApplication.create({ data: { deviceId: deviceIds[0], name: 'Alpha', category: 'Browser', allowed: true } });
    await prisma.installedApplication.create({ data: { deviceId: deviceIds[1], name: 'Other guardian app', category: 'Browser', allowed: true } });
    const apps = await get(deviceIds[0], 'applications').expect(200);
    assert.deepEqual(apps.body, [secondApp, firstApp].map(({ deviceId: _deviceId, ...record }) => record));
    const pending = await prisma.installationRequest.create({ data: { deviceId: deviceIds[0], applicationName: 'Firefox', requesterName: 'Child', requestedAt: reportedAt, ageRating: 'L' } });
    await prisma.installationRequest.create({ data: { deviceId: deviceIds[0], applicationName: 'Decided request', requesterName: 'Child', requestedAt: reportedAt, ageRating: 'L', status: 'APPROVED' } });
    const requests = await get(deviceIds[0], 'installation-requests').expect(200);
    assert.deepEqual(requests.body, [{ id: pending.id, applicationName: 'Firefox', requesterName: 'Child', requestedAt: reportedAt.toISOString(), ageRating: 'L' }]);
    await prisma.deviceAssociation.updateMany({ where: { deviceId: deviceIds[0] }, data: { activeDeviceId: null, revokedAt: new Date() } });
    for (const endpoint of endpoints) await get(deviceIds[0], endpoint).expect(404);
  } finally {
    await prisma.deviceAssociation.deleteMany({ where: { deviceId: { in: deviceIds } } });
    await prisma.device.deleteMany({ where: { id: { in: deviceIds } } });
    await prisma.guardian.deleteMany({ where: { id: { in: guardianIds } } });
    await app.close();
  }
});

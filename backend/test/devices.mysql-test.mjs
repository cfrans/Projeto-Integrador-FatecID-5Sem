import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { argon2id, hash } from 'argon2';
import request from 'supertest';
import { AppModule } from '../dist/src/app.module.js';
import { PrismaService } from '../dist/src/prisma/prisma.service.js';

test('device listing is authenticated and isolated by guardian in MySQL', async () => {
  assert.equal(process.env.NODE_ENV, 'test', 'Use NODE_ENV=test.');
  assert.match(process.env.MYSQL_DATABASE ?? '', /_test$/, 'Use a dedicated database ending in _test.');
  const app = await NestFactory.create(AppModule, { logger: false });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  await app.init();
  const prisma = app.get(PrismaService);
  const password = randomUUID();
  const createdGuardians = [];
  const createdDevices = [];

  try {
    const first = await prisma.guardian.create({
      data: {
        email: `${randomUUID()}@example.test`,
        name: 'Devices MySQL fixture one',
        passwordHash: await hash(password, { type: argon2id }),
      },
    });
    createdGuardians.push(first);
    const second = await prisma.guardian.create({
      data: {
        email: `${randomUUID()}@example.test`,
        name: 'Devices MySQL fixture two',
        passwordHash: await hash(password, { type: argon2id }),
      },
    });
    createdGuardians.push(second);

    const http = request(app.getHttpServer());
    await http.get('/devices').expect(401);
    const firstLogin = await http.post('/auth/login').send({ email: first.email, password }).expect(200);
    const secondLogin = await http.post('/auth/login').send({ email: second.email, password }).expect(200);
    await http.get('/devices')
      .set('Authorization', `Bearer ${firstLogin.body.accessToken}`)
      .expect(200)
      .expect([]);

    const firstDeviceA = await prisma.device.create({
      data: { guardianId: first.id, name: 'Zulu fixture', managedUser: null, isDemo: true },
    });
    createdDevices.push(firstDeviceA);
    const firstDeviceB = await prisma.device.create({
      data: { guardianId: first.id, name: 'Alpha fixture', managedUser: 'managed-fake', isDemo: true },
    });
    createdDevices.push(firstDeviceB);
    const secondDevice = await prisma.device.create({
      data: { guardianId: second.id, name: 'Other fixture', managedUser: null, isDemo: true },
    });
    createdDevices.push(secondDevice);

    const firstList = await http.get(`/devices?guardianId=${second.id}`)
      .set('Authorization', `Bearer ${firstLogin.body.accessToken}`)
      .expect(200);
    assert.deepEqual(firstList.body.map((entry) => entry.id), [firstDeviceB.id, firstDeviceA.id]);
    assert.deepEqual(firstList.body.map((entry) => entry.status), ['unverified', 'unverified']);
    assert.deepEqual(firstList.body.map((entry) => entry.lastSeen), [null, null]);
    assert.ok(firstList.body.every((entry) => entry.isDemo === true));
    assert.ok(firstList.body.every((entry) => !('guardianId' in entry)));

    const secondList = await http.get('/devices')
      .set('Authorization', `Bearer ${secondLogin.body.accessToken}`)
      .expect(200);
    assert.deepEqual(secondList.body.map((entry) => entry.id), [secondDevice.id]);
    assert.ok(!secondList.body.some((entry) => entry.id === firstDeviceA.id || entry.id === firstDeviceB.id));
  } finally {
    for (const device of createdDevices) {
      await prisma.device.delete({ where: { id: device.id } });
    }
    for (const guardian of createdGuardians) {
      await prisma.guardian.delete({ where: { id: guardian.id } });
    }
    await app.close();
  }
});

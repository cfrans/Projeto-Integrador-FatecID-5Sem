import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { argon2id, hash, verify } from 'argon2';
import request from 'supertest';
import { AppModule } from '../dist/src/app.module.js';
import { PrismaService } from '../dist/src/prisma/prisma.service.js';

test('authentication persists and protects HTTP resources with MySQL', async () => {
  assert.equal(process.env.NODE_ENV, 'test', 'Use NODE_ENV=test.');
  assert.match(process.env.MYSQL_DATABASE ?? '', /_test$/, 'Use a dedicated database ending in _test.');
  const app = await NestFactory.create(AppModule, { logger: false });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  await app.init();
  const prisma = app.get(PrismaService);
  const email = `${randomUUID()}@example.test`;
  const password = randomUUID();
  let guardian;

  try {
    guardian = await prisma.guardian.create({
      data: { email, name: 'MySQL integration fixture', passwordHash: await hash(password, { type: argon2id }) },
    });
    const persisted = await prisma.guardian.findUniqueOrThrow({ where: { id: guardian.id } });
    assert.notEqual(persisted.passwordHash, password);
    assert.match(persisted.passwordHash, /^\$argon2id\$/);
    assert.equal(await verify(persisted.passwordHash, password), true);

    const http = request(app.getHttpServer());
    await http.get('/auth/me').expect(401);
    await http.post('/auth/login').send({ email, password: 'incorrect' }).expect(401);
    await http.post('/auth/login').send({ email: `${randomUUID()}@example.test`, password }).expect(401);
    await http.post('/auth/login').send({ email: 'invalid', password }).expect(400);
    await http.post('/auth/login').send({ email, password, unexpected: true }).expect(400);
    const login = await http.post('/auth/login').send({ email: email.toUpperCase(), password }).expect(200);
    assert.equal(login.body.expiresIn, 1800);
    assert.deepEqual(login.body.guardian, { id: guardian.id, name: guardian.name, email });
    assert.equal('passwordHash' in login.body.guardian, false);
    const authorization = `Bearer ${login.body.accessToken}`;
    const me = await http.get('/auth/me').set('Authorization', authorization).expect(200);
    assert.deepEqual(me.body, login.body.guardian);
    await http.get('/auth/me').set('Authorization', `${authorization}tampered`).expect(401);
    const jwt = app.get(JwtService);
    const expired = await jwt.signAsync({ sub: guardian.id }, { expiresIn: -1 });
    await http.get('/auth/me').set('Authorization', `Bearer ${expired}`).expect(401);
    const wrongAudience = await jwt.signAsync({ sub: guardian.id }, { audience: 'different-client' });
    await http.get('/auth/me').set('Authorization', `Bearer ${wrongAudience}`).expect(401);
    const wrongIssuer = await jwt.signAsync({ sub: guardian.id }, { issuer: 'different-server' });
    await http.get('/auth/me').set('Authorization', `Bearer ${wrongIssuer}`).expect(401);
    await prisma.guardian.delete({ where: { id: guardian.id } });
    guardian = undefined;
    await http.get('/auth/me').set('Authorization', authorization).expect(401);
  } finally {
    if (guardian) await prisma.guardian.delete({ where: { id: guardian.id } });
    await app.close();
  }
});

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

    const registeredEmail = `${randomUUID()}@example.test`;
    const registered = await http
      .post('/auth/register')
      .send({ name: '  Maria Clara ', email: ` ${registeredEmail.toUpperCase()} `, password: 'initial-password-123' })
      .expect(201);
    assert.equal(registered.body.name, 'Maria Clara');
    assert.equal(registered.body.email, registeredEmail);
    await http
      .post('/auth/register')
      .send({ name: 'Outra', email: registeredEmail, password: 'initial-password-123' })
      .expect(409);

    const regLogin = await http
      .post('/auth/login')
      .send({ email: registeredEmail, password: 'initial-password-123' })
      .expect(200);
    const regAuth = `Bearer ${regLogin.body.accessToken}`;

    const updatedEmail = `${randomUUID()}@example.test`;
    await http.patch('/auth/me/email').set('Authorization', regAuth).send({ email: email }).expect(409);
    const emailResp = await http
      .patch('/auth/me/email')
      .set('Authorization', regAuth)
      .send({ email: ` ${updatedEmail.toUpperCase()} ` })
      .expect(200);
    assert.equal(emailResp.body.email, updatedEmail);

    await http
      .patch('/auth/me/password')
      .set('Authorization', regAuth)
      .send({ currentPassword: 'wrong-current', newPassword: 'updated-password-123' })
      .expect(400);
    await http
      .patch('/auth/me/password')
      .set('Authorization', regAuth)
      .send({ currentPassword: 'initial-password-123', newPassword: 'updated-password-123' })
      .expect(204);
    await http.post('/auth/login').send({ email: updatedEmail, password: 'initial-password-123' }).expect(401);
    await http.post('/auth/login').send({ email: updatedEmail, password: 'updated-password-123' }).expect(200);

    const decoy = await http.post('/auth/recovery/question').send({ email: updatedEmail }).expect(200);
    await http
      .post('/auth/recovery/question')
      .send({ email: `${randomUUID()}@example.test` })
      .expect(200);
    assert.equal(typeof decoy.body.question, 'string');
    await http.post('/auth/recovery/verify').send({ email: updatedEmail, answer: 'qualquer' }).expect(400);
    const sqGetInitial = await http.get('/auth/me/security-question').set('Authorization', regAuth).expect(200);
    assert.deepEqual(sqGetInitial.body, { question: null });

    await http
      .put('/auth/me/security-question')
      .set('Authorization', regAuth)
      .send({ question: 'Qual o nome do seu primeiro pet?', answer: '  Tobiás  ' })
      .expect(200)
      .expect({ question: 'Qual o nome do seu primeiro pet?' });

    await http
      .post('/auth/recovery/question')
      .send({ email: updatedEmail.toUpperCase() })
      .expect(200)
      .expect({ question: 'Qual o nome do seu primeiro pet?' });
    await http
      .post('/auth/recovery/verify')
      .send({ email: updatedEmail, answer: 'errada' })
      .expect(400);
    await http
      .post('/auth/recovery/verify')
      .send({ email: updatedEmail, answer: ' tobias ' })
      .expect(200)
      .expect({ valid: true });
    await http
      .post('/auth/recovery/reset')
      .send({ email: updatedEmail, answer: 'errada', newPassword: 'recovered-password-123' })
      .expect(400);
    await http
      .post('/auth/recovery/reset')
      .send({ email: updatedEmail, answer: 'TOBIÁS', newPassword: 'recovered-password-123' })
      .expect(204);
    await http.post('/auth/login').send({ email: updatedEmail, password: 'recovered-password-123' }).expect(200);
    await prisma.guardian.delete({ where: { id: registered.body.id } });

    await prisma.guardian.delete({ where: { id: guardian.id } });
    guardian = undefined;
    await http.get('/auth/me').set('Authorization', authorization).expect(401);
  } finally {
    if (guardian) await prisma.guardian.delete({ where: { id: guardian.id } });
    await app.close();
  }
});

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module.js';
import { PrismaService } from './../src/prisma/prisma.service.js';
import { ValidationPipe } from '@nestjs/common';
import * as argon2 from 'argon2';
import { JwtService } from '@nestjs/jwt';

describe('AppController (e2e)', () => {
  let app: INestApplication;
  const guardian = {
    id: 'ed224c82-df8b-47c2-ae99-45422d63da72',
    name: 'Responsável',
    email: 'guardian@example.com',
    passwordHash: '',
    tokenVersion: 0,
  };
  const guardianTwo = {
    id: '946ec23b-4fb8-4faa-94dd-471d67588c84',
    name: 'Outro responsável',
    email: 'guardian-two@example.com',
    passwordHash: '',
    tokenVersion: 0,
  };
  const devices = [
    {
      id: '0a38ce2d-9654-41f1-8098-944e0874752c',
      guardianId: guardian.id,
      name: 'Notebook principal',
      managedUser: 'usuario-ficticio',
      isDemo: true,
    },
    {
      id: 'c421635b-caa6-48b8-8b10-08c2144e0993',
      guardianId: guardianTwo.id,
      name: 'Outro computador',
      managedUser: null,
      isDemo: true,
    },
  ];
  const prisma = {
    $connect: vi.fn(),
    $disconnect: vi.fn(),
    $queryRaw: vi.fn((query: TemplateStringsArray, guardianId?: string) => {
      if (!query.join('').includes('vw_device_overview')) return Promise.resolve([{ 1: 1 }]);
      return Promise.resolve(devices.filter((entry) => entry.guardianId === guardianId)
        .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id))
        .map(({ guardianId: _guardianId, ...device }) => ({ ...device, associationId: null, lastSeenAt: null })));
    }),
    guardian: {
      create: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(({ where, select }: {
        where: { id?: string; email?: string };
        select?: Record<string, boolean>;
      }) => {
        const match = [guardian, guardianTwo].find((entry) => where.id === entry.id || where.email === entry.email);
        if (match) {
          const selected = select ? Object.keys(select) : Object.keys(match);
          return Promise.resolve(Object.fromEntries(selected.map((key) => [key, match[key as keyof typeof match]])));
        }
        return Promise.resolve(null);
      }),
    },
    device: {
      findFirst: vi.fn(),

    },
  };

  beforeEach(async () => {
    guardian.passwordHash = await argon2.hash('correct-horse-battery', { type: argon2.argon2id });
    guardianTwo.passwordHash = guardian.passwordHash;
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }));
    await app.init();
  });

  it('/health (GET)', () => {
    return request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect({ status: 'ok', database: 'ok' });
  });

  it('logs in and restores the public guardian session through /auth/me', async () => {
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: ' GUARDIAN@EXAMPLE.COM ', password: 'correct-horse-battery' })
      .expect(200);

    expect(login.body).toEqual({
      accessToken: expect.any(String),
      expiresIn: 1800,
      guardian: { id: guardian.id, name: guardian.name, email: guardian.email },
    });
    expect(login.body.guardian).not.toHaveProperty('passwordHash');

    await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .expect(200)
      .expect({ id: guardian.id, name: guardian.name, email: guardian.email });
  });

  it('rejects invalid bodies and incorrect credentials with stable status codes', async () => {
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'not-an-email', password: '' })
      .expect(400);
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: guardian.email, password: 'wrong-password' })
      .expect(401);
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: guardian.email, password: 'correct-horse-battery', role: 'admin' })
      .expect(400);
  });

  it('limits attempts on public authentication routes per address', async () => {
    const http = request(app.getHttpServer());
    for (let attempt = 0; attempt < 20; attempt += 1) {
      await http.post('/auth/login').send({ email: 'not-an-email', password: '' }).expect(400);
    }
    await http.post('/auth/login').send({ email: guardian.email, password: 'correct-horse-battery' }).expect(429);

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await http.post('/auth/recovery/reset').send({}).expect(400);
    }
    await http.post('/auth/recovery/reset').send({}).expect(429);
    await http.post('/auth/recovery/verify').send({}).expect(400);
  });

  it('registers, updates account credentials and recovers password through HTTP routes', async () => {
    const http = request(app.getHttpServer());

    prisma.guardian.create.mockResolvedValueOnce({
      id: '33333333-3333-4333-8333-333333333333',
      name: 'Novo Responsável',
      email: 'novo@example.com',
    });

    await http
      .post('/auth/register')
      .send({ name: '  Novo Responsável ', email: ' NOVO@EXAMPLE.COM ', password: 'valid-password' })
      .expect(201)
      .expect({
        id: '33333333-3333-4333-8333-333333333333',
        name: 'Novo Responsável',
        email: 'novo@example.com',
      });

    await http
      .post('/auth/register')
      .send({ name: '', email: 'invalid', password: 'short' })
      .expect(400);

    prisma.guardian.create.mockRejectedValueOnce({ code: 'P2002' });
    await http
      .post('/auth/register')
      .send({ name: 'Duplicado', email: guardian.email, password: 'valid-password' })
      .expect(409);

    const login = await http
      .post('/auth/login')
      .send({ email: guardian.email, password: 'correct-horse-battery' })
      .expect(200);
    const token = login.body.accessToken as string;

    prisma.guardian.update.mockResolvedValueOnce({
      id: guardian.id,
      name: guardian.name,
      email: 'updated@example.com',
    });
    await http
      .patch('/auth/me/email')
      .set('Authorization', `Bearer ${token}`)
      .send({ email: ' UPDATED@EXAMPLE.COM ' })
      .expect(200)
      .expect({ id: guardian.id, name: guardian.name, email: 'updated@example.com' });

    await http
      .patch('/auth/me/password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'wrong-password', newPassword: 'new-password-123' })
      .expect(400);

    prisma.guardian.update.mockResolvedValueOnce({ id: guardian.id });
    await http
      .patch('/auth/me/password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'correct-horse-battery', newPassword: 'new-password-123' })
      .expect(204);

    prisma.guardian.update.mockResolvedValueOnce({ id: guardian.id });
    await http
      .put('/auth/me/security-question')
      .set('Authorization', `Bearer ${token}`)
      .send({ question: 'Qual o nome do seu primeiro pet?', answer: 'Tobias' })
      .expect(200)
      .expect({ question: 'Qual o nome do seu primeiro pet?' });
  });

  it('rejects missing, tampered, expired, stale-version, and deleted-guardian tokens', async () => {
    await request(app.getHttpServer()).get('/auth/me').expect(401);
    await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', 'Bearer invalid.token.value')
      .expect(401);

    const jwt = app.get(JwtService);
    const expired = await jwt.signAsync({ sub: guardian.id, ver: 0 }, { expiresIn: -1 });
    await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${expired}`)
      .expect(401);

    for (const payload of [{ sub: guardian.id }, { sub: guardian.id, ver: 1 }]) {
      const stale = await jwt.signAsync(payload);
      await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${stale}`)
        .expect(401);
    }

    prisma.guardian.findUnique.mockResolvedValueOnce(null);
    const valid = await jwt.signAsync({ sub: guardian.id, ver: 0 });
    await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${valid}`)
      .expect(401);
  });

  it('requires authentication and scopes device records to the authenticated guardian', async () => {
    const http = request(app.getHttpServer());
    await http.get('/devices').expect(401);

    const primaryLogin = await http.post('/auth/login')
      .send({ email: guardian.email, password: 'correct-horse-battery' }).expect(200);
    const otherLogin = await http.post('/auth/login')
      .send({ email: guardianTwo.email, password: 'correct-horse-battery' }).expect(200);

    prisma.$queryRaw.mockResolvedValueOnce([]);
    await http.get('/devices')
      .set('Authorization', `Bearer ${primaryLogin.body.accessToken}`)
      .expect(200)
      .expect([]);

    const primary = await http.get(`/devices?guardianId=${guardianTwo.id}`)
      .set('Authorization', `Bearer ${primaryLogin.body.accessToken}`)
      .expect(200);
    expect(primary.body).toEqual([{
      id: devices[0].id,
      name: devices[0].name,
      managedUser: devices[0].managedUser,
      isDemo: true,
      status: 'unverified',
      lastSeen: null,
      paired: false,
    }]);
    expect(prisma.$queryRaw).toHaveBeenLastCalledWith(expect.any(Array), guardian.id);

    const other = await http.get('/devices')
      .set('Authorization', `Bearer ${otherLogin.body.accessToken}`)
      .expect(200);
    expect(other.body).toHaveLength(1);
    expect(other.body[0].id).toBe(devices[1].id);
    expect(other.body[0].id).not.toBe(devices[0].id);
  });

  it('authenticates and validates restriction and history query routes', async () => {
    const http = request(app.getHttpServer());
    const jwt = app.get(JwtService);
    const token = await jwt.signAsync({ sub: guardian.id, ver: 0 });
    for (const endpoint of ['applications', 'installation-requests', 'installation-requests/history']) {
      await http.get(`/devices/${devices[0].id}/${endpoint}`).expect(401);
      await http.get(`/devices/not-a-uuid/${endpoint}`).set('Authorization', `Bearer ${token}`).expect(400);
      prisma.device.findFirst.mockResolvedValueOnce(null);
      await http.get(`/devices/${devices[1].id}/${endpoint}`).set('Authorization', `Bearer ${token}`).expect(404);
      prisma.device.findFirst.mockResolvedValueOnce({ applicationsReportedAt: null, installationRequestsReportedAt: null });
      await http.get(`/devices/${devices[0].id}/${endpoint}`).set('Authorization', `Bearer ${token}`).expect(503);
      prisma.device.findFirst.mockResolvedValueOnce({ applicationsReportedAt: new Date(), installationRequestsReportedAt: new Date(), applications: [], installationRequests: [] });
      await http.get(`/devices/${devices[0].id}/${endpoint}`).set('Authorization', `Bearer ${token}`).expect(200).expect([]);
    }
  });

  afterEach(async () => {
    await app.close();
  });
});

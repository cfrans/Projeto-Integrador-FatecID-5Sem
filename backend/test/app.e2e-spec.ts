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
  };
  const guardianTwo = {
    id: '946ec23b-4fb8-4faa-94dd-471d67588c84',
    name: 'Outro responsável',
    email: 'guardian-two@example.com',
    passwordHash: '',
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
    $queryRaw: vi.fn().mockResolvedValue([{ 1: 1 }]),
    guardian: {
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
      findMany: vi.fn(({ where, select }: {
        where: { guardianId: string };
        select: Record<string, boolean>;
        orderBy: Array<Record<string, 'asc' | 'desc'>>;
      }) => Promise.resolve(devices
        .filter((entry) => entry.guardianId === where.guardianId)
        .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id))
        .map((entry) => Object.fromEntries(Object.keys(select).map((key) => [
          key,
          key === 'associations' ? [] : entry[key as keyof typeof entry],
        ])))),
      ),
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

  it('rejects missing, tampered, expired, and deleted-guardian tokens', async () => {
    await request(app.getHttpServer()).get('/auth/me').expect(401);
    await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', 'Bearer invalid.token.value')
      .expect(401);

    const jwt = app.get(JwtService);
    const expired = await jwt.signAsync({ sub: guardian.id }, { expiresIn: -1 });
    await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${expired}`)
      .expect(401);

    prisma.guardian.findUnique.mockResolvedValueOnce(null);
    const valid = await jwt.signAsync({ sub: guardian.id });
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

    prisma.device.findMany.mockResolvedValueOnce([]);
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
    expect(prisma.device.findMany).toHaveBeenLastCalledWith({
      where: { guardianId: guardian.id },
      select: {
        id: true,
        name: true,
        managedUser: true,
        isDemo: true,
        associations: {
          where: { guardianId: guardian.id, activeDeviceId: { not: null }, revokedAt: null },
          select: { id: true },
          take: 1,
        },
      },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });

    const other = await http.get('/devices')
      .set('Authorization', `Bearer ${otherLogin.body.accessToken}`)
      .expect(200);
    expect(other.body).toHaveLength(1);
    expect(other.body[0].id).toBe(devices[1].id);
    expect(other.body[0].id).not.toBe(devices[0].id);
  });

  afterEach(async () => {
    await app.close();
  });
});

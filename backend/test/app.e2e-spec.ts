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
  const prisma = {
    $connect: vi.fn(),
    $disconnect: vi.fn(),
    $queryRaw: vi.fn().mockResolvedValue([{ 1: 1 }]),
    guardian: {
      findUnique: vi.fn(({ where, select }: {
        where: { id?: string; email?: string };
        select?: Record<string, boolean>;
      }) => {
        if (where.id === guardian.id || where.email === guardian.email) {
          const selected = select ? Object.keys(select) : Object.keys(guardian);
          return Promise.resolve(Object.fromEntries(selected.map((key) => [key, guardian[key as keyof typeof guardian]])));
        }
        return Promise.resolve(null);
      }),
    },
  };

  beforeEach(async () => {
    guardian.passwordHash = await argon2.hash('correct-horse-battery', { type: argon2.argon2id });
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

  afterEach(async () => {
    await app.close();
  });
});

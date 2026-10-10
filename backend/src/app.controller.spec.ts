import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller.js';
import { PrismaService } from './prisma/prisma.service.js';

describe('AppController', () => {
  let appController: AppController;
  const prisma = { $queryRaw: vi.fn() };

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [{ provide: PrismaService, useValue: prisma }],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  it('reports the API and database as healthy', async () => {
    prisma.$queryRaw.mockResolvedValue([{ health: 1 }]);

    await expect(appController.getHealth()).resolves.toEqual({
      status: 'ok',
      database: 'ok',
    });
  });

  it('fails with 503 when the database query fails', async () => {
    prisma.$queryRaw.mockRejectedValue(new Error('database unavailable'));

    await expect(appController.getHealth()).rejects.toMatchObject({
      status: 503,
      response: { status: 'error', database: 'unavailable' },
    });
  });
});

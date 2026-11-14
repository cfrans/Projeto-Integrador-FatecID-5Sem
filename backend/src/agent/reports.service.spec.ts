import { UnprocessableEntityException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AgentReportDto } from './dto/report.dto.js';
import { ReportsService } from './reports.service.js';

const report = (overrides: Partial<AgentReportDto> = {}) => ({
  protocolVersion: 1,
  reportId: '3c8d8a4c-9a07-4c64-98c8-8ea70f1b1b8c',
  collectedAt: '2026-11-04T20:00:00.000Z',
  applications: [
    { sourceId: 'desktop:firefox.desktop', name: 'Firefox', category: 'network', allowed: true },
  ],
  installationRequests: [],
  ...overrides,
});

async function errors(value: unknown) {
  return validate(plainToInstance(AgentReportDto, value));
}

describe('AgentReportDto', () => {
  it('measures text by code points like the Agent and MySQL', async () => {
    const name = 'a'.repeat(199) + '❤️';
    expect(await errors(report({ applications: [
      { sourceId: 'desktop:a.desktop', name, category: 'x', allowed: true },
    ] }))).not.toHaveLength(0);
    expect(await errors(report({ applications: [
      { sourceId: 'desktop:a.desktop', name: '😀'.repeat(200), category: 'x', allowed: true },
    ] }))).toHaveLength(0);
  });

  it('rejects empty required text', async () => {
    expect(await errors(report({ applications: [
      { sourceId: 'desktop:a.desktop', name: '', category: 'x', allowed: true },
    ] }))).not.toHaveLength(0);
  });
});

describe('ReportsService', () => {
  const prisma = { $transaction: vi.fn() };
  const service = new ReportsService(prisma as never);
  const agent = { id: 'identity-id', deviceId: 'device-id' } as never;

  beforeEach(() => prisma.$transaction.mockReset());

  it('rejects duplicate sourceId with 422 before touching the database', async () => {
    const application = report().applications[0];
    await expect(
      service.ingest(agent, report({ applications: [application, application] }) as never),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});

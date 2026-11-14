import { UnprocessableEntityException } from '@nestjs/common';
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

import { DevicesService } from './devices.service.js';

describe('DevicesService', () => {
  const prisma = { $queryRaw: vi.fn(), device: { findFirst: vi.fn() } };
  const pairingService = { revokeGuardianAssociation: vi.fn() };
  const service = new DevicesService(prisma as never, pairingService as never);

  beforeEach(() => {
    prisma.$queryRaw.mockReset();
    prisma.device.findFirst.mockReset();
  });

  it('queries only the owner and returns the deterministic public representation', async () => {
    prisma.$queryRaw.mockResolvedValue([
      {
        id: 'device-id',
        name: 'Notebook',
        managedUser: null,
        isDemo: true,
        associationId: null,
        lastSeenAt: null,
      },
    ]);

    await expect(service.listForGuardian('guardian-id')).resolves.toEqual([
      {
        id: 'device-id',
        name: 'Notebook',
        managedUser: null,
        isDemo: true,
        status: 'unverified',
        lastSeen: null,
        paired: false,
      },
    ]);
    const [query, guardianId] = prisma.$queryRaw.mock.calls[0];
    expect(query.join('?')).toContain('FROM vw_device_overview WHERE guardianId = ?');
    expect(query.join('?')).toContain('ORDER BY name ASC, id ASC');
    expect(guardianId).toBe('guardian-id');
  });

  it('uses the Agent TTL for real computers and the simulated TTL for demo ones', async () => {
    const lastSeenAt = new Date(Date.now() - 30000);
    prisma.$queryRaw.mockResolvedValue([
      { id: 'real', name: 'A', managedUser: 'kid', isDemo: 0, associationId: 'link', lastSeenAt },
      { id: 'demo', name: 'B', managedUser: null, isDemo: 1, associationId: 'demo-link', lastSeenAt },
      { id: 'stale', name: 'C', managedUser: null, isDemo: 0, associationId: 'old', lastSeenAt: new Date(Date.now() - 61000) },
      { id: 'never', name: 'D', managedUser: null, isDemo: 0, associationId: 'new', lastSeenAt: null },
    ]);

    const devices = await service.listForGuardian('guardian-id');

    expect(devices.map(({ id, status }) => [id, status])).toEqual([
      ['real', 'online'],
      ['demo', 'offline'],
      ['stale', 'offline'],
      ['never', 'unverified'],
    ]);
    expect(devices[0].lastSeen).toBe(lastSeenAt.toISOString());
  });

  it('maps database errors to service unavailable', async () => {
    prisma.$queryRaw.mockRejectedValue(new Error('database unavailable'));

    await expect(service.listForGuardian('guardian-id')).rejects.toMatchObject({
      status: 503,
      response: { message: 'Serviço de dispositivos indisponível.' },
    });
  });

  it('returns decided requests only from the current active link and keeps its authorization filter', async () => {
    const createdAt = new Date('2026-11-02T12:00:00.000Z');
    prisma.device.findFirst.mockResolvedValue({
      installationRequestsReportedAt: new Date(),
      associations: [{ createdAt }],
      installationRequests: [
        { id: 'old-request', status: 'APPROVED', requestedAt: new Date('2026-11-01T12:00:00.000Z') },
        { id: 'approved', status: 'APPROVED', requestedAt: createdAt },
        { id: 'denied', status: 'DENIED', requestedAt: new Date('2026-11-02T13:00:00.000Z') },
      ],
    });
    const result = await service.listInstallationRequests('guardian-id', 'device-id', true);
    expect(result.map((request) => request.id)).toEqual(['approved', 'denied']);
    expect(result[0].requestedAt).toBe(createdAt.toISOString());
    expect(prisma.device.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'device-id', guardianId: 'guardian-id', associations: { some: { guardianId: 'guardian-id', activeDeviceId: 'device-id', revokedAt: null } } },
      select: expect.objectContaining({ installationRequests: expect.objectContaining({ where: { status: { in: ['APPROVED', 'DENIED'] } } }) }),
    }));
  });

  it('distinguishes unavailable history from a confirmed empty report and rejects unauthorized devices', async () => {
    prisma.device.findFirst.mockResolvedValue(null);
    await expect(service.listInstallationRequests('guardian', 'device', true)).rejects.toMatchObject({ status: 404 });
    prisma.device.findFirst.mockResolvedValue({ installationRequestsReportedAt: null });
    await expect(service.listInstallationRequests('guardian', 'device', true)).rejects.toMatchObject({ status: 503 });
    prisma.device.findFirst.mockResolvedValue({ installationRequestsReportedAt: new Date(), associations: [{ createdAt: new Date() }], installationRequests: [] });
    await expect(service.listInstallationRequests('guardian', 'device', true)).resolves.toEqual([]);
    prisma.device.findFirst.mockRejectedValue(new Error('Database unavailable'));
    await expect(service.listInstallationRequests('guardian', 'device', true)).rejects.toMatchObject({ status: 503 });
  });
});

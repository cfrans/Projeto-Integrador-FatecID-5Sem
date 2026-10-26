import { DevicesService } from './devices.service.js';

describe('Device restriction queries', () => {
  const prisma = { device: { findFirst: vi.fn() } };
  const service = new DevicesService(prisma as never, {} as never);
  const reportedAt = new Date('2026-10-20T12:00:00.000Z');

  beforeEach(() => vi.resetAllMocks());

  it('returns only the public application fields selected from the paired device', async () => {
    const applications = [
      { id: 'app', name: 'Firefox', category: 'Browser', allowed: true },
    ];
    prisma.device.findFirst.mockResolvedValue({
      applicationsReportedAt: reportedAt,
      applications,
    });
    await expect(
      service.listApplications('guardian', 'device'),
    ).resolves.toEqual(applications);
    expect(prisma.device.findFirst.mock.calls[0][0].where).toEqual({
      id: 'device',
      guardianId: 'guardian',
      associations: {
        some: {
          guardianId: 'guardian',
          activeDeviceId: 'device',
          revokedAt: null,
        },
      },
    });
  });

  it('returns pending requests with ISO dates and deterministic ordering', async () => {
    prisma.device.findFirst.mockResolvedValue({
      installationRequestsReportedAt: reportedAt,
      installationRequests: [
        {
          id: 'request',
          applicationName: 'Firefox',
          requesterName: 'Child',
          requestedAt: reportedAt,
          ageRating: 'L',
        },
      ],
    });
    await expect(
      service.listInstallationRequests('guardian', 'device'),
    ).resolves.toEqual([
      {
        id: 'request',
        applicationName: 'Firefox',
        requesterName: 'Child',
        requestedAt: '2026-10-20T12:00:00.000Z',
        ageRating: 'L',
      },
    ]);
    expect(
      prisma.device.findFirst.mock.calls[0][0].select.installationRequests,
    ).toMatchObject({
      where: { status: 'PENDING' },
      orderBy: [{ requestedAt: 'asc' }, { id: 'asc' }],
    });
  });

  for (const method of [
    'listApplications',
    'listInstallationRequests',
  ] as const) {
    it(`${method}: hides absent or unauthorized computers`, async () => {
      prisma.device.findFirst.mockResolvedValue(null);
      await expect(service[method]('guardian', 'device')).rejects.toMatchObject(
        { status: 404 },
      );
    });

    it(`${method}: distinguishes missing reports from a confirmed empty list`, async () => {
      prisma.device.findFirst.mockResolvedValue({
        applicationsReportedAt: null,
        installationRequestsReportedAt: null,
      });
      await expect(service[method]('guardian', 'device')).rejects.toMatchObject(
        { status: 503 },
      );
      prisma.device.findFirst.mockResolvedValue({
        applicationsReportedAt: reportedAt,
        installationRequestsReportedAt: reportedAt,
        applications: [],
        installationRequests: [],
      });
      await expect(service[method]('guardian', 'device')).resolves.toEqual([]);
    });

    it(`${method}: hides database failures without returning an empty list`, async () => {
      prisma.device.findFirst.mockRejectedValue(
        new Error('private database details'),
      );
      await expect(service[method]('guardian', 'device')).rejects.toMatchObject(
        { status: 503 },
      );
    });
  }
});

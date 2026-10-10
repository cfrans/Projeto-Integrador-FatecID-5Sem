import { DevicesService } from './devices.service.js';

describe('DevicesService', () => {
  const prisma = { device: { findMany: vi.fn() } };
  const service = new DevicesService(prisma as never);

  beforeEach(() => {
    prisma.device.findMany.mockReset();
  });

  it('queries only the owner and returns the deterministic public representation', async () => {
    prisma.device.findMany.mockResolvedValue([
      { id: 'device-id', name: 'Notebook', managedUser: null, isDemo: true },
    ]);

    await expect(service.listForGuardian('guardian-id')).resolves.toEqual([
      {
        id: 'device-id',
        name: 'Notebook',
        managedUser: null,
        isDemo: true,
        status: 'unverified',
        lastSeen: null,
      },
    ]);
    expect(prisma.device.findMany).toHaveBeenCalledWith({
      where: { guardianId: 'guardian-id' },
      select: { id: true, name: true, managedUser: true, isDemo: true },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });
  });

  it('maps database errors to service unavailable', async () => {
    prisma.device.findMany.mockRejectedValue(new Error('database unavailable'));

    await expect(service.listForGuardian('guardian-id')).rejects.toMatchObject({
      status: 503,
      response: { message: 'Serviço de dispositivos indisponível.' },
    });
  });
});

import { createHash } from 'node:crypto';
import {
  defaults,
  mergeSettings,
  report,
  settingsPatch,
} from './simulation.contract.js';
import { SimulationService } from './simulation.service.js';

describe('Simulated computer synchronization', () => {
  const deviceId = '0a38ce2d-9654-41f1-8098-944e0874752c';
  const associationId = '946ec23b-4fb8-4faa-94dd-471d67588c84';
  const tx = {
    $queryRaw: vi.fn(),
    device: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    deviceAssociation: { findFirst: vi.fn(), deleteMany: vi.fn() },
    agentCommand: { deleteMany: vi.fn() },
    simulationState: { upsert: vi.fn(), update: vi.fn() },
    installedApplication: {
      count: vi.fn(),
      findMany: vi.fn(),
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
    installationRequest: {
      count: vi.fn(),
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
  };
  const prisma = {
    $transaction: vi.fn(async (operation: (client: typeof tx) => unknown) =>
      operation(tx),
    ),
  };
  const service = new SimulationService(prisma as never);
  const state = () => ({
    associationId,
    settings: defaults(),
    revision: 1,
    appliedRevision: null,
    appliedAt: null,
    lastSeenAt: null,
  });
  const payload = () => ({
    associationId,
    revision: 1,
    applications: [{ id: deviceId, name: 'Firefox', category: 'Navegador' }],
    installationRequests: [
      {
        id: associationId,
        applicationName: 'GIMP',
        requesterName: 'Ana',
        requestedAt: '2026-10-25T12:00:00.000Z',
        ageRating: '12',
      },
    ],
  });

  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'test');
    vi.clearAllMocks();
    tx.device.findFirst.mockResolvedValue({ id: deviceId });
    tx.deviceAssociation.findFirst.mockResolvedValue({ id: associationId });
    tx.simulationState.upsert.mockResolvedValue(state());
    tx.simulationState.update.mockResolvedValue(state());
    tx.device.create.mockResolvedValue({ id: deviceId, isDemo: true });
    tx.installedApplication.count.mockResolvedValue(1);
    tx.installedApplication.findMany.mockResolvedValue([]);
    tx.installationRequest.count.mockResolvedValue(1);
  });

  afterEach(() => vi.unstubAllEnvs());

  it('creates only an unpaired demo identity, with a hash rather than its secret in storage', async () => {
    const result = await service.register({
      name: ' PC sala ',
      managedUser: 'Ana',
    });
    expect(result.credential).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(tx.device.create.mock.calls[0][0].data).toEqual({
      name: 'PC sala',
      managedUser: 'Ana',
      isDemo: true,
      agentIdentity: {
        create: {
          credentialHash: createHash('sha256')
            .update(result.credential)
            .digest('hex'),
        },
      },
    });
  });

  it.each(['production', ''])(
    'disables every operation in environment %s',
    async (environment) => {
      vi.stubEnv('NODE_ENV', environment);
      await expect(service.register({ name: 'PC' })).rejects.toMatchObject({
        status: 404,
      });
      await expect(service.read(deviceId, 'guardian')).rejects.toMatchObject({
        status: 404,
      });
      await expect(
        service.update(deviceId, 'guardian', {}),
      ).rejects.toMatchObject({ status: 404 });
      await expect(service.acknowledge(deviceId, {})).rejects.toMatchObject({
        status: 404,
      });
      await expect(service.heartbeat(deviceId, {})).rejects.toMatchObject({
        status: 404,
      });
      await expect(
        service.reset(deviceId, associationId),
      ).rejects.toMatchObject({ status: 404 });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    },
  );

  it('deletes only the authenticated demo PC and its dependent records in one transaction', async () => {
    await expect(service.reset(deviceId, associationId)).resolves.toEqual({
      deletedDeviceId: deviceId,
    });
    expect(tx.device.findFirst).toHaveBeenCalledWith({
      where: {
        id: deviceId,
        isDemo: true,
        agentIdentity: { id: associationId, revokedAt: null },
      },
      select: { id: true },
    });
    expect(tx.$queryRaw).toHaveBeenCalled();
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.agentCommand.deleteMany).toHaveBeenCalledWith({
      where: { deviceId },
    });
    expect(tx.deviceAssociation.deleteMany).toHaveBeenCalledWith({
      where: { deviceId },
    });
    expect(tx.device.delete).toHaveBeenCalledWith({ where: { id: deviceId } });
    expect(tx.agentCommand.deleteMany.mock.invocationCallOrder[0]).toBeLessThan(
      tx.deviceAssociation.deleteMany.mock.invocationCallOrder[0],
    );
    expect(
      tx.deviceAssociation.deleteMany.mock.invocationCallOrder[0],
    ).toBeLessThan(tx.device.delete.mock.invocationCallOrder[0]);
  });

  it('does not delete a missing, real or revoked computer', async () => {
    tx.device.findFirst.mockResolvedValueOnce(null);
    await expect(service.reset(deviceId, associationId)).rejects.toMatchObject({
      status: 404,
    });
    expect(tx.agentCommand.deleteMany).not.toHaveBeenCalled();
    expect(tx.device.delete).not.toHaveBeenCalled();
  });

  it('reports a failed reset without confirming deletion', async () => {
    tx.agentCommand.deleteMany.mockRejectedValueOnce(
      new Error('database unavailable'),
    );
    await expect(service.reset(deviceId, associationId)).rejects.toMatchObject({
      status: 503,
    });
    expect(tx.device.delete).not.toHaveBeenCalled();
  });

  it('scopes each read to the active association and demo identity after locking the device', async () => {
    await service.read(deviceId, 'guardian');
    expect(tx.$queryRaw).toHaveBeenCalled();
    expect(tx.device.findFirst.mock.calls[0][0].where).toEqual({
      id: deviceId,
      isDemo: true,
      agentIdentity: { revokedAt: null },
    });
    expect(tx.deviceAssociation.findFirst.mock.calls[0][0].where).toEqual({
      deviceId,
      activeDeviceId: deviceId,
      revokedAt: null,
      guardianId: 'guardian',
    });
    expect(tx.simulationState.upsert.mock.calls[0][0].where).toEqual({
      associationId,
    });
  });

  it('rejects missing devices, real computers and revoked or foreign associations', async () => {
    tx.device.findFirst.mockResolvedValueOnce(null);
    await expect(service.read(deviceId)).rejects.toMatchObject({ status: 404 });
    tx.deviceAssociation.findFirst.mockResolvedValueOnce(null);
    await expect(service.read(deviceId, 'other')).rejects.toMatchObject({
      status: 404,
    });
    expect(tx.simulationState.upsert).not.toHaveBeenCalled();
  });

  it('persists desired settings without marking them applied, preserving unrelated rules', async () => {
    await service.update(deviceId, 'guardian', {
      revision: 1,
      settings: { allowedBrowsers: { brave: true }, ageRating: '16' },
    });
    expect(tx.simulationState.update.mock.calls[0][0].data).toEqual({
      revision: { increment: 1 },
      settings: {
        ...defaults(),
        ageRating: '16',
        allowedBrowsers: { ...defaults().allowedBrowsers, brave: true },
      },
    });
  });

  it('rejects concurrent edits and stale acknowledgements without replacing reports', async () => {
    await expect(
      service.update(deviceId, 'guardian', {
        revision: 2,
        settings: { ageRating: '16' },
      }),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      service.acknowledge(deviceId, { ...payload(), revision: 2 }),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      service.acknowledge(deviceId, { ...payload(), associationId: deviceId }),
    ).rejects.toMatchObject({ status: 409 });
    expect(tx.installedApplication.deleteMany).not.toHaveBeenCalled();
    expect(tx.simulationState.update).not.toHaveBeenCalled();
  });

  it('revokes a confirmed approval and blocks its installed app without confirming application', async () => {
    tx.simulationState.upsert.mockResolvedValue({
      ...state(),
      settings: {
        ...defaults(),
        installationDecisions: { [associationId]: 'APPROVED' },
        applicationRules: { [associationId]: true, [deviceId]: true },
      },
    });
    tx.installedApplication.findMany.mockResolvedValue([{ id: associationId }]);
    await service.update(deviceId, 'guardian', {
      revision: 1,
      settings: { installationDecisions: { [associationId]: 'DENIED' } },
    });
    expect(tx.simulationState.update.mock.calls[0][0].data).toMatchObject({
      revision: { increment: 1 },
      settings: {
        installationDecisions: { [associationId]: 'DENIED' },
        applicationRules: { [associationId]: false, [deviceId]: true },
      },
    });
    expect(tx.simulationState.update.mock.calls[0][0].data).not.toHaveProperty(
      'appliedRevision',
    );
  });

  it('publishes inventory, decisions and acknowledgement atomically in one transaction', async () => {
    const settings = {
      ...defaults(),
      applicationRules: { [deviceId]: false },
      installationDecisions: { [associationId]: 'DENIED' as const },
    };
    tx.simulationState.upsert.mockResolvedValue({ ...state(), settings });
    await service.acknowledge(deviceId, payload());
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(
      tx.installedApplication.createMany.mock.calls[0][0].data[0],
    ).toMatchObject({ deviceId, allowed: false });
    expect(
      tx.installationRequest.createMany.mock.calls[0][0].data[0],
    ).toMatchObject({ deviceId, status: 'DENIED' });
    expect(tx.device.update.mock.calls[0][0].data).toEqual({
      applicationsReportedAt: expect.any(Date),
      installationRequestsReportedAt: expect.any(Date),
    });
    expect(tx.simulationState.update.mock.calls[0][0].data).toEqual({
      appliedRevision: 1,
      appliedAt: expect.any(Date),
      lastSeenAt: expect.any(Date),
    });
  });

  it('records contact without changing the desired or applied revision', async () => {
    await service.heartbeat(deviceId, { associationId });
    expect(tx.simulationState.update).toHaveBeenCalledWith({
      where: { associationId },
      data: { lastSeenAt: expect.any(Date) },
    });
    expect(tx.device.update).not.toHaveBeenCalled();
    expect(tx.installedApplication.deleteMany).not.toHaveBeenCalled();
  });

  it('rejects contact for a stale association and rejects invalid heartbeat bodies', async () => {
    await expect(
      service.heartbeat(deviceId, { associationId: deviceId }),
    ).rejects.toMatchObject({ status: 409 });
    for (const body of [
      {},
      { associationId: 'invalid' },
      { associationId, revision: 1 },
    ])
      await expect(service.heartbeat(deviceId, body)).rejects.toMatchObject({
        status: 400,
      });
    expect(tx.simulationState.update).not.toHaveBeenCalled();
  });

  it('rejects application rules and installation decisions for unreported resources', async () => {
    tx.installedApplication.count.mockResolvedValueOnce(0);
    await expect(
      service.update(deviceId, 'guardian', {
        revision: 1,
        settings: { applicationRules: { [deviceId]: false } },
      }),
    ).rejects.toMatchObject({ status: 400 });
    tx.installationRequest.count.mockResolvedValueOnce(0);
    await expect(
      service.update(deviceId, 'guardian', {
        revision: 1,
        settings: { installationDecisions: { [associationId]: 'APPROVED' } },
      }),
    ).rejects.toMatchObject({ status: 400 });
    expect(tx.simulationState.update).not.toHaveBeenCalled();
  });

  it('does not expose database failures or report success after a failed transaction', async () => {
    tx.simulationState.update.mockRejectedValueOnce(
      new Error('private database secret'),
    );
    await expect(
      service.acknowledge(deviceId, payload()),
    ).rejects.toMatchObject({
      status: 503,
      message: 'Simulação indisponível. Tente novamente.',
    });
  });

  it('validates strict keys, maps, bounded reports and timestamps at the boundary', () => {
    for (const value of [
      null,
      {},
      { ageRating: '99' },
      { blockBrowsers: 'true' },
      { shell: 'whoami' },
      { allowedBrowsers: { arbitrary: true } },
      { applicationRules: { invalid: false } },
      { installationDecisions: { [deviceId]: 'PENDING' } },
    ])
      expect(() => settingsPatch(value)).toThrow();
    for (const value of [
      { ...payload(), revision: -1 },
      {
        ...payload(),
        installationRequests: [
          { ...payload().installationRequests[0], requestedAt: 'yesterday' },
        ],
      },
      {
        ...payload(),
        applications: [payload().applications[0], payload().applications[0]],
      },
    ])
      expect(() => report(value)).toThrow();
    expect(
      mergeSettings(defaults(), { blockBrowsers: false }).allowedBrowsers,
    ).toEqual(defaults().allowedBrowsers);
  });
});

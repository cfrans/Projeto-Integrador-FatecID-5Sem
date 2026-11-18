import { AgentAuthGuard } from './agent-auth.guard.js';

describe('AgentAuthGuard presence', () => {
  const prisma = {
    agentIdentity: { findUnique: vi.fn(), updateMany: vi.fn() },
  };
  const guard = new AgentAuthGuard(prisma as never);
  const credential = 'a'.repeat(43);
  const context = () => {
    const request = {
      header: () => `Bearer ${credential}`,
    } as unknown as Record<string, unknown>;
    return {
      request,
      context: { switchToHttp: () => ({ getRequest: () => request }) } as never,
    };
  };
  const identity = (isDemo: boolean, lastSeenAt: Date | null) => ({
    id: 'identity',
    deviceId: 'device',
    revokedAt: null,
    lastSeenAt,
    device: { isDemo },
  });

  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'production');
    prisma.agentIdentity.findUnique.mockReset();
    prisma.agentIdentity.updateMany.mockReset().mockResolvedValue({ count: 1 });
  });

  afterEach(() => vi.unstubAllEnvs());

  it('records contact of a real Agent that was never seen or is stale', async () => {
    for (const lastSeenAt of [null, new Date(Date.now() - 11000)]) {
      prisma.agentIdentity.findUnique.mockResolvedValueOnce(identity(false, lastSeenAt));
      const { request, context: ctx } = context();
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
      expect(request.agent).toEqual({ id: 'identity', deviceId: 'device' });
    }
    expect(prisma.agentIdentity.updateMany).toHaveBeenCalledTimes(2);
    expect(prisma.agentIdentity.updateMany).toHaveBeenCalledWith({
      where: { id: 'identity', revokedAt: null },
      data: { lastSeenAt: expect.any(Date) },
    });
  });

  it('throttles writes and ignores simulated Agents', async () => {
    prisma.agentIdentity.findUnique.mockResolvedValueOnce(
      identity(false, new Date(Date.now() - 2000)),
    );
    await guard.canActivate(context().context);
    vi.stubEnv('NODE_ENV', 'development');
    prisma.agentIdentity.findUnique.mockResolvedValueOnce(identity(true, null));
    await guard.canActivate(context().context);
    expect(prisma.agentIdentity.updateMany).not.toHaveBeenCalled();
  });

  it('keeps authenticating when the presence write fails', async () => {
    prisma.agentIdentity.findUnique.mockResolvedValueOnce(identity(false, null));
    prisma.agentIdentity.updateMany.mockRejectedValueOnce(new Error('db down'));
    await expect(guard.canActivate(context().context)).resolves.toBe(true);
  });
});

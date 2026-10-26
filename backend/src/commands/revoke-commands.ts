import type { Prisma } from '../../generated/prisma/client.js';

export async function revokeCommands(
  tx: Prisma.TransactionClient,
  deviceId: string,
  associationId?: string,
) {
  const where = { deviceId, ...(associationId ? { associationId } : {}) };
  await tx.agentCommand.updateMany({
    where: { ...where, status: 'pending' },
    data: { status: 'cancelled' },
  });
  await tx.agentCommand.updateMany({
    where: { ...where, status: 'running' },
    data: { status: 'unknown' },
  });
}

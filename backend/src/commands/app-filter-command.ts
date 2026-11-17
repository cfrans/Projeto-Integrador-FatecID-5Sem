import { BadRequestException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { Prisma } from '../../generated/prisma/client.js';
import {
  COMMAND_TTL_MS,
  normalizeAppFilter,
  type AppFilter,
} from './command-types.js';

const SET = 'parental.app_filter.set';

export function revisionRequestId(associationId: string, revision: number) {
  const hex = createHash('sha256')
    .update(`${SET}:${associationId}:${revision}`)
    .digest('hex');
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    `5${hex.slice(13, 16)}`,
    `${((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16)}${hex.slice(17, 20)}`,
    hex.slice(20, 32),
  ].join('-');
}

export async function enqueueAppFilter(
  tx: Prisma.TransactionClient,
  input: {
    deviceId: string;
    associationId: string;
    revision: number;
    appFilter: AppFilter;
    now: Date;
  },
) {
  const appFilter = normalizeAppFilter(
    input.appFilter,
    () =>
      new BadRequestException(
        'Há aplicativo bloqueado com identificador incompatível com o computador.',
      ),
  ) as Prisma.InputJsonObject;
  await tx.parentalPolicy.upsert({
    where: { associationId: input.associationId },
    create: {
      associationId: input.associationId,
      appFilter,
      revision: input.revision,
    },
    update: { appFilter, revision: input.revision, lastErrorCode: null },
  });
  await tx.agentCommand.updateMany({
    where: {
      deviceId: input.deviceId,
      associationId: input.associationId,
      type: SET,
      status: 'pending',
    },
    data: { status: 'cancelled' },
  });
  return tx.agentCommand.create({
    data: {
      deviceId: input.deviceId,
      associationId: input.associationId,
      requestId: revisionRequestId(input.associationId, input.revision),
      type: SET,
      version: 1,
      parameters: appFilter,
      policyRevision: input.revision,
      expiresAt: new Date(input.now.getTime() + COMMAND_TTL_MS),
      createdAt: input.now,
    },
  });
}

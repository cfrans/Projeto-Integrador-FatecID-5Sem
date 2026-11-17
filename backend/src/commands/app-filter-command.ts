import { BadRequestException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { Prisma } from '../../generated/prisma/client.js';
import {
  COMMAND_TTL_MS,
  normalizeAppFilter,
  type AppFilter,
} from './command-types.js';

const SET = 'parental.app_filter.set';
export const MAX_SET_ATTEMPTS = 3;

export function revisionRequestId(
  associationId: string,
  revision: number,
  attempt = 0,
) {
  const hex = createHash('sha256')
    .update(
      `${SET}:${associationId}:${revision}${attempt ? `:${attempt}` : ''}`,
    )
    .digest('hex');
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    `5${hex.slice(13, 16)}`,
    `${((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16)}${hex.slice(17, 20)}`,
    hex.slice(20, 32),
  ].join('-');
}

function createSet(
  tx: Prisma.TransactionClient,
  input: {
    deviceId: string;
    associationId: string;
    revision: number;
    appFilter: Prisma.InputJsonObject;
    attempt: number;
    now: Date;
  },
) {
  return tx.agentCommand.create({
    data: {
      deviceId: input.deviceId,
      associationId: input.associationId,
      requestId: revisionRequestId(
        input.associationId,
        input.revision,
        input.attempt,
      ),
      type: SET,
      version: 1,
      parameters: input.appFilter,
      policyRevision: input.revision,
      expiresAt: new Date(input.now.getTime() + COMMAND_TTL_MS),
      createdAt: input.now,
    },
  });
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
    update: {
      appFilter,
      revision: input.revision,
      lastErrorCode: null,
      lastErrorAt: null,
    },
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
  return createSet(tx, { ...input, appFilter, attempt: 0 });
}

export async function reissueAppFilter(
  tx: Prisma.TransactionClient,
  input: { deviceId: string; associationId: string; now: Date },
) {
  const policy = await tx.parentalPolicy.findUnique({
    where: { associationId: input.associationId },
  });
  if (
    !policy ||
    policy.appliedRevision === policy.revision ||
    policy.lastErrorCode
  )
    return;
  const live = await tx.agentCommand.count({
    where: {
      deviceId: input.deviceId,
      associationId: input.associationId,
      type: SET,
      OR: [
        { status: 'pending', expiresAt: { gt: input.now } },
        { status: 'running', executionDeadlineAt: { gt: input.now } },
      ],
    },
  });
  if (live) return;
  const sets = await tx.agentCommand.findMany({
    where: {
      associationId: input.associationId,
      type: SET,
      policyRevision: policy.revision,
    },
    select: { status: true },
  });
  if (!sets.some(({ status }) => ['pending', 'running'].includes(status)))
    return;
  if (sets.length >= MAX_SET_ATTEMPTS) {
    await tx.parentalPolicy.update({
      where: { associationId: input.associationId },
      data: { lastErrorCode: 'EXECUTION_TIMEOUT', lastErrorAt: input.now },
    });
    return;
  }
  await createSet(tx, {
    deviceId: input.deviceId,
    associationId: input.associationId,
    revision: policy.revision,
    appFilter: policy.appFilter as Prisma.InputJsonObject,
    attempt: sets.length,
    now: input.now,
  });
}

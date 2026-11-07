import {
  ConflictException,
  HttpException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import type { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { simulationPresence } from './simulation-presence.js';
import {
  defaults,
  id,
  invalid,
  mergeSettings,
  object,
  report,
  revision,
  settingsPatch,
  text,
  type Settings,
} from './simulation.contract.js';

@Injectable()
export class SimulationService {
  constructor(private readonly prisma: PrismaService) {}

  private enabled() {
    if (!['development', 'test'].includes(process.env.NODE_ENV ?? ''))
      throw new NotFoundException();
  }

  async register(body: unknown) {
    this.enabled();
    const input = object(body, ['name', 'managedUser']);
    const name = text(input.name, 100);
    const managedUser =
      input.managedUser === undefined || input.managedUser === null
        ? null
        : text(input.managedUser, 100);
    const credential = randomBytes(32).toString('base64url');
    return this.transaction(async (tx) => {
      const device = await tx.device.create({
        data: {
          name,
          managedUser,
          isDemo: true,
          agentIdentity: {
            create: {
              credentialHash: createHash('sha256')
                .update(credential)
                .digest('hex'),
            },
          },
        },
        select: { id: true, name: true, managedUser: true, isDemo: true },
      });
      return { device, credential };
    });
  }

  async reset(deviceId: string, identityId: string) {
    this.enabled();
    id(deviceId);
    id(identityId);
    return this.transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM Device WHERE id = ${deviceId} FOR UPDATE`;
      const device = await tx.device.findFirst({
        where: {
          id: deviceId,
          isDemo: true,
          agentIdentity: { id: identityId, revokedAt: null },
        },
        select: { id: true },
      });
      if (!device)
        throw new NotFoundException('Computador simulado indisponível.');
      await tx.agentCommand.deleteMany({ where: { deviceId } });
      await tx.deviceAssociation.deleteMany({ where: { deviceId } });
      await tx.device.delete({ where: { id: deviceId } });
      return { deletedDeviceId: deviceId };
    });
  }

  async read(deviceId: string, guardianId?: string) {
    this.enabled();
    return this.transaction(async (tx) =>
      this.snapshot((await this.access(tx, deviceId, guardianId)).state),
    );
  }

  async update(deviceId: string, guardianId: string, body: unknown) {
    this.enabled();
    const input = object(body, ['revision', 'settings']);
    const expected = revision(input.revision);
    const patch = settingsPatch(input.settings);
    return this.transaction(async (tx) => {
      const { state } = await this.access(tx, deviceId, guardianId);
      if (state.revision !== expected)
        throw new ConflictException(
          'As configurações mudaram. Atualize e tente novamente.',
        );
      const current = state.settings as Settings;
      const revokedRequests = Object.entries(patch.installationDecisions ?? {})
        .filter(
          ([requestId, decision]) =>
            decision === 'DENIED' &&
            current.installationDecisions[requestId] === 'APPROVED',
        )
        .map(([requestId]) => requestId);
      if (patch.applicationRules) {
        const count = await tx.installedApplication.count({
          where: { deviceId, id: { in: Object.keys(patch.applicationRules) } },
        });
        if (count !== Object.keys(patch.applicationRules).length) invalid();
      }
      if (patch.installationDecisions) {
        const count = await tx.installationRequest.count({
          where: {
            deviceId,
            id: { in: Object.keys(patch.installationDecisions) },
            OR: [
              { status: 'PENDING' },
              { status: 'APPROVED', id: { in: revokedRequests } },
            ],
          },
        });
        if (count !== Object.keys(patch.installationDecisions).length)
          invalid();
      }
      const settings = mergeSettings(current, patch);
      if (revokedRequests.length) {
        const installed = await tx.installedApplication.findMany({
          where: { deviceId, id: { in: revokedRequests } },
          select: { id: true },
        });
        for (const application of installed)
          settings.applicationRules[application.id] = false;
      }
      if (
        Object.keys(settings.applicationRules).length > 100 ||
        Object.keys(settings.installationDecisions).length > 100
      )
        invalid();
      return this.snapshot(
        await tx.simulationState.update({
          where: { associationId: state.associationId },
          data: { settings, revision: { increment: 1 } },
        }),
      );
    });
  }

  async heartbeat(deviceId: string, body: unknown) {
    this.enabled();
    const input = object(body, ['associationId']);
    const associationId = id(input.associationId);
    return this.transaction(async (tx) => {
      const { state } = await this.access(tx, deviceId);
      if (state.associationId !== associationId)
        throw new ConflictException('O vínculo mudou. Consulte novamente.');
      return this.snapshot(
        await tx.simulationState.update({
          where: { associationId },
          data: { lastSeenAt: new Date() },
        }),
      );
    });
  }

  async acknowledge(deviceId: string, body: unknown) {
    this.enabled();
    const input = report(body);
    return this.transaction(async (tx) => {
      const { state } = await this.access(tx, deviceId);
      if (
        state.associationId !== input.associationId ||
        state.revision !== input.revision
      )
        throw new ConflictException(
          'Vínculo ou configuração mudou. Consulte novamente.',
        );
      const settings = state.settings as Settings;
      await tx.installedApplication.deleteMany({ where: { deviceId } });
      await tx.installedApplication.createMany({
        data: input.applications.map((app) => ({
          ...app,
          deviceId,
          sourceId: app.id,
          allowed: settings.applicationRules[app.id] ?? true,
        })),
      });
      await tx.installationRequest.deleteMany({ where: { deviceId } });
      await tx.installationRequest.createMany({
        data: input.installationRequests.map((request) => ({
          ...request,
          deviceId,
          sourceId: request.id,
          status:
            settings.installationDecisions[request.id] ?? ('PENDING' as const),
        })),
      });
      const now = new Date();
      await tx.device.update({
        where: { id: deviceId },
        data: {
          applicationsReportedAt: now,
          installationRequestsReportedAt: now,
        },
      });
      return this.snapshot(
        await tx.simulationState.update({
          where: { associationId: state.associationId },
          data: {
            appliedRevision: input.revision,
            appliedAt: now,
            lastSeenAt: now,
          },
        }),
      );
    });
  }

  private async access(
    tx: Prisma.TransactionClient,
    deviceId: string,
    guardianId?: string,
  ) {
    id(deviceId);
    await tx.$queryRaw`SELECT id FROM Device WHERE id = ${deviceId} FOR UPDATE`;
    const device = await tx.device.findFirst({
      where: { id: deviceId, isDemo: true, agentIdentity: { revokedAt: null } },
      select: { id: true },
    });
    if (!device)
      throw new NotFoundException('Computador simulado indisponível.');
    const association = await tx.deviceAssociation.findFirst({
      where: {
        deviceId,
        activeDeviceId: deviceId,
        revokedAt: null,
        ...(guardianId ? { guardianId } : {}),
      },
      select: { id: true },
    });
    if (!association)
      throw new NotFoundException('Computador sem vínculo ativo.');
    const state = await tx.simulationState.upsert({
      where: { associationId: association.id },
      create: { associationId: association.id, settings: defaults() },
      update: {},
    });
    return { state };
  }

  private snapshot(state: {
    associationId: string;
    revision: number;
    appliedRevision: number | null;
    appliedAt: Date | null;
    lastSeenAt: Date | null;
    settings: Prisma.JsonValue;
  }) {
    const { lastSeenAt, ...snapshot } = state;
    return {
      ...snapshot,
      appliedAt: state.appliedAt?.toISOString() ?? null,
      connection: simulationPresence(lastSeenAt),
    };
  }

  private async transaction<T>(
    operation: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    try {
      return await this.prisma.$transaction(operation);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new ServiceUnavailableException(
        'Simulação indisponível. Tente novamente.',
      );
    }
  }
}

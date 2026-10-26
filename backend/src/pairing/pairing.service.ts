import {
  ConflictException,
  GoneException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { randomBytes, createHash, randomUUID } from 'node:crypto';
import type { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { revokeCommands } from '../commands/revoke-commands.js';
import type { AuthenticatedAgent } from './agent-auth/agent-auth.guard.js';

const SESSION_TTL_MS = 5 * 60 * 1000;
const tokenHash = (token: string) =>
  createHash('sha256').update(token).digest('hex');

type DeviceLock = { id: string; guardianId: string | null; isDemo: boolean };

@Injectable()
export class PairingService {
  constructor(private readonly prisma: PrismaService) {}

  async createSession(agent: AuthenticatedAgent) {
    const token = randomBytes(32).toString('base64url');
    const hash = tokenHash(token);
    let expiresAt!: Date;

    try {
      await this.prisma.$transaction(
        async (tx) => {
          const [device] = await this.lockDevice(tx, agent.deviceId);
          if (!device)
            throw new NotFoundException('Computador não encontrado.');
          await this.requireActiveIdentity(tx, agent.id, agent.deviceId);
          this.assertDemoAllowed(device.isDemo);
          if (device.guardianId)
            throw new ConflictException(
              'Computador já associado a um responsável.',
            );

          const now = new Date();
          expiresAt = new Date(now.getTime() + SESSION_TTL_MS);
          await tx.pairingSession.updateMany({
            where: { deviceId: device.id, consumedAt: null, revokedAt: null },
            data: { revokedAt: now },
          });
          await tx.pairingSession.create({
            data: { deviceId: device.id, tokenHash: hash, expiresAt },
          });
        },
        { isolationLevel: 'ReadCommitted' },
      );
    } catch (error) {
      this.rethrowKnown(error);
    }

    return {
      token,
      expiresAt: expiresAt.toISOString(),
      qrPayload: `piplup://pair?token=${token}`,
    };
  }

  async validate(token: string) {
    try {
      const session = await this.prisma.pairingSession.findUnique({
        where: { tokenHash: tokenHash(token) },
        select: {
          id: true,
          deviceId: true,
          expiresAt: true,
          consumedAt: true,
          revokedAt: true,
          device: {
            select: {
              id: true,
              name: true,
              managedUser: true,
              isDemo: true,
              guardianId: true,
              agentIdentity: { select: { revokedAt: true } },
            },
          },
        },
      });
      this.assertUsableSession(session, new Date());
      if (!session || session.device.guardianId) {
        throw new ConflictException(
          'Computador já associado a um responsável.',
        );
      }
      if (
        !session.device.agentIdentity ||
        session.device.agentIdentity.revokedAt
      ) {
        throw new GoneException('Identidade do computador foi revogada.');
      }
      this.assertDemoAllowed(session.device.isDemo);
      return {
        valid: true as const,
        expiresAt: session.expiresAt.toISOString(),
        device: this.deviceSummary(session.device),
      };
    } catch (error) {
      this.rethrowKnown(error);
    }
  }

  async complete(guardianId: string, token: string) {
    const hash = tokenHash(token);
    const session = await this.findSessionDevice(hash);
    if (!session) throw new GoneException('Token de pareamento inválido.');
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const [device] = await this.lockDevice(tx, session.deviceId);
          if (!device)
            throw new GoneException('Computador não está mais disponível.');
          const current = await tx.pairingSession.findUnique({
            where: { tokenHash: hash },
            select: {
              id: true,
              deviceId: true,
              expiresAt: true,
              consumedAt: true,
              revokedAt: true,
              device: {
                select: {
                  id: true,
                  name: true,
                  managedUser: true,
                  isDemo: true,
                },
              },
            },
          });
          this.assertUsableSession(current, new Date());
          this.assertDemoAllowed(device.isDemo);
          if (device.guardianId)
            throw new ConflictException(
              'Computador já associado a um responsável.',
            );

          await this.requireActiveIdentityForDevice(tx, device.id);
          const now = new Date();
          this.assertUsableSession(current, now);
          const consume = await tx.pairingSession.updateMany({
            where: {
              id: current!.id,
              consumedAt: null,
              revokedAt: null,
              expiresAt: { gt: now },
            },
            data: { consumedAt: now, consumedByGuardianId: guardianId },
          });
          if (consume.count !== 1)
            throw new GoneException('Token de pareamento já foi consumido.');

          const associationId = randomUUID();
          await tx.deviceAssociation.create({
            data: {
              id: associationId,
              deviceId: device.id,
              guardianId,
              activeDeviceId: device.id,
            },
          });
          await tx.device.update({
            where: { id: device.id },
            data: { guardianId },
          });
          await tx.pairingSession.updateMany({
            where: {
              deviceId: device.id,
              id: { not: current!.id },
              consumedAt: null,
              revokedAt: null,
            },
            data: { revokedAt: now },
          });

          return {
            ...this.deviceSummary(current!.device),
            status: 'unverified' as const,
            lastSeen: null,
            paired: true as const,
            associationId,
          };
        },
        { isolationLevel: 'ReadCommitted' },
      );
    } catch (error) {
      this.rethrowKnown(error);
    }
  }

  async revokeGuardianAssociation(guardianId: string, deviceId: string) {
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const [device] = await this.lockDevice(tx, deviceId);
          if (!device)
            throw new NotFoundException('Associação não encontrada.');
          const association = await tx.deviceAssociation.findFirst({
            where: {
              deviceId,
              guardianId,
              activeDeviceId: deviceId,
              revokedAt: null,
            },
            select: { id: true },
          });
          if (!association)
            throw new NotFoundException('Associação não encontrada.');
          await this.revokeAssociation(
            tx,
            association.id,
            deviceId,
            new Date(),
          );
        },
        { isolationLevel: 'ReadCommitted' },
      );
    } catch (error) {
      this.rethrowKnown(error);
    }
  }

  async listAgentAssociations(deviceId: string) {
    try {
      return await this.prisma.deviceAssociation.findMany({
        where: { deviceId },
        select: {
          id: true,
          createdAt: true,
          revokedAt: true,
          guardian: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
      });
    } catch {
      throw new ServiceUnavailableException(
        'Serviço de associações indisponível.',
      );
    }
  }

  async revokeAgentAssociation(
    agent: AuthenticatedAgent,
    associationId: string,
  ) {
    try {
      await this.prisma.$transaction(
        async (tx) => {
          const [device] = await this.lockDevice(tx, agent.deviceId);
          if (!device)
            throw new NotFoundException('Associação não encontrada.');
          await this.requireActiveIdentity(tx, agent.id, agent.deviceId);
          const current = await tx.deviceAssociation.findFirst({
            where: {
              id: associationId,
              deviceId: agent.deviceId,
              activeDeviceId: agent.deviceId,
              revokedAt: null,
            },
            select: { id: true },
          });
          if (!current)
            throw new NotFoundException('Associação não encontrada.');
          await this.revokeAssociation(
            tx,
            current.id,
            agent.deviceId,
            new Date(),
          );
        },
        { isolationLevel: 'ReadCommitted' },
      );
    } catch (error) {
      this.rethrowKnown(error);
    }
  }

  private async revokeAssociation(
    tx: Prisma.TransactionClient,
    associationId: string,
    deviceId: string,
    now: Date,
  ) {
    await revokeCommands(tx, deviceId, associationId);
    await tx.deviceAssociation.update({
      where: { id: associationId },
      data: { revokedAt: now, activeDeviceId: null },
    });
    await tx.device.updateMany({
      where: { id: deviceId },
      data: { guardianId: null },
    });
    await tx.pairingSession.updateMany({
      where: { deviceId, consumedAt: null, revokedAt: null },
      data: { revokedAt: now },
    });
  }

  private async findSessionDevice(hash: string) {
    try {
      return await this.prisma.pairingSession.findUnique({
        where: { tokenHash: hash },
        select: { deviceId: true },
      });
    } catch {
      throw new ServiceUnavailableException(
        'Serviço de pareamento indisponível.',
      );
    }
  }

  private async lockDevice(tx: Prisma.TransactionClient, deviceId: string) {
    return tx.$queryRaw<
      DeviceLock[]
    >`SELECT id, guardianId, isDemo FROM Device WHERE id = ${deviceId} FOR UPDATE`;
  }

  private async requireActiveIdentity(
    tx: Prisma.TransactionClient,
    identityId: string,
    deviceId: string,
  ) {
    const identity = await tx.agentIdentity.findFirst({
      where: { id: identityId, deviceId, revokedAt: null },
      select: { id: true },
    });
    if (!identity)
      throw new UnauthorizedException('Credenciais do computador inválidas.');
  }

  private async requireActiveIdentityForDevice(
    tx: Prisma.TransactionClient,
    deviceId: string,
  ) {
    const identity = await tx.agentIdentity.findFirst({
      where: { deviceId, revokedAt: null },
      select: { id: true },
    });
    if (!identity)
      throw new GoneException('Identidade do computador foi revogada.');
  }

  private assertDemoAllowed(isDemo: boolean) {
    if (
      isDemo &&
      !['development', 'test'].includes(process.env.NODE_ENV ?? '')
    ) {
      throw new GoneException(
        'Computador de demonstração não pode ser autorizado.',
      );
    }
  }

  private assertUsableSession(
    session: {
      expiresAt: Date;
      consumedAt: Date | null;
      revokedAt: Date | null;
    } | null,
    now: Date,
  ) {
    if (!session) throw new GoneException('Token de pareamento inválido.');
    if (session.revokedAt)
      throw new GoneException('Sessão de pareamento foi revogada.');
    if (session.consumedAt)
      throw new GoneException('Token de pareamento já foi consumido.');
    if (session.expiresAt <= now)
      throw new GoneException('Sessão de pareamento expirada.');
  }

  private deviceSummary(device: {
    id: string;
    name: string;
    managedUser: string | null;
    isDemo: boolean;
  }) {
    return {
      id: device.id,
      name: device.name,
      managedUser: device.managedUser,
      isDemo: device.isDemo,
    };
  }

  private rethrowKnown(error: unknown): never {
    if (
      error instanceof ConflictException ||
      error instanceof GoneException ||
      error instanceof NotFoundException ||
      error instanceof ServiceUnavailableException ||
      error instanceof UnauthorizedException
    ) {
      throw error;
    }
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'P2002'
    ) {
      throw new ConflictException(
        'Computador já associado a outro responsável.',
      );
    }
    throw new ServiceUnavailableException(
      'Serviço de pareamento indisponível.',
    );
  }
}

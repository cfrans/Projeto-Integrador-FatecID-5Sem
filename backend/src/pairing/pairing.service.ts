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
import type { AuthenticatedAgent } from './agent-auth/agent-auth.guard.js';

const SESSION_TTL_MS = 5 * 60 * 1000;
const tokenHash = (token: string) =>
  createHash('sha256').update(token).digest('hex');

type DeviceLock = { id: string; guardianId: string | null; isDemo: boolean };

export type AgentRegistration = {
  credentialHash: string;
  name: string;
  managedUser: string;
};

const registrationSelect = {
  registrationDeviceId: true,
  registrationCredentialHash: true,
  registrationName: true,
  registrationManagedUser: true,
} as const;

type RegistrationFields = {
  registrationDeviceId: string | null;
  registrationCredentialHash: string | null;
  registrationName: string | null;
  registrationManagedUser: string | null;
};

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

    return this.sessionResponse(token, expiresAt);
  }

  async register(registration: AgentRegistration) {
    const token = randomBytes(32).toString('base64url');
    const hash = tokenHash(token);
    let expiresAt!: Date;

    try {
      await this.prisma.$transaction(
        async (tx) => {
          await this.assertCredentialUnused(
            tx,
            registration.credentialHash,
            ConflictException,
          );
          const now = new Date();
          expiresAt = new Date(now.getTime() + SESSION_TTL_MS);
          await tx.pairingSession.updateMany({
            where: {
              registrationCredentialHash: registration.credentialHash,
              consumedAt: null,
              revokedAt: null,
            },
            data: { revokedAt: now },
          });
          await tx.pairingSession.create({
            data: {
              registrationDeviceId: randomUUID(),
              registrationCredentialHash: registration.credentialHash,
              registrationName: registration.name,
              registrationManagedUser: registration.managedUser,
              tokenHash: hash,
              expiresAt,
            },
          });
        },
        { isolationLevel: 'ReadCommitted' },
      );
    } catch (error) {
      this.rethrowKnown(error);
    }

    return this.sessionResponse(token, expiresAt);
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
          ...registrationSelect,
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
      await this.assertUsableSession(this.prisma, session, new Date());
      const registered = session && this.registeredDevice(session);
      if (registered) {
        await this.assertCredentialUnused(
          this.prisma,
          registered.credentialHash,
          GoneException,
        );
        return {
          valid: true as const,
          expiresAt: session.expiresAt.toISOString(),
          device: registered.device,
        };
      }
      if (!session?.device || session.device.guardianId) {
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
    if (!session.deviceId) return this.completeRegistration(guardianId, hash);
    const deviceId = session.deviceId;
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const [device] = await this.lockDevice(tx, deviceId);
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
          await this.assertUsableSession(tx, current, new Date());
          if (!current?.device)
            throw new GoneException('Token de pareamento inválido.');
          this.assertDemoAllowed(device.isDemo);
          if (device.guardianId)
            throw new ConflictException(
              'Computador já associado a um responsável.',
            );

          await this.requireActiveIdentityForDevice(tx, device.id);
          const now = new Date();
          await this.assertUsableSession(tx, current, now);
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

          return this.pairedResponse(current.device, associationId);
        },
        { isolationLevel: 'ReadCommitted' },
      );
    } catch (error) {
      this.rethrowKnown(error);
    }
  }

  private async completeRegistration(guardianId: string, hash: string) {
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          await tx.$queryRaw`SELECT id FROM PairingSession WHERE tokenHash = ${hash} FOR UPDATE`;
          const current = await tx.pairingSession.findUnique({
            where: { tokenHash: hash },
            select: {
              id: true,
              expiresAt: true,
              consumedAt: true,
              revokedAt: true,
              ...registrationSelect,
            },
          });
          const now = new Date();
          await this.assertUsableSession(tx, current, now);
          const registered = current && this.registeredDevice(current);
          if (!registered)
            throw new GoneException('Token de pareamento inválido.');
          await this.assertCredentialUnused(
            tx,
            registered.credentialHash,
            GoneException,
          );

          const consume = await tx.pairingSession.updateMany({
            where: {
              id: current.id,
              consumedAt: null,
              revokedAt: null,
              expiresAt: { gt: now },
            },
            data: { consumedAt: now, consumedByGuardianId: guardianId },
          });
          if (consume.count !== 1)
            throw new GoneException('Token de pareamento já foi consumido.');

          const { device } = registered;
          await tx.device.create({
            data: {
              id: device.id,
              name: device.name,
              managedUser: device.managedUser,
              isDemo: false,
              guardianId,
            },
          });
          await tx.agentIdentity.create({
            data: {
              deviceId: device.id,
              credentialHash: registered.credentialHash,
            },
          });
          const associationId = randomUUID();
          await tx.deviceAssociation.create({
            data: {
              id: associationId,
              deviceId: device.id,
              guardianId,
              activeDeviceId: device.id,
            },
          });
          await tx.pairingSession.updateMany({
            where: {
              registrationCredentialHash: registered.credentialHash,
              id: { not: current.id },
              consumedAt: null,
              revokedAt: null,
            },
            data: { revokedAt: now },
          });

          return this.pairedResponse(device, associationId);
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
  ) {
    await tx.$executeRaw`CALL sp_revoke_device_association(${deviceId}, ${associationId})`;
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

  private registeredDevice(session: RegistrationFields) {
    const {
      registrationDeviceId: id,
      registrationCredentialHash: credentialHash,
      registrationName: name,
      registrationManagedUser: managedUser,
    } = session;
    if (!id || !credentialHash || !name || !managedUser) return null;
    return {
      credentialHash,
      device: { id, name, managedUser, isDemo: false },
    };
  }

  private async assertCredentialUnused(
    tx: Pick<Prisma.TransactionClient, 'agentIdentity'>,
    credentialHash: string,
    Rejection: typeof ConflictException | typeof GoneException,
  ) {
    const identity = await tx.agentIdentity.findUnique({
      where: { credentialHash },
      select: { id: true },
    });
    if (identity)
      throw new Rejection('Credencial do computador já foi registrada.');
  }

  private sessionResponse(token: string, expiresAt: Date) {
    return {
      token,
      expiresAt: expiresAt.toISOString(),
      qrPayload: `piplup://pair?token=${token}`,
    };
  }

  private pairedResponse(
    device: {
      id: string;
      name: string;
      managedUser: string | null;
      isDemo: boolean;
    },
    associationId: string,
  ) {
    return {
      ...this.deviceSummary(device),
      status: 'unverified' as const,
      lastSeen: null,
      paired: true as const,
      associationId,
    };
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

  private async assertUsableSession(
    tx: Pick<Prisma.TransactionClient, '$queryRaw'>,
    session: {
      expiresAt: Date;
      consumedAt: Date | null;
      revokedAt: Date | null;
    } | null,
    now: Date,
  ) {
    if (!session) throw new GoneException('Token de pareamento inválido.');
    const [result] = await tx.$queryRaw<{ status: string }[]>`
      SELECT fn_pairing_session_status(${session.consumedAt}, ${session.revokedAt}, ${session.expiresAt}, ${now}) AS status
    `;
    if (result?.status === 'revoked')
      throw new GoneException('Sessão de pareamento foi revogada.');
    if (result?.status === 'consumed')
      throw new GoneException('Token de pareamento já foi consumido.');
    if (result?.status === 'expired')
      throw new GoneException('Sessão de pareamento expirada.');
    if (result?.status !== 'pending')
      throw new ServiceUnavailableException('Serviço de pareamento indisponível.');
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

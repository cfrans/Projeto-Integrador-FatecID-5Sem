import {
  ConflictException,
  GoneException,
  HttpException,
  Injectable,
  NotFoundException,
  NotImplementedException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma, type AgentCommand } from '../../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AuthenticatedAgent } from '../pairing/agent-auth/agent-auth.guard.js';
import {
  canonicalResult,
  COMMAND_TTL_MS,
  isParental,
  normalizeParameters,
  normalizeResult,
  policyState,
  type NormalizedResult,
} from './command-types.js';
import type {
  ClaimCommandDto,
  CommandResultDto,
  CreateCommandDto,
} from './dto/command.dto.js';

const EXECUTION_MS = 30_000;
type LockedDevice = { id: string; guardianId: string | null; isDemo: boolean };

@Injectable()
export class CommandsService {
  constructor(private readonly prisma: PrismaService) {}

  private async transaction<T>(
    deviceId: string,
    action: (tx: Prisma.TransactionClient, device: LockedDevice) => Promise<T>,
  ) {
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const [device] = await tx.$queryRaw<
            LockedDevice[]
          >`SELECT id, guardianId, isDemo FROM Device WHERE id = ${deviceId} FOR UPDATE`;
          if (!device)
            throw new NotFoundException('Computador não encontrado.');
          return action(tx, device);
        },
        { isolationLevel: 'ReadCommitted' },
      );
    } catch (error) {
      if (error instanceof HttpException) throw error;
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      )
        throw new ConflictException('Identificador de reserva já utilizado.');
      throw new ServiceUnavailableException(
        'Serviço de comandos indisponível.',
      );
    }
  }

  private async activeIdentity(
    tx: Prisma.TransactionClient,
    device: LockedDevice,
    agent?: AuthenticatedAgent,
  ) {
    const identity = await tx.agentIdentity.findFirst({
      where: {
        deviceId: device.id,
        revokedAt: null,
        ...(agent ? { id: agent.id } : {}),
      },
    });
    if (
      !identity ||
      (device.isDemo &&
        !['development', 'test'].includes(process.env.NODE_ENV ?? ''))
    ) {
      if (agent)
        throw new UnauthorizedException('Identidade inválida ou revogada.');
      throw new GoneException('Identidade indisponível.');
    }
    return identity;
  }

  private async association(
    tx: Prisma.TransactionClient,
    device: LockedDevice,
    guardianId?: string,
    associationId?: string,
  ) {
    return tx.deviceAssociation.findFirst({
      where: {
        deviceId: device.id,
        guardianId: guardianId ?? device.guardianId ?? '',
        activeDeviceId: device.id,
        revokedAt: null,
        ...(associationId ? { id: associationId } : {}),
      },
    });
  }

  private effective(command: AgentCommand, now: Date) {
    if (command.status === 'pending' && command.expiresAt <= now)
      return 'expired';
    if (command.status === 'running' && command.executionDeadlineAt! <= now)
      return 'unknown';
    return command.status;
  }

  private view(command: AgentCommand, now: Date) {
    return {
      id: command.id,
      associationId: command.associationId,
      requestId: command.requestId,
      type: command.type,
      version: command.version,
      parameters: command.parameters,
      status: this.effective(command, now),
      createdAt: command.createdAt.toISOString(),
      expiresAt: command.expiresAt.toISOString(),
      executionTimeoutSeconds: EXECUTION_MS / 1000,
      claimId: command.claimId,
      executionDeadlineAt: command.executionDeadlineAt?.toISOString() ?? null,
      result: command.result,
      error: command.errorCode ? { code: command.errorCode } : null,
      completedAt: command.completedAt?.toISOString() ?? null,
    };
  }

  async create(guardianId: string, deviceId: string, input: CreateCommandDto) {
    if (
      isParental(input.type) &&
      process.env.ENABLE_PARENTAL_COMMANDS !== 'true'
    )
      throw new NotImplementedException(
        'Comandos parentais ainda não estão habilitados neste servidor.',
      );
    const parameters = normalizeParameters(input.type, input.parameters);
    return this.transaction(deviceId, async (tx, device) => {
      const association =
        device.guardianId === guardianId
          ? await this.association(tx, device, guardianId)
          : null;
      if (!association)
        throw new NotFoundException('Associação ativa não encontrada.');
      await this.activeIdentity(tx, device);
      const requestId = input.requestId.toLowerCase();
      const existing = await tx.agentCommand.findUnique({
        where: {
          associationId_requestId: { associationId: association.id, requestId },
        },
      });
      if (existing) {
        if (
          existing.type !== input.type ||
          existing.version !== input.version ||
          JSON.stringify(
            normalizeParameters(existing.type, existing.parameters),
          ) !== JSON.stringify(parameters)
        )
          throw new ConflictException(
            'requestId já utilizado com outra intenção.',
          );
        return { created: false, command: this.view(existing, new Date()) };
      }
      const now = new Date();
      const command = await tx.agentCommand.create({
        data: {
          deviceId,
          associationId: association.id,
          requestId,
          type: input.type,
          version: input.version,
          parameters: parameters as Prisma.InputJsonObject,
          expiresAt: new Date(now.getTime() + COMMAND_TTL_MS),
          createdAt: now,
        },
      });
      return { created: true, command: this.view(command, now) };
    });
  }

  async get(guardianId: string, deviceId: string, id: string) {
    return this.transaction(deviceId, async (tx, device) => {
      const command = await tx.agentCommand.findFirst({
        where: { id, deviceId },
      });
      if (
        !command ||
        device.guardianId !== guardianId ||
        !(await this.association(tx, device, guardianId, command.associationId))
      )
        throw new NotFoundException('Comando não encontrado.');
      return this.view(command, new Date());
    });
  }

  async poll(agent: AuthenticatedAgent) {
    return this.transaction(agent.deviceId, async (tx, device) => {
      await this.activeIdentity(tx, device, agent);
      const association = await this.association(tx, device);
      const now = new Date();
      const commands = association
        ? await tx.agentCommand.findMany({
            where: {
              deviceId: device.id,
              associationId: association.id,
              status: 'pending',
              expiresAt: { gt: now },
            },
            orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
            take: 1,
          })
        : [];
      return {
        protocolVersion: 1,
        serverTime: now.toISOString(),
        commands: commands.map((command) => this.view(command, now)),
      };
    });
  }

  async claim(agent: AuthenticatedAgent, id: string, input: ClaimCommandDto) {
    return this.transaction(agent.deviceId, async (tx, device) => {
      await this.activeIdentity(tx, device, agent);
      let command = await tx.agentCommand.findFirst({
        where: { id, deviceId: device.id },
      });
      if (!command) throw new NotFoundException('Comando não encontrado.');
      if (
        !(await this.association(tx, device, undefined, command.associationId))
      )
        throw new GoneException('Vínculo original revogado.');
      const now = new Date();
      const claimId = input.claimId.toLowerCase();
      if (command.claimId) {
        if (
          command.claimId !== claimId ||
          command.claimedByIdentityId !== agent.id
        )
          throw new ConflictException('Comando já reservado.');
      } else {
        if (this.effective(command, now) !== 'pending')
          throw new GoneException('Comando expirado ou cancelado.');
        const running = await tx.agentCommand.findFirst({
          where: {
            deviceId: device.id,
            status: 'running',
            executionDeadlineAt: { gt: now },
          },
        });
        if (running)
          throw new ConflictException('Outro comando está em execução.');
        command = await tx.agentCommand.update({
          where: { id },
          data: {
            status: 'running',
            claimId,
            claimedByIdentityId: agent.id,
            claimedAt: now,
            executionDeadlineAt: new Date(now.getTime() + EXECUTION_MS),
          },
        });
      }
      return {
        protocolVersion: 1,
        serverTime: now.toISOString(),
        command: this.view(command, now),
      };
    });
  }

  async result(agent: AuthenticatedAgent, id: string, input: CommandResultDto) {
    return this.transaction(agent.deviceId, async (tx, device) => {
      await this.activeIdentity(tx, device, agent);
      let command = await tx.agentCommand.findFirst({
        where: { id, deviceId: device.id },
      });
      if (!command) throw new NotFoundException('Comando não encontrado.');
      const outcome = normalizeResult(command, input);
      if (
        !(await this.association(tx, device, undefined, command.associationId))
      )
        throw new GoneException('Vínculo original revogado.');
      if (
        command.claimId !== input.claimId.toLowerCase() ||
        command.claimedByIdentityId !== agent.id
      )
        throw new ConflictException('Reserva incompatível.');
      if (command.status === 'succeeded' || command.status === 'failed') {
        if (
          command.status !== outcome.status ||
          command.errorCode !== outcome.errorCode ||
          (outcome.status === 'succeeded' &&
            JSON.stringify(canonicalResult(command.type, command.result)) !==
              JSON.stringify(outcome.result))
        )
          throw new ConflictException(
            'Resultado definitivo não pode ser alterado.',
          );
      } else {
        if (!['running', 'unknown'].includes(command.status))
          throw new GoneException('Comando não aceita resultado.');
        const now = new Date();
        command = await tx.agentCommand.update({
          where: { id },
          data: {
            status: outcome.status,
            result:
              outcome.status === 'succeeded'
                ? (outcome.result as Prisma.InputJsonObject)
                : Prisma.DbNull,
            errorCode: outcome.errorCode,
            completedAt: now,
          },
        });
        await this.reconcile(tx, command, outcome, now);
      }
      return {
        id: command.id,
        status: command.status,
        completedAt: command.completedAt!.toISOString(),
      };
    });
  }

  private async reconcile(
    tx: Prisma.TransactionClient,
    command: AgentCommand,
    outcome: NormalizedResult,
    now: Date,
  ) {
    if (!isParental(command.type)) return;
    const policy = await tx.parentalPolicy.findUnique({
      where: { associationId: command.associationId },
    });
    if (!policy) return;
    if (command.type === 'parental.app_filter.read') {
      if (outcome.status === 'succeeded')
        await tx.parentalPolicy.update({
          where: { associationId: policy.associationId },
          data: {
            observedAppFilter: outcome.result as Prisma.InputJsonObject,
            observedAt: now,
          },
        });
      return;
    }
    const revision = command.policyRevision;
    if (revision === null) return;
    if (outcome.status === 'succeeded') {
      await tx.parentalPolicy.update({
        where: { associationId: policy.associationId },
        data: {
          appliedRevision: Math.max(policy.appliedRevision ?? 0, revision),
          appliedAt: now,
          observedAppFilter: outcome.result as Prisma.InputJsonObject,
          observedAt: now,
          ...(revision >= policy.revision ? { lastErrorCode: null } : {}),
        },
      });
    } else if (revision === policy.revision) {
      await tx.parentalPolicy.update({
        where: { associationId: policy.associationId },
        data: { lastErrorCode: outcome.errorCode },
      });
    }
  }

  async policy(guardianId: string, deviceId: string) {
    return this.transaction(deviceId, async (tx, device) => {
      const association =
        device.guardianId === guardianId
          ? await this.association(tx, device, guardianId)
          : null;
      if (!association)
        throw new NotFoundException('Associação ativa não encontrada.');
      const policy = await tx.parentalPolicy.findUnique({
        where: { associationId: association.id },
      });
      if (!policy) throw new NotFoundException('Política não encontrada.');
      return {
        state: policyState(policy),
        revision: policy.revision,
        appliedRevision: policy.appliedRevision,
        appFilter: policy.appFilter,
        observedAppFilter: policy.observedAppFilter,
        appliedAt: policy.appliedAt?.toISOString() ?? null,
        observedAt: policy.observedAt?.toISOString() ?? null,
        error: policy.lastErrorCode ? { code: policy.lastErrorCode } : null,
      };
    });
  }
}

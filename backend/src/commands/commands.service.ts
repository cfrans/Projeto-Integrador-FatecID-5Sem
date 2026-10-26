import {
  BadRequestException,
  ConflictException,
  GoneException,
  HttpException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma, type AgentCommand } from '../../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AuthenticatedAgent } from '../pairing/agent-auth/agent-auth.guard.js';
import type {
  ClaimCommandDto,
  CommandResultDto,
  CreateCommandDto,
} from './dto/command.dto.js';

const TTL_MS = 300_000;
const EXECUTION_MS = 30_000;
const ERROR_CODES = [
  'UNSUPPORTED_OPERATION',
  'INVALID_PARAMETERS',
  'EXECUTION_TIMEOUT',
  'LOCAL_UNAVAILABLE',
];
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
    if (Object.keys(input.parameters).length)
      throw new BadRequestException('Ping não aceita parâmetros.');
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
          JSON.stringify(existing.parameters) !== '{}'
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
          parameters: {},
          expiresAt: new Date(now.getTime() + TTL_MS),
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
    const result = input.result;
    const error = input.error;
    let errorCode: string | null = null;
    if (input.status === 'succeeded') {
      if (
        !result ||
        typeof result !== 'object' ||
        Array.isArray(result) ||
        Object.keys(result).length !== 1 ||
        !('reachable' in result) ||
        result.reachable !== true ||
        error !== null
      )
        throw new BadRequestException('Resultado de ping inválido.');
    } else {
      if (
        result !== null ||
        !error ||
        typeof error !== 'object' ||
        Array.isArray(error) ||
        Object.keys(error).length !== 1 ||
        !('code' in error) ||
        typeof error.code !== 'string' ||
        !ERROR_CODES.includes(error.code)
      )
        throw new BadRequestException('Código de falha inválido.');
      errorCode = error.code;
    }
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
      if (
        command.claimId !== input.claimId.toLowerCase() ||
        command.claimedByIdentityId !== agent.id
      )
        throw new ConflictException('Reserva incompatível.');
      if (command.status === 'succeeded' || command.status === 'failed') {
        if (command.status !== input.status || command.errorCode !== errorCode)
          throw new ConflictException(
            'Resultado definitivo não pode ser alterado.',
          );
      } else {
        if (!['running', 'unknown'].includes(command.status))
          throw new GoneException('Comando não aceita resultado.');
        command = await tx.agentCommand.update({
          where: { id },
          data: {
            status: input.status,
            result:
              input.status === 'succeeded'
                ? { reachable: true }
                : Prisma.DbNull,
            errorCode,
            completedAt: new Date(),
          },
        });
      }
      return {
        id: command.id,
        status: command.status,
        completedAt: command.completedAt!.toISOString(),
      };
    });
  }
}

import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AGENT_PRESENCE_WRITE_INTERVAL_MS } from '../../simulation/simulation-presence.js';

export type AuthenticatedAgent = {
  id: string;
  deviceId: string;
};

type AgentRequest = Request & { agent?: AuthenticatedAgent };

@Injectable()
export class AgentAuthGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AgentRequest>();
    const authorization = request.header('authorization');
    const match = authorization?.match(/^Bearer ([A-Za-z0-9_-]{43})$/);
    if (!match) {
      throw new UnauthorizedException('Credenciais do computador inválidas.');
    }

    let identity;
    try {
      identity = await this.prisma.agentIdentity.findUnique({
        where: {
          credentialHash: createHash('sha256').update(match[1]).digest('hex'),
        },
        select: {
          id: true,
          deviceId: true,
          revokedAt: true,
          lastSeenAt: true,
          device: { select: { isDemo: true } },
        },
      });
    } catch {
      throw new ServiceUnavailableException(
        'Serviço de autenticação do computador indisponível.',
      );
    }

    if (
      !identity ||
      identity.revokedAt ||
      (identity.device.isDemo &&
        !['development', 'test'].includes(process.env.NODE_ENV ?? ''))
    ) {
      throw new UnauthorizedException('Credenciais do computador inválidas.');
    }

    if (!identity.device.isDemo)
      await this.recordContact(identity.id, identity.lastSeenAt);
    request.agent = { id: identity.id, deviceId: identity.deviceId };
    return true;
  }

  private async recordContact(identityId: string, lastSeenAt: Date | null) {
    const now = new Date();
    if (
      lastSeenAt &&
      now.getTime() - lastSeenAt.getTime() < AGENT_PRESENCE_WRITE_INTERVAL_MS
    )
      return;
    await this.prisma.agentIdentity
      .updateMany({
        where: { id: identityId, revokedAt: null },
        data: { lastSeenAt: now },
      })
      .catch(() => undefined);
  }
}

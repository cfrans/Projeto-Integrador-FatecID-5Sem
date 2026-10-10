import { Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../prisma/prisma.service.js';
import { getJwtSecret, JWT_AUDIENCE, JWT_ISSUER } from './jwt-config.js';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: getJwtSecret(),
      algorithms: ['HS256'],
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
      ignoreExpiration: false,
    });
  }

  async validate(payload: { sub?: unknown }) {
    if (typeof payload.sub !== 'string') {
      throw new UnauthorizedException('Credenciais inválidas.');
    }

    let guardian;
    try {
      guardian = await this.prisma.guardian.findUnique({
        where: { id: payload.sub },
        select: { id: true, name: true, email: true },
      });
    } catch {
      throw new ServiceUnavailableException('Serviço de autenticação indisponível.');
    }

    if (!guardian) {
      throw new UnauthorizedException('Credenciais inválidas.');
    }

    return guardian;
  }
}

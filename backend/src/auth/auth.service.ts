import { Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service.js';
import { JWT_EXPIRES_IN_SECONDS } from './jwt-config.js';
import { LoginDto } from './dto/login.dto.js';

const DUMMY_PASSWORD = 'credential-timing-equalization-only';

@Injectable()
export class AuthService {
  private readonly dummyHash = argon2.hash(DUMMY_PASSWORD, { type: argon2.argon2id });

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async login(credentials: LoginDto) {
    const email = credentials.email.trim().toLowerCase();
    let guardian;
    try {
      guardian = await this.prisma.guardian.findUnique({
        where: { email },
        select: { id: true, name: true, email: true, passwordHash: true },
      });
    } catch {
      throw new ServiceUnavailableException('Serviço de autenticação indisponível.');
    }

    const passwordMatches = guardian
      ? await argon2.verify(guardian.passwordHash, credentials.password)
      : await argon2.verify(await this.dummyHash, credentials.password);

    if (!guardian || !passwordMatches) {
      throw new UnauthorizedException('Email ou senha inválidos.');
    }

    const guardianView = { id: guardian.id, name: guardian.name, email: guardian.email };
    const accessToken = await this.jwtService.signAsync({ sub: guardian.id });

    return { accessToken, expiresIn: JWT_EXPIRES_IN_SECONDS, guardian: guardianView };
  }
}

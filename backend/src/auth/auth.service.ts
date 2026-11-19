import {
  BadRequestException,
  ConflictException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { createHmac } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import { getJwtSecret, JWT_EXPIRES_IN_SECONDS } from './jwt-config.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';
import { UpdateEmailDto } from './dto/update-email.dto.js';
import { UpdatePasswordDto } from './dto/update-password.dto.js';
import {
  normalizeSecurityAnswer,
  RecoveryQuestionDto,
  ResetPasswordDto,
  SetSecurityQuestionDto,
  VerifyRecoveryAnswerDto,
} from './dto/security-question.dto.js';

const DUMMY_PASSWORD = 'credential-timing-equalization-only';

const DECOY_SECURITY_QUESTIONS = [
  'Qual o nome do seu primeiro animal de estimação?',
  'Em que cidade você nasceu?',
  'Qual o nome da sua primeira escola?',
  'Qual o nome de solteira da sua mãe?',
  'Qual era o seu apelido de infância?',
  'Qual o nome do seu melhor amigo de infância?',
  'Qual foi o seu primeiro emprego?',
  'Qual a sua comida favorita?',
] as const;

function decoySecurityQuestion(email: string): string {
  const digest = createHmac('sha256', getJwtSecret()).update(`recovery-decoy:${email}`).digest();
  return DECOY_SECURITY_QUESTIONS[digest.readUInt32BE(0) % DECOY_SECURITY_QUESTIONS.length];
}

function prismaErrorCode(error: unknown): string | undefined {
  if (typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string') {
    return error.code;
  }
  return undefined;
}

@Injectable()
export class AuthService {
  private readonly dummyHash = argon2.hash(DUMMY_PASSWORD, { type: argon2.argon2id });

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const name = dto.name.trim();
    const email = dto.email.trim().toLowerCase();
    const passwordHash = await argon2.hash(dto.password, { type: argon2.argon2id });

    try {
      return await this.prisma.guardian.create({
        data: { name, email, passwordHash },
        select: { id: true, name: true, email: true },
      });
    } catch (error) {
      if (prismaErrorCode(error) === 'P2002') {
        throw new ConflictException('Já existe uma conta cadastrada com este e-mail.');
      }
      throw new ServiceUnavailableException('Serviço de autenticação indisponível.');
    }
  }

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

  async updateEmail(guardianId: string, dto: UpdateEmailDto) {
    const email = dto.email.trim().toLowerCase();
    try {
      return await this.prisma.guardian.update({
        where: { id: guardianId },
        data: { email },
        select: { id: true, name: true, email: true },
      });
    } catch (error) {
      const code = prismaErrorCode(error);
      if (code === 'P2002') {
        throw new ConflictException('Já existe uma conta cadastrada com este e-mail.');
      }
      if (code === 'P2025') {
        throw new UnauthorizedException('Credenciais inválidas.');
      }
      throw new ServiceUnavailableException('Serviço de autenticação indisponível.');
    }
  }

  async updatePassword(guardianId: string, dto: UpdatePasswordDto) {
    let guardian;
    try {
      guardian = await this.prisma.guardian.findUnique({
        where: { id: guardianId },
        select: { id: true, passwordHash: true },
      });
    } catch {
      throw new ServiceUnavailableException('Serviço de autenticação indisponível.');
    }

    if (!guardian) {
      throw new UnauthorizedException('Credenciais inválidas.');
    }

    const currentMatches = await argon2.verify(guardian.passwordHash, dto.currentPassword);
    if (!currentMatches) {
      throw new BadRequestException('A senha atual está incorreta.');
    }

    const passwordHash = await argon2.hash(dto.newPassword, { type: argon2.argon2id });
    try {
      await this.prisma.guardian.update({
        where: { id: guardianId },
        data: { passwordHash },
        select: { id: true },
      });
    } catch (error) {
      if (prismaErrorCode(error) === 'P2025') {
        throw new UnauthorizedException('Credenciais inválidas.');
      }
      throw new ServiceUnavailableException('Serviço de autenticação indisponível.');
    }
  }

  async getSecurityQuestion(guardianId: string) {
    let guardian;
    try {
      guardian = await this.prisma.guardian.findUnique({
        where: { id: guardianId },
        select: { securityQuestion: true },
      });
    } catch {
      throw new ServiceUnavailableException('Serviço de autenticação indisponível.');
    }

    if (!guardian) {
      throw new UnauthorizedException('Credenciais inválidas.');
    }

    return { question: guardian.securityQuestion };
  }

  async setSecurityQuestion(guardianId: string, dto: SetSecurityQuestionDto) {
    const question = dto.question.trim();
    const answer = normalizeSecurityAnswer(dto.answer);
    const securityAnswerHash = await argon2.hash(answer, { type: argon2.argon2id });

    try {
      await this.prisma.guardian.update({
        where: { id: guardianId },
        data: { securityQuestion: question, securityAnswerHash },
        select: { id: true },
      });
    } catch (error) {
      if (prismaErrorCode(error) === 'P2025') {
        throw new UnauthorizedException('Credenciais inválidas.');
      }
      throw new ServiceUnavailableException('Serviço de autenticação indisponível.');
    }

    return { question };
  }

  async getRecoveryQuestion(dto: RecoveryQuestionDto) {
    const email = dto.email.trim().toLowerCase();
    let guardian;
    try {
      guardian = await this.prisma.guardian.findUnique({
        where: { email },
        select: { securityQuestion: true },
      });
    } catch {
      throw new ServiceUnavailableException('Serviço de autenticação indisponível.');
    }

    return { question: guardian?.securityQuestion ?? decoySecurityQuestion(email) };
  }

  async verifyRecoveryAnswer(dto: VerifyRecoveryAnswerDto) {
    const email = dto.email.trim().toLowerCase();
    const answer = normalizeSecurityAnswer(dto.answer);
    let guardian;
    try {
      guardian = await this.prisma.guardian.findUnique({
        where: { email },
        select: { id: true, securityQuestion: true, securityAnswerHash: true },
      });
    } catch {
      throw new ServiceUnavailableException('Serviço de autenticação indisponível.');
    }

    const answerMatches = guardian?.securityAnswerHash
      ? await argon2.verify(guardian.securityAnswerHash, answer)
      : await argon2.verify(await this.dummyHash, answer);

    if (!guardian?.securityQuestion || !answerMatches) {
      throw new BadRequestException('Resposta de segurança incorreta.');
    }

    return { valid: true };
  }

  async resetPasswordWithSecurityAnswer(dto: ResetPasswordDto) {
    const email = dto.email.trim().toLowerCase();
    await this.verifyRecoveryAnswer(dto);
    const passwordHash = await argon2.hash(dto.newPassword, { type: argon2.argon2id });

    try {
      await this.prisma.guardian.update({
        where: { email },
        data: { passwordHash },
        select: { id: true },
      });
    } catch (error) {
      if (prismaErrorCode(error) === 'P2025') {
        throw new BadRequestException('Resposta de segurança incorreta.');
      }
      throw new ServiceUnavailableException('Serviço de autenticação indisponível.');
    }
  }
}

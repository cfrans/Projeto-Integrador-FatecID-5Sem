import * as argon2 from 'argon2';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';
import { UpdateEmailDto } from './dto/update-email.dto.js';
import { UpdatePasswordDto } from './dto/update-password.dto.js';
import {
  RecoveryQuestionDto,
  ResetPasswordDto,
  SetSecurityQuestionDto,
  VerifyRecoveryAnswerDto,
} from './dto/security-question.dto.js';

describe('AuthService', () => {
  const guardian = {
    id: 'ed224c82-df8b-47c2-ae99-45422d63da72',
    name: 'Responsável',
    email: 'guardian@example.com',
    passwordHash: '',
    securityQuestion: null as string | null,
    securityAnswerHash: null as string | null,
  };
  const prisma = {
    guardian: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  };
  const jwtService = { signAsync: vi.fn().mockResolvedValue('signed-token') };
  let service: AuthService;

  beforeEach(async () => {
    vi.clearAllMocks();
    guardian.passwordHash = await argon2.hash('correct-horse-battery', { type: argon2.argon2id });
    guardian.securityQuestion = 'Qual o nome do seu primeiro pet?';
    guardian.securityAnswerHash = await argon2.hash('tobias', { type: argon2.argon2id });
    prisma.guardian.findUnique.mockResolvedValue({ ...guardian });
    service = new AuthService(prisma as never, jwtService as unknown as JwtService);
  });

  it('normalizes email, checks Argon2id, and returns only the public guardian profile', async () => {
    const result = await service.login({
      email: '  GUARDIAN@EXAMPLE.COM ',
      password: 'correct-horse-battery',
    } as LoginDto);

    expect(prisma.guardian.findUnique).toHaveBeenCalledWith({
      where: { email: 'guardian@example.com' },
      select: { id: true, name: true, email: true, passwordHash: true },
    });
    expect(jwtService.signAsync).toHaveBeenCalledWith({ sub: guardian.id });
    expect(result).toEqual({
      accessToken: 'signed-token',
      expiresIn: 1800,
      guardian: { id: guardian.id, name: guardian.name, email: guardian.email },
    });
  });

  it('uses the same unauthorized response for an unknown email and a wrong password', async () => {
    prisma.guardian.findUnique.mockResolvedValue(null);
    await expect(service.login({ email: 'missing@example.com', password: 'guess' } as LoginDto))
      .rejects.toMatchObject({ status: 401, response: { message: 'Email ou senha inválidos.' } });

    prisma.guardian.findUnique.mockResolvedValue({ ...guardian });
    await expect(service.login({ email: guardian.email, password: 'wrong-password' } as LoginDto))
      .rejects.toMatchObject({ status: 401, response: { message: 'Email ou senha inválidos.' } });
  });

  it('registers a guardian with normalized name/email and Argon2id hash and rejects duplicate emails', async () => {
    prisma.guardian.create.mockImplementation(async ({ data }: { data: { name: string; email: string; passwordHash: string } }) => ({
      id: guardian.id,
      name: data.name,
      email: data.email,
    }));

    const created = await service.register({
      name: '  Ana Silva  ',
      email: '  ANA@EXAMPLE.COM ',
      password: 'strong-password',
    } as RegisterDto);

    expect(created).toEqual({ id: guardian.id, name: 'Ana Silva', email: 'ana@example.com' });
    const createCall = prisma.guardian.create.mock.calls[0]?.[0] as { data: { passwordHash: string } };
    expect(await argon2.verify(createCall.data.passwordHash, 'strong-password')).toBe(true);

    prisma.guardian.create.mockRejectedValueOnce({ code: 'P2002' });
    await expect(service.register({
      name: 'Ana Silva',
      email: 'ana@example.com',
      password: 'strong-password',
    } as RegisterDto)).rejects.toMatchObject({
      status: 409,
      response: { message: 'Já existe uma conta cadastrada com este e-mail.' },
    });
  });

  it('updates email and password with current password verification and conflict handling', async () => {
    prisma.guardian.update.mockResolvedValueOnce({
      id: guardian.id,
      name: guardian.name,
      email: 'new@example.com',
    });

    const updated = await service.updateEmail(guardian.id, { email: ' NEW@EXAMPLE.COM ' } as UpdateEmailDto);
    expect(updated).toEqual({ id: guardian.id, name: guardian.name, email: 'new@example.com' });

    prisma.guardian.update.mockRejectedValueOnce({ code: 'P2002' });
    await expect(service.updateEmail(guardian.id, { email: 'taken@example.com' } as UpdateEmailDto))
      .rejects.toMatchObject({ status: 409 });

    await expect(service.updatePassword(guardian.id, {
      currentPassword: 'wrong-password',
      newPassword: 'new-password-123',
    } as UpdatePasswordDto)).rejects.toMatchObject({
      status: 400,
      response: { message: 'A senha atual está incorreta.' },
    });

    prisma.guardian.update.mockResolvedValueOnce({ id: guardian.id });
    await service.updatePassword(guardian.id, {
      currentPassword: 'correct-horse-battery',
      newPassword: 'new-password-123',
    } as UpdatePasswordDto);

    const passwordUpdate = prisma.guardian.update.mock.calls.at(-1)?.[0] as { data: { passwordHash: string } };
    expect(await argon2.verify(passwordUpdate.data.passwordHash, 'new-password-123')).toBe(true);
  });

  it('stores, verifies and resets password via normalized security question answers', async () => {
    prisma.guardian.update.mockResolvedValueOnce({ id: guardian.id });
    const saved = await service.setSecurityQuestion(guardian.id, {
      question: '  Qual o nome do seu primeiro pet? ',
      answer: '  Tobiás  ',
    } as SetSecurityQuestionDto);
    expect(saved).toEqual({ question: 'Qual o nome do seu primeiro pet?' });

    const questionUpdate = prisma.guardian.update.mock.calls.at(-1)?.[0] as {
      data: { securityQuestion: string; securityAnswerHash: string };
    };
    expect(await argon2.verify(questionUpdate.data.securityAnswerHash, 'tobias')).toBe(true);

    await expect(service.getRecoveryQuestion({ email: ' GUARDIAN@EXAMPLE.COM ' } as RecoveryQuestionDto))
      .resolves.toEqual({ question: 'Qual o nome do seu primeiro pet?' });

    await expect(service.verifyRecoveryAnswer({
      email: 'guardian@example.com',
      answer: '  Tobiás ',
    } as VerifyRecoveryAnswerDto)).resolves.toEqual({ valid: true });

    await expect(service.verifyRecoveryAnswer({
      email: 'guardian@example.com',
      answer: 'Rex',
    } as VerifyRecoveryAnswerDto)).rejects.toMatchObject({
      status: 400,
      response: { message: 'Resposta de segurança incorreta.' },
    });

    prisma.guardian.update.mockResolvedValueOnce({ id: guardian.id });
    await service.resetPasswordWithSecurityAnswer({
      email: 'guardian@example.com',
      answer: 'tobias',
      newPassword: 'recovered-password',
    } as ResetPasswordDto);

    const resetCall = prisma.guardian.update.mock.calls.at(-1)?.[0] as { data: { passwordHash: string } };
    expect(await argon2.verify(resetCall.data.passwordHash, 'recovered-password')).toBe(true);
  });
  it('does not reveal whether an email has an account or a security question', async () => {
    prisma.guardian.findUnique.mockResolvedValue(null);
    const unknown = await service.getRecoveryQuestion({ email: 'unknown@example.com' } as RecoveryQuestionDto);
    expect(unknown.question).toEqual(expect.any(String));
    await expect(service.getRecoveryQuestion({ email: ' UNKNOWN@example.com ' } as RecoveryQuestionDto))
      .resolves.toEqual(unknown);

    prisma.guardian.findUnique.mockResolvedValue({ ...guardian, securityQuestion: null, securityAnswerHash: null });
    await expect(service.getRecoveryQuestion({ email: 'unknown@example.com' } as RecoveryQuestionDto))
      .resolves.toEqual(unknown);

    const incorrect = { status: 400, response: { message: 'Resposta de segurança incorreta.' } };
    for (const found of [null, { ...guardian, securityQuestion: null, securityAnswerHash: null }, { ...guardian }]) {
      prisma.guardian.findUnique.mockResolvedValue(found);
      await expect(service.verifyRecoveryAnswer({
        email: 'guardian@example.com',
        answer: 'rex',
      } as VerifyRecoveryAnswerDto)).rejects.toMatchObject(incorrect);
    }

    prisma.guardian.findUnique.mockResolvedValue(null);
    await expect(service.resetPasswordWithSecurityAnswer({
      email: 'unknown@example.com',
      answer: 'rex',
      newPassword: 'recovered-password',
    } as ResetPasswordDto)).rejects.toMatchObject(incorrect);
    expect(prisma.guardian.update).not.toHaveBeenCalled();
  });
});

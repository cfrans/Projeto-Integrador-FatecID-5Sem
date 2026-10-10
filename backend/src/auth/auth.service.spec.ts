import * as argon2 from 'argon2';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service.js';
import { LoginDto } from './dto/login.dto.js';

describe('AuthService', () => {
  const guardian = {
    id: 'ed224c82-df8b-47c2-ae99-45422d63da72',
    name: 'Responsável',
    email: 'guardian@example.com',
    passwordHash: '',
  };
  const prisma = { guardian: { findUnique: vi.fn() } };
  const jwtService = { signAsync: vi.fn().mockResolvedValue('signed-token') };
  let service: AuthService;

  beforeEach(async () => {
    guardian.passwordHash = await argon2.hash('correct-horse-battery', { type: argon2.argon2id });
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
});

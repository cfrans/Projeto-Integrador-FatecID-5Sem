import { Body, Controller, Get, HttpCode, Patch, Post, Put, Req, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiProperty, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
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
import { AuthService } from './auth.service.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';

const RECOVERY_THROTTLE = { default: { limit: 5, ttl: 60_000 } };

type AuthenticatedRequest = Request & {
  user: { id: string; name: string; email: string };
};

class GuardianResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;
  @ApiProperty()
  name!: string;
  @ApiProperty({ format: 'email' })
  email!: string;
}

class LoginResponseDto {
  @ApiProperty()
  accessToken!: string;
  @ApiProperty({ example: 1800 })
  expiresIn!: number;
  @ApiProperty({ type: GuardianResponseDto })
  guardian!: GuardianResponseDto;
}

class SecurityQuestionResponseDto {
  @ApiProperty({ nullable: true, type: String })
  question!: string | null;
}

class VerifyRecoveryResponseDto {
  @ApiProperty({ example: true })
  valid!: boolean;
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @UseGuards(ThrottlerGuard)
  @ApiOperation({ summary: 'Cadastra um novo responsável' })
  @ApiBody({ type: RegisterDto })
  @ApiResponse({ status: 201, description: 'Perfil público do responsável criado.', type: GuardianResponseDto })
  @ApiResponse({ status: 400, description: 'Corpo inválido.' })
  @ApiResponse({ status: 409, description: 'E-mail já cadastrado.' })
  @ApiResponse({ status: 503, description: 'Serviço de autenticação indisponível.' })
  @ApiResponse({ status: 429, description: 'Muitas tentativas deste endereço.' })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @UseGuards(ThrottlerGuard)
  @HttpCode(200)
  @ApiOperation({ summary: 'Autentica um responsável' })
  @ApiBody({ type: LoginDto })
  @ApiResponse({ status: 200, description: 'Token de acesso e perfil público do responsável.', type: LoginResponseDto })
  @ApiResponse({ status: 400, description: 'Corpo inválido.' })
  @ApiResponse({ status: 401, description: 'Email ou senha inválidos.' })
  @ApiResponse({ status: 503, description: 'Serviço de autenticação indisponível.' })
  @ApiResponse({ status: 500, description: 'Falha interna inesperada.' })
  @ApiResponse({ status: 429, description: 'Muitas tentativas deste endereço.' })
  login(@Body() credentials: LoginDto) {
    return this.authService.login(credentials);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Restaura a sessão do responsável autenticado' })
  @ApiResponse({ status: 200, description: 'Perfil público do responsável.', type: GuardianResponseDto })
  @ApiResponse({ status: 401, description: 'Token inválido, expirado ou responsável removido.' })
  @ApiResponse({ status: 503, description: 'Serviço de autenticação indisponível.' })
  @ApiResponse({ status: 500, description: 'Falha interna inesperada.' })
  me(@Req() request: AuthenticatedRequest) {
    return request.user;
  }

  @Patch('me/email')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Atualiza o e-mail do responsável autenticado' })
  @ApiBody({ type: UpdateEmailDto })
  @ApiResponse({ status: 200, description: 'Perfil público atualizado.', type: GuardianResponseDto })
  @ApiResponse({ status: 400, description: 'Corpo inválido.' })
  @ApiResponse({ status: 401, description: 'Token inválido, expirado ou responsável removido.' })
  @ApiResponse({ status: 409, description: 'E-mail já cadastrado.' })
  @ApiResponse({ status: 503, description: 'Serviço de autenticação indisponível.' })
  updateEmail(@Req() request: AuthenticatedRequest, @Body() dto: UpdateEmailDto) {
    return this.authService.updateEmail(request.user.id, dto);
  }

  @Patch('me/password')
  @HttpCode(204)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Atualiza a senha do responsável autenticado' })
  @ApiBody({ type: UpdatePasswordDto })
  @ApiResponse({ status: 204, description: 'Senha atualizada.' })
  @ApiResponse({ status: 400, description: 'Corpo inválido ou senha atual incorreta.' })
  @ApiResponse({ status: 401, description: 'Token inválido, expirado ou responsável removido.' })
  @ApiResponse({ status: 503, description: 'Serviço de autenticação indisponível.' })
  updatePassword(@Req() request: AuthenticatedRequest, @Body() dto: UpdatePasswordDto) {
    return this.authService.updatePassword(request.user.id, dto);
  }

  @Get('me/security-question')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Consulta a pergunta de segurança do responsável autenticado' })
  @ApiResponse({ status: 200, description: 'Pergunta de segurança configurada ou nula.', type: SecurityQuestionResponseDto })
  @ApiResponse({ status: 401, description: 'Token inválido, expirado ou responsável removido.' })
  @ApiResponse({ status: 503, description: 'Serviço de autenticação indisponível.' })
  getSecurityQuestion(@Req() request: AuthenticatedRequest) {
    return this.authService.getSecurityQuestion(request.user.id);
  }

  @Put('me/security-question')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Define a pergunta e resposta de segurança do responsável autenticado' })
  @ApiBody({ type: SetSecurityQuestionDto })
  @ApiResponse({ status: 200, description: 'Pergunta de segurança atualizada.', type: SecurityQuestionResponseDto })
  @ApiResponse({ status: 400, description: 'Corpo inválido.' })
  @ApiResponse({ status: 401, description: 'Token inválido, expirado ou responsável removido.' })
  @ApiResponse({ status: 503, description: 'Serviço de autenticação indisponível.' })
  setSecurityQuestion(@Req() request: AuthenticatedRequest, @Body() dto: SetSecurityQuestionDto) {
    return this.authService.setSecurityQuestion(request.user.id, dto);
  }

  @Post('recovery/question')
  @UseGuards(ThrottlerGuard)
  @Throttle(RECOVERY_THROTTLE)
  @HttpCode(200)
  @ApiOperation({ summary: 'Consulta a pergunta de segurança associada a um e-mail' })
  @ApiBody({ type: RecoveryQuestionDto })
  @ApiResponse({ status: 200, description: 'Pergunta configurada ou, para e-mail sem pergunta, uma pergunta fictícia estável.', type: SecurityQuestionResponseDto })
  @ApiResponse({ status: 400, description: 'Corpo inválido.' })
  @ApiResponse({ status: 503, description: 'Serviço de autenticação indisponível.' })
  @ApiResponse({ status: 429, description: 'Muitas tentativas deste endereço.' })
  getRecoveryQuestion(@Body() dto: RecoveryQuestionDto) {
    return this.authService.getRecoveryQuestion(dto);
  }

  @Post('recovery/verify')
  @UseGuards(ThrottlerGuard)
  @Throttle(RECOVERY_THROTTLE)
  @HttpCode(200)
  @ApiOperation({ summary: 'Verifica a resposta da pergunta de segurança' })
  @ApiBody({ type: VerifyRecoveryAnswerDto })
  @ApiResponse({ status: 200, description: 'Resposta validada.', type: VerifyRecoveryResponseDto })
  @ApiResponse({ status: 400, description: 'Corpo inválido ou resposta incorreta.' })
  @ApiResponse({ status: 503, description: 'Serviço de autenticação indisponível.' })
  @ApiResponse({ status: 429, description: 'Muitas tentativas deste endereço.' })
  verifyRecoveryAnswer(@Body() dto: VerifyRecoveryAnswerDto) {
    return this.authService.verifyRecoveryAnswer(dto);
  }

  @Post('recovery/reset')
  @UseGuards(ThrottlerGuard)
  @Throttle(RECOVERY_THROTTLE)
  @HttpCode(204)
  @ApiOperation({ summary: 'Redefine a senha após verificar a resposta da pergunta de segurança' })
  @ApiBody({ type: ResetPasswordDto })
  @ApiResponse({ status: 204, description: 'Senha redefinida.' })
  @ApiResponse({ status: 400, description: 'Corpo inválido ou resposta incorreta.' })
  @ApiResponse({ status: 503, description: 'Serviço de autenticação indisponível.' })
  @ApiResponse({ status: 429, description: 'Muitas tentativas deste endereço.' })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPasswordWithSecurityAnswer(dto);
  }
}

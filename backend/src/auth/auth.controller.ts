import { Body, Controller, Get, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiProperty, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { LoginDto } from './dto/login.dto.js';
import { AuthService } from './auth.service.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';

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

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Autentica um responsável' })
  @ApiBody({ type: LoginDto })
  @ApiResponse({ status: 200, description: 'Token de acesso e perfil público do responsável.', type: LoginResponseDto })
  @ApiResponse({ status: 400, description: 'Corpo inválido.' })
  @ApiResponse({ status: 401, description: 'Email ou senha inválidos.' })
  @ApiResponse({ status: 503, description: 'Serviço de autenticação indisponível.' })
  @ApiResponse({ status: 500, description: 'Falha interna inesperada.' })
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
}

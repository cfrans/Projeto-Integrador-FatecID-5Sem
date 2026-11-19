import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { AgentPairingSessionResponseDto } from './dto/agent-pairing-session-response.dto.js';
import { AgentRegistrationDto } from './dto/agent-registration.dto.js';
import { PairingService } from './pairing.service.js';

@ApiTags('agent')
@Controller('agent')
export class AgentRegistrationController {
  constructor(private readonly pairingService: PairingService) {}

  @Post('registrations')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Registra um computador ainda sem identidade e abre o pareamento',
  })
  @ApiResponse({
    status: 201,
    description: 'Token de uso único e expiração para exibição local em QR.',
    type: AgentPairingSessionResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Dados de registro inválidos.' })
  @ApiResponse({
    status: 409,
    description: 'Credencial já usada por um computador registrado.',
  })
  @ApiResponse({ status: 429, description: 'Muitos registros deste endereço.' })
  register(@Body() body: AgentRegistrationDto) {
    return this.pairingService.register(body);
  }
}

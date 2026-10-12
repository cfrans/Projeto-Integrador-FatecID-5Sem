import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { AgentPairingSessionResponseDto } from './dto/agent-pairing-session-response.dto.js';
import {
  AgentAuthGuard,
  type AuthenticatedAgent,
} from './agent-auth/agent-auth.guard.js';
import { PairingService } from './pairing.service.js';

type AgentRequest = Request & { agent: AuthenticatedAgent };

@ApiTags('agent')
@ApiBearerAuth('agentBearer')
@UseGuards(AgentAuthGuard)
@Controller('agent')
export class AgentPairingController {
  constructor(private readonly pairingService: PairingService) {}

  @Post('pairing-sessions')
  @ApiOperation({
    summary: 'Cria uma sessão após autorização administrativa local no Lux',
  })
  @ApiResponse({
    status: 201,
    description: 'Token de uso único e expiração para exibição local em QR.',
    type: AgentPairingSessionResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Identidade do computador inválida ou revogada.',
  })
  @ApiResponse({
    status: 409,
    description: 'Computador já associado a um responsável.',
  })
  createPairingSession(@Req() request: AgentRequest, @Body() body: unknown) {
    if (
      body !== undefined &&
      (typeof body !== 'object' ||
        body === null ||
        Array.isArray(body) ||
        Object.keys(body).length > 0)
    ) {
      throw new BadRequestException(
        'Esta operação não aceita dados adicionais.',
      );
    }
    return this.pairingService.createSession(request.agent);
  }

  @Get('associations')
  @ApiOperation({
    summary: 'Consulta o histórico de associações deste computador',
  })
  @ApiResponse({
    status: 200,
    description: 'Associações ativas e revogadas do próprio computador.',
  })
  listAssociations(@Req() request: AgentRequest) {
    return this.pairingService.listAgentAssociations(request.agent.deviceId);
  }

  @Delete('associations/:associationId')
  @ApiOperation({ summary: 'Revoga uma associação deste computador' })
  @ApiResponse({ status: 204, description: 'Associação revogada.' })
  @ApiResponse({
    status: 404,
    description: 'Associação inexistente para este computador.',
  })
  @HttpCode(204)
  async revokeAssociation(
    @Req() request: AgentRequest,
    @Param('associationId', new ParseUUIDPipe()) associationId: string,
  ) {
    await this.pairingService.revokeAgentAssociation(
      request.agent,
      associationId,
    );
  }
}

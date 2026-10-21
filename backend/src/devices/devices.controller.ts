import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
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
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { DevicesService } from './devices.service.js';
import { InstalledApplicationResponseDto } from './dto/installed-application-response.dto.js';
import { InstallationRequestResponseDto } from './dto/installation-request-response.dto.js';
import { DeviceResponseDto } from './dto/device-response.dto.js';

type AuthenticatedRequest = Request & {
  user: { id: string };
};

@ApiTags('devices')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('devices')
export class DevicesController {
  constructor(private readonly devicesService: DevicesService) {}

  @Get()
  @ApiOperation({
    summary: 'Lista os registros de dispositivos do responsável autenticado',
  })
  @ApiResponse({
    status: 200,
    description: 'Registros de dispositivos do responsável.',
    type: DeviceResponseDto,
    isArray: true,
  })
  @ApiResponse({ status: 401, description: 'Token inválido ou ausente.' })
  @ApiResponse({
    status: 503,
    description: 'Serviço de dispositivos indisponível.',
  })
  async list(@Req() request: AuthenticatedRequest) {
    return this.devicesService.listForGuardian(request.user.id);
  }

  @Get(':deviceId/applications')
  @ApiOperation({
    summary: 'Consulta o último inventário recebido do computador pareado',
  })
  @ApiResponse({
    status: 200,
    type: InstalledApplicationResponseDto,
    isArray: true,
  })
  @ApiResponse({ status: 400, description: 'Identificador inválido.' })
  @ApiResponse({ status: 401, description: 'Token inválido ou ausente.' })
  @ApiResponse({
    status: 404,
    description: 'Computador sem vínculo ativo com este responsável.',
  })
  @ApiResponse({
    status: 503,
    description: 'Inventário não recebido ou serviço indisponível.',
  })
  async listApplications(
    @Req() request: AuthenticatedRequest,
    @Param('deviceId', new ParseUUIDPipe()) deviceId: string,
  ) {
    return this.devicesService.listApplications(request.user.id, deviceId);
  }

  @Get(':deviceId/installation-requests')
  @ApiOperation({
    summary:
      'Consulta os pedidos de instalação pendentes recebidos do computador pareado',
  })
  @ApiResponse({
    status: 200,
    type: InstallationRequestResponseDto,
    isArray: true,
  })
  @ApiResponse({ status: 400, description: 'Identificador inválido.' })
  @ApiResponse({ status: 401, description: 'Token inválido ou ausente.' })
  @ApiResponse({
    status: 404,
    description: 'Computador sem vínculo ativo com este responsável.',
  })
  @ApiResponse({
    status: 503,
    description: 'Lista não recebida ou serviço indisponível.',
  })
  async listInstallationRequests(
    @Req() request: AuthenticatedRequest,
    @Param('deviceId', new ParseUUIDPipe()) deviceId: string,
  ) {
    return this.devicesService.listInstallationRequests(
      request.user.id,
      deviceId,
    );
  }

  @Delete(':deviceId/association')
  @HttpCode(204)
  @ApiOperation({
    summary: 'Revoga a associação ativa do responsável autenticado',
  })
  @ApiResponse({ status: 204, description: 'Associação revogada.' })
  @ApiResponse({ status: 400, description: 'Identificador inválido.' })
  @ApiResponse({ status: 401, description: 'Token inválido ou ausente.' })
  @ApiResponse({
    status: 404,
    description: 'Associação não encontrada para este responsável.',
  })
  async revokeAssociation(
    @Req() request: AuthenticatedRequest,
    @Param('deviceId', new ParseUUIDPipe()) deviceId: string,
  ) {
    await this.devicesService.revokeAssociation(request.user.id, deviceId);
  }
}

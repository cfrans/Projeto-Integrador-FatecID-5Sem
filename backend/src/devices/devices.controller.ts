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

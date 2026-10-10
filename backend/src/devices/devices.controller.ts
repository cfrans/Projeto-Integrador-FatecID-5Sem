import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
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
  @ApiOperation({ summary: 'Lista os registros de dispositivos do responsável autenticado' })
  @ApiResponse({ status: 200, description: 'Registros de dispositivos do responsável.', type: DeviceResponseDto, isArray: true })
  @ApiResponse({ status: 401, description: 'Token inválido ou ausente.' })
  @ApiResponse({ status: 503, description: 'Serviço de dispositivos indisponível.' })
  async list(@Req() request: AuthenticatedRequest) {
    return this.devicesService.listForGuardian(request.user.id);
  }
}

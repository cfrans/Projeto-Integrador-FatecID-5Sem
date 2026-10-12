import {
  Body,
  Controller,
  HttpCode,
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
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { DeviceResponseDto } from '../devices/dto/device-response.dto.js';
import { PairingService } from './pairing.service.js';
import { PairingValidationResponseDto } from './dto/pairing-validation-response.dto.js';
import { PairingTokenDto } from './dto/pairing-token.dto.js';

type GuardianRequest = Request & { user: { id: string } };

@ApiTags('pairing')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('pairing')
export class PairingController {
  constructor(private readonly pairingService: PairingService) {}

  @Post('validate')
  @HttpCode(200)
  @ApiOperation({ summary: 'Valida uma sessão temporária sem consumi-la' })
  @ApiResponse({
    status: 200,
    description: 'Token válido, computador e expiração.',
    type: PairingValidationResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Formato do token inválido.' })
  @ApiResponse({ status: 401, description: 'Responsável não autenticado.' })
  @ApiResponse({
    status: 410,
    description: 'Token inválido, expirado, consumido ou revogado.',
  })
  validate(@Body() body: PairingTokenDto) {
    return this.pairingService.validate(body.token);
  }

  @Post('complete')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Consome o token e associa o computador ao responsável',
  })
  @ApiResponse({
    status: 200,
    description: 'Computador associado.',
    type: DeviceResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Formato do token inválido.' })
  @ApiResponse({ status: 401, description: 'Responsável não autenticado.' })
  @ApiResponse({
    status: 409,
    description: 'Computador já associado a outro responsável.',
  })
  @ApiResponse({
    status: 410,
    description: 'Token inválido, expirado, consumido ou revogado.',
  })
  complete(@Req() request: GuardianRequest, @Body() body: PairingTokenDto) {
    return this.pairingService.complete(request.user.id, body.token);
  }
}

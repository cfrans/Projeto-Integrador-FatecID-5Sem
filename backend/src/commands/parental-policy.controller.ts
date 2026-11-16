import {
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { CommandsService } from './commands.service.js';

@ApiTags('commands')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('devices/:deviceId/parental-policy')
export class ParentalPolicyController {
  constructor(private readonly commands: CommandsService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  get(
    @Req() request: Request & { user: { id: string } },
    @Param('deviceId', new ParseUUIDPipe()) deviceId: string,
  ) {
    return this.commands.policy(request.user.id, deviceId);
  }
}

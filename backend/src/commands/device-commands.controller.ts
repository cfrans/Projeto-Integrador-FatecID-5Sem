import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { CreateCommandDto } from './dto/command.dto.js';
import { CommandsService } from './commands.service.js';

@ApiTags('commands')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('devices/:deviceId/commands')
export class DeviceCommandsController {
  constructor(private readonly commands: CommandsService) {}

  @Post()
  @Header('Cache-Control', 'no-store')
  async create(
    @Req() request: Request & { user: { id: string } },
    @Param('deviceId', new ParseUUIDPipe()) deviceId: string,
    @Body() body: CreateCommandDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.commands.create(request.user.id, deviceId, body);
    response.status(result.created ? 201 : 200);
    return result.command;
  }

  @Get(':id')
  @Header('Cache-Control', 'no-store')
  get(
    @Req() request: Request & { user: { id: string } },
    @Param('deviceId', new ParseUUIDPipe()) deviceId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.commands.get(request.user.id, deviceId, id.toLowerCase());
  }
}

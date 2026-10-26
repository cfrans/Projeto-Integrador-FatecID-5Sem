import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import {
  AgentAuthGuard,
  type AuthenticatedAgent,
} from '../pairing/agent-auth/agent-auth.guard.js';
import { ClaimCommandDto, CommandResultDto } from './dto/command.dto.js';
import { CommandsService } from './commands.service.js';

type AgentRequest = Request & { agent: AuthenticatedAgent };

@ApiTags('commands')
@ApiBearerAuth('agentBearer')
@UseGuards(AgentAuthGuard)
@Controller('agent/commands')
export class AgentCommandsController {
  constructor(private readonly commands: CommandsService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  poll(@Req() request: AgentRequest) {
    return this.commands.poll(request.agent);
  }

  @Post(':id/claim')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  claim(
    @Req() request: AgentRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: ClaimCommandDto,
  ) {
    return this.commands.claim(request.agent, id.toLowerCase(), body);
  }

  @Put(':id/result')
  @Header('Cache-Control', 'no-store')
  result(
    @Req() request: AgentRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: CommandResultDto,
  ) {
    return this.commands.result(request.agent, id.toLowerCase(), body);
  }
}

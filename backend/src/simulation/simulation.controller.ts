import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Patch,
  Post,
  Put,
  Param,
  ParseUUIDPipe,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import {
  AgentAuthGuard,
  type AuthenticatedAgent,
} from '../pairing/agent-auth/agent-auth.guard.js';
import { SimulationService } from './simulation.service.js';

@ApiTags('simulation')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('simulation')
export class SimulationController {
  constructor(private readonly simulation: SimulationService) {}

  @Post('devices')
  @Header('Cache-Control', 'no-store')
  register(@Body() body: unknown) {
    return this.simulation.register(body);
  }

  @Get('devices/:id')
  @Header('Cache-Control', 'no-store')
  read(
    @Req() request: Request & { user: { id: string } },
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.simulation.read(id, request.user.id);
  }

  @Patch('devices/:id')
  @Header('Cache-Control', 'no-store')
  update(
    @Req() request: Request & { user: { id: string } },
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: unknown,
  ) {
    return this.simulation.update(id, request.user.id, body);
  }
}

@ApiTags('simulation')
@ApiBearerAuth('agentBearer')
@UseGuards(AgentAuthGuard)
@Controller('agent/simulation')
export class AgentSimulationController {
  constructor(private readonly simulation: SimulationService) {}

  @Delete()
  @Header('Cache-Control', 'no-store')
  reset(@Req() request: Request & { agent: AuthenticatedAgent }) {
    return this.simulation.reset(request.agent.deviceId, request.agent.id);
  }

  @Get()
  @Header('Cache-Control', 'no-store')
  read(@Req() request: Request & { agent: AuthenticatedAgent }) {
    return this.simulation.read(request.agent.deviceId);
  }

  @Put()
  @Header('Cache-Control', 'no-store')
  acknowledge(
    @Req() request: Request & { agent: AuthenticatedAgent },
    @Body() body: unknown,
  ) {
    return this.simulation.acknowledge(request.agent.deviceId, body);
  }

  @Post('heartbeat')
  @Header('Cache-Control', 'no-store')
  heartbeat(
    @Req() request: Request & { agent: AuthenticatedAgent },
    @Body() body: unknown,
  ) {
    return this.simulation.heartbeat(request.agent.deviceId, body);
  }
}

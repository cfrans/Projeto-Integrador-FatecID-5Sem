import {
  Body,
  Controller,
  Header,
  HttpCode,
  Put,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import {
  AgentAuthGuard,
  type AuthenticatedAgent,
} from '../pairing/agent-auth/agent-auth.guard.js';
import { AgentReportDto } from './dto/report.dto.js';
import { ReportsService } from './reports.service.js';

type AgentRequest = Request & { agent: AuthenticatedAgent };

@ApiTags('agent')
@ApiBearerAuth('agentBearer')
@UseGuards(AgentAuthGuard)
@Controller('agent/reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Put()
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Recebe o relatório autenticado do computador' })
  @ApiResponse({ status: 201, description: 'Relatório aceito.' })
  @ApiResponse({ status: 200, description: 'Relatório repetido e idempotente.' })
  @ApiResponse({ status: 401, description: 'Identidade do computador inválida ou revogada.' })
  @ApiResponse({ status: 409, description: 'reportId já usado com conteúdo diferente.' })
  async ingest(
    @Req() request: AgentRequest,
    @Body() body: AgentReportDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.reports.ingest(request.agent, body);
    response.status(result.created ? 201 : 200);
    return result.receipt;
  }
}

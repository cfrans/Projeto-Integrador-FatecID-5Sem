import { Module } from '@nestjs/common';
import { AgentAuthGuard } from '../pairing/agent-auth/agent-auth.guard.js';
import { ReportsController } from './reports.controller.js';
import { ReportsService } from './reports.service.js';

@Module({
  controllers: [ReportsController],
  providers: [AgentAuthGuard, ReportsService],
})
export class AgentModule {}

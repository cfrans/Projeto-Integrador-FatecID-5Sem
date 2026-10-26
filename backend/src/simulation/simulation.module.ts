import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { AgentAuthGuard } from '../pairing/agent-auth/agent-auth.guard.js';
import {
  SimulationController,
  AgentSimulationController,
} from './simulation.controller.js';
import { SimulationService } from './simulation.service.js';

@Module({
  imports: [AuthModule],
  controllers: [SimulationController, AgentSimulationController],
  providers: [SimulationService, AgentAuthGuard],
})
export class SimulationModule {}

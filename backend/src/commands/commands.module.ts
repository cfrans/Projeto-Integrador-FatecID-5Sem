import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { AgentAuthGuard } from '../pairing/agent-auth/agent-auth.guard.js';
import { DeviceCommandsController } from './device-commands.controller.js';
import { AgentCommandsController } from './agent-commands.controller.js';
import { ParentalPolicyController } from './parental-policy.controller.js';
import { CommandsService } from './commands.service.js';

@Module({
  imports: [AuthModule],
  controllers: [
    DeviceCommandsController,
    AgentCommandsController,
    ParentalPolicyController,
  ],
  providers: [CommandsService, AgentAuthGuard],
})
export class CommandsModule {}

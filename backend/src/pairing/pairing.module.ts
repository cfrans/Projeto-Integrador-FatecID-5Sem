import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PairingController } from './pairing.controller.js';
import { PairingService } from './pairing.service.js';
import { AgentPairingController } from './agent-pairing.controller.js';
import { AgentRegistrationController } from './agent-registration.controller.js';
import { AgentAuthGuard } from './agent-auth/agent-auth.guard.js';

@Module({
  imports: [AuthModule],
  controllers: [
    PairingController,
    AgentPairingController,
    AgentRegistrationController,
  ],
  providers: [PairingService, AgentAuthGuard],
  exports: [PairingService],
})
export class PairingModule {}

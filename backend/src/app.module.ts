import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { AuthModule } from './auth/auth.module.js';
import { DevicesModule } from './devices/devices.module.js';
import { PairingModule } from './pairing/pairing.module.js';
import { SimulationModule } from './simulation/simulation.module.js';
import { CommandsModule } from './commands/commands.module.js';
import { AgentModule } from './agent/agent.module.js';

@Module({
  imports: [
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 20 }]),
    PrismaModule,
    AuthModule,
    DevicesModule,
    PairingModule,
    CommandsModule,
    AgentModule,
    SimulationModule,
  ],
  controllers: [AppController],
})
export class AppModule {}

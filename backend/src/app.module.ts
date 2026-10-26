import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { AuthModule } from './auth/auth.module.js';
import { DevicesModule } from './devices/devices.module.js';
import { PairingModule } from './pairing/pairing.module.js';
import { SimulationModule } from './simulation/simulation.module.js';

@Module({
  imports: [PrismaModule, AuthModule, DevicesModule, PairingModule, SimulationModule],
  controllers: [AppController],
})
export class AppModule {}

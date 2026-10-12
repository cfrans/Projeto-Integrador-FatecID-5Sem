import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { DevicesController } from './devices.controller.js';
import { DevicesService } from './devices.service.js';
import { PairingModule } from '../pairing/pairing.module.js';

@Module({
  imports: [AuthModule, PairingModule],
  controllers: [DevicesController],
  providers: [DevicesService],
})
export class DevicesModule {}

import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class DevicesService {
  constructor(private readonly prisma: PrismaService) {}

  async listForGuardian(guardianId: string) {
    let devices;
    try {
      devices = await this.prisma.device.findMany({
        where: { guardianId },
        select: { id: true, name: true, managedUser: true, isDemo: true },
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
      });
    } catch {
      throw new ServiceUnavailableException('Serviço de dispositivos indisponível.');
    }

    return devices.map((device) => ({
      ...device,
      status: 'unverified' as const,
      lastSeen: null,
    }));
  }
}

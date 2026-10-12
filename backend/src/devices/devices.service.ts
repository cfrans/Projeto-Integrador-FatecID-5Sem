import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { PairingService } from '../pairing/pairing.service.js';

@Injectable()
export class DevicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pairingService: PairingService,
  ) {}

  async listForGuardian(guardianId: string) {
    let devices;
    try {
      devices = await this.prisma.device.findMany({
        where: { guardianId },
        select: {
          id: true,
          name: true,
          managedUser: true,
          isDemo: true,
          associations: {
            where: {
              guardianId,
              activeDeviceId: { not: null },
              revokedAt: null,
            },
            select: { id: true },
            take: 1,
          },
        },
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
      });
    } catch {
      throw new ServiceUnavailableException(
        'Serviço de dispositivos indisponível.',
      );
    }

    return devices.map(({ associations, ...device }) => ({
      ...device,
      status: 'unverified' as const,
      lastSeen: null,
      paired: associations.length > 0,
      ...(associations[0] ? { associationId: associations[0].id } : {}),
    }));
  }

  async revokeAssociation(guardianId: string, deviceId: string) {
    await this.pairingService.revokeGuardianAssociation(guardianId, deviceId);
  }
}

import {
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
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

  async listApplications(guardianId: string, deviceId: string) {
    let device;
    try {
      device = await this.prisma.device.findFirst({
        where: {
          id: deviceId,
          guardianId,
          associations: {
            some: { guardianId, activeDeviceId: deviceId, revokedAt: null },
          },
        },
        select: {
          applicationsReportedAt: true,
          applications: {
            select: { id: true, name: true, category: true, allowed: true },
            orderBy: [{ name: 'asc' }, { id: 'asc' }],
          },
        },
      });
    } catch {
      throw new ServiceUnavailableException(
        'Serviço de aplicativos indisponível.',
      );
    }
    if (!device)
      throw new NotFoundException('Computador pareado não encontrado.');
    if (!device.applicationsReportedAt) {
      throw new ServiceUnavailableException(
        'Inventário de aplicativos ainda não recebido do computador.',
      );
    }
    return device.applications;
  }

  async listInstallationRequests(guardianId: string, deviceId: string) {
    let device;
    try {
      device = await this.prisma.device.findFirst({
        where: {
          id: deviceId,
          guardianId,
          associations: {
            some: { guardianId, activeDeviceId: deviceId, revokedAt: null },
          },
        },
        select: {
          installationRequestsReportedAt: true,
          installationRequests: {
            where: { status: 'PENDING' },
            select: {
              id: true,
              applicationName: true,
              requesterName: true,
              requestedAt: true,
              ageRating: true,
            },
            orderBy: [{ requestedAt: 'asc' }, { id: 'asc' }],
          },
        },
      });
    } catch {
      throw new ServiceUnavailableException(
        'Serviço de pedidos de instalação indisponível.',
      );
    }
    if (!device)
      throw new NotFoundException('Computador pareado não encontrado.');
    if (!device.installationRequestsReportedAt) {
      throw new ServiceUnavailableException(
        'Lista de pedidos de instalação ainda não recebida do computador.',
      );
    }
    return device.installationRequests.map((request) => ({
      ...request,
      requestedAt: request.requestedAt.toISOString(),
    }));
  }

  async revokeAssociation(guardianId: string, deviceId: string) {
    await this.pairingService.revokeGuardianAssociation(guardianId, deviceId);
  }
}

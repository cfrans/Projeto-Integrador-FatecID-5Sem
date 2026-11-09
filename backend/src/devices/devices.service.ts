import {
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { PairingService } from '../pairing/pairing.service.js';
import { simulationPresence } from '../simulation/simulation-presence.js';

type DeviceOverview = {
  id: string;
  name: string;
  managedUser: string | null;
  isDemo: number | boolean;
  associationId: string | null;
  lastSeenAt: Date | null;
};

@Injectable()
export class DevicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pairingService: PairingService,
  ) {}

  async listForGuardian(guardianId: string) {
    let devices;
    try {
      devices = await this.prisma.$queryRaw<DeviceOverview[]>`
        SELECT id, name, managedUser, isDemo, associationId, lastSeenAt
        FROM vw_device_overview WHERE guardianId = ${guardianId}
        ORDER BY name ASC, id ASC
      `;
    } catch {
      throw new ServiceUnavailableException(
        'Serviço de dispositivos indisponível.',
      );
    }

    return devices.map(({ associationId, lastSeenAt, isDemo, ...device }) => ({
      ...device,
      isDemo: Boolean(isDemo),
      ...simulationPresence(isDemo ? lastSeenAt : null),
      paired: associationId !== null,
      ...(associationId ? { associationId } : {}),
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

  async listInstallationRequests(guardianId: string, deviceId: string, history = false) {
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
          associations: {
            where: { guardianId, activeDeviceId: deviceId, revokedAt: null },
            select: { createdAt: true },
            take: 1,
          },
          installationRequests: {
            where: { status: history ? { in: ['APPROVED', 'DENIED'] } : 'PENDING' },
            select: {
              id: true,
              applicationName: true,
              requesterName: true,
              requestedAt: true,
              ageRating: true,
              ...(history ? { status: true } : {}),
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
    const requests = history ? device.installationRequests.filter((request) =>
      device.associations[0] && request.requestedAt >= device.associations[0].createdAt,
    ) : device.installationRequests;
    return requests.map((request) => ({
      ...request,
      requestedAt: request.requestedAt.toISOString(),
    }));
  }

  async revokeAssociation(guardianId: string, deviceId: string) {
    await this.pairingService.revokeGuardianAssociation(guardianId, deviceId);
  }
}

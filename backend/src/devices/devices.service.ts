import {
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { PairingService } from '../pairing/pairing.service.js';
import { simulationPresence } from '../simulation/simulation-presence.js';

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
          agentIdentity: { select: { revokedAt: true } },
          associations: {
            where: {
              guardianId,
              activeDeviceId: { not: null },
              revokedAt: null,
            },
            select: { id: true, simulation: { select: { lastSeenAt: true } } },
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

    return devices.map(({ associations, agentIdentity, ...device }) => ({
      ...device,
      ...simulationPresence(
        device.isDemo && agentIdentity?.revokedAt === null
          ? (associations[0]?.simulation?.lastSeenAt ?? null)
          : null,
      ),
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

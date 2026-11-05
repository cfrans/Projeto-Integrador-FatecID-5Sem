import {
  ConflictException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { AgentReport } from '../../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AuthenticatedAgent } from '../pairing/agent-auth/agent-auth.guard.js';
import type { AgentReportDto } from './dto/report.dto.js';

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${canonical(entry)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function reportHash(report: AgentReportDto): string {
  return createHash('sha256').update(canonical(report)).digest('hex');
}

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async ingest(agent: AuthenticatedAgent, report: AgentReportDto) {
    const contentHash = reportHash(report);
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const device = await tx.device.findUnique({
            where: { id: agent.deviceId },
            select: { id: true, isDemo: true },
          });
          if (!device) throw new UnauthorizedException('Dispositivo inválido.');

          const identity = await tx.agentIdentity.findFirst({
            where: { id: agent.id, deviceId: device.id, revokedAt: null },
            select: { id: true },
          });
          const association = await tx.deviceAssociation.findFirst({
            where: {
              deviceId: device.id,
              activeDeviceId: device.id,
              revokedAt: null,
            },
            select: { id: true },
          });
          if (!identity || !association)
            throw new UnauthorizedException('Identidade ou vínculo inválido.');

          const existing = await tx.agentReport.findUnique({
            where: {
              deviceId_reportId: { deviceId: device.id, reportId: report.reportId },
            },
          });
          if (existing) {
            if (existing.contentHash !== contentHash)
              throw new ConflictException('reportId já usado com outro conteúdo.');
            return { created: false, receipt: this.receipt(existing) };
          }

          const now = new Date();
          const applications = report.applications.map((application) => ({
            ...application,
            deviceId: device.id,
          }));
          const requests = report.installationRequests.map((request) => ({
            ...request,
            deviceId: device.id,
            requestedAt: new Date(request.requestedAt),
          }));

          await tx.installedApplication.deleteMany({ where: { deviceId: device.id } });
          await tx.installedApplication.createMany({ data: applications });

          const sourceIds = requests.map((request) => request.sourceId);
          await tx.installationRequest.deleteMany({
            where: {
              deviceId: device.id,
              sourceId: { notIn: sourceIds.length ? sourceIds : ['__empty_report__'] },
              status: 'PENDING',
            },
          });
          for (const request of requests) {
            await tx.installationRequest.upsert({
              where: {
                deviceId_sourceId: { deviceId: device.id, sourceId: request.sourceId },
              },
              create: { ...request, status: 'PENDING' },
              update: {
                applicationName: request.applicationName,
                requesterName: request.requesterName,
                requestedAt: request.requestedAt,
                ageRating: request.ageRating,
              },
            });
          }

          const saved = await tx.agentReport.create({
            data: {
              deviceId: device.id,
              reportId: report.reportId,
              contentHash,
              collectedAt: new Date(report.collectedAt),
              receivedAt: now,
              applicationsCount: applications.length,
              installationRequestsCount: requests.length,
            },
          });
          await tx.device.update({
            where: { id: device.id },
            data: {
              applicationsReportedAt: now,
              installationRequestsReportedAt: now,
            },
          });
          return { created: true, receipt: this.receipt(saved) };
        },
        { isolationLevel: 'ReadCommitted' },
      );
    } catch (error) {
      if (error instanceof ConflictException || error instanceof UnauthorizedException)
        throw error;
      throw new ServiceUnavailableException('Serviço de relatórios indisponível.');
    }
  }

  private receipt(report: AgentReport) {
    return {
      reportId: report.reportId,
      accepted: true,
      receivedAt: report.receivedAt.toISOString(),
      applicationsReportedAt: report.receivedAt.toISOString(),
      installationRequestsReportedAt: report.receivedAt.toISOString(),
    };
  }
}

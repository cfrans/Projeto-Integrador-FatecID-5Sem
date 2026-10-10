import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiOkResponse, ApiServiceUnavailableResponse, ApiTags } from '@nestjs/swagger';
import { PrismaService } from './prisma/prisma.service.js';

@ApiTags('health')
@Controller()
export class AppController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('health')
  @ApiOkResponse({ description: 'API e conexão MySQL disponíveis.' })
  @ApiServiceUnavailableResponse({ description: 'Banco de dados indisponível.' })
  async getHealth(): Promise<{ status: 'ok'; database: 'ok' }> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ok', database: 'ok' };
    } catch {
      throw new ServiceUnavailableException({ status: 'error', database: 'unavailable' });
    }
  }
}

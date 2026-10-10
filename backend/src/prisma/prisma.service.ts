import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../../generated/prisma/client.js';
import { getMysqlConnection } from '../config/mysql-connection.js';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    const connection = getMysqlConnection();
    const adapter = new PrismaMariaDb({
      host: connection.host,
      port: connection.port,
      database: connection.database,
      user: connection.user,
      password: connection.password,
      allowPublicKeyRetrieval: process.env.MYSQL_ALLOW_PUBLIC_KEY_RETRIEVAL === 'true',
      connectionLimit: 5,
    });

    super({ adapter });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    await this.$queryRaw`SELECT 1`;
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}

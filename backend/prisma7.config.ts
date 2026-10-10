import { defineConfig } from 'prisma/config';
import { getMysqlConnection, getMysqlUrl } from './src/config/mysql-connection.js';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations', seed: 'node dist/prisma/seed.js' },
  datasource: { url: getMysqlUrl(getMysqlConnection()) },
});

import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../generated/prisma/client.js';
import { getMysqlConnection } from '../src/config/mysql-connection.js';

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} é obrigatório para o seed demonstrativo.`);
  return value;
}

async function main(): Promise<void> {
  if (process.env.NODE_ENV !== 'development') {
    throw new Error('O seed de dispositivos só pode ser executado com NODE_ENV=development.');
  }

  const email = required('DEV_GUARDIAN_EMAIL').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    throw new Error('DEV_GUARDIAN_EMAIL deve ser um email válido com até 254 caracteres.');
  }

  const connection = getMysqlConnection();
  const adapter = new PrismaMariaDb({
    ...connection,
    allowPublicKeyRetrieval: process.env.MYSQL_ALLOW_PUBLIC_KEY_RETRIEVAL === 'true',
    connectionLimit: 2,
  });
  const prisma = new PrismaClient({ adapter });
  try {
    const guardian = await prisma.guardian.findUnique({ where: { email }, select: { id: true } });
    if (!guardian) throw new Error(`Não existe responsável para o email ${email}; nenhum dispositivo foi criado.`);

    const fixtures = [
      { name: 'Notebook de demonstração', managedUser: 'usuario-ficticio' },
      { name: 'Computador de demonstração', managedUser: null },
    ];
    for (const fixture of fixtures) {
      const existing = await prisma.device.findFirst({
        where: { guardianId: guardian.id, isDemo: true, name: fixture.name },
        select: { id: true },
      });
      if (!existing) {
        await prisma.device.create({ data: { ...fixture, guardianId: guardian.id, isDemo: true } });
      }
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Falha desconhecida ao criar dispositivos demonstrativos.');
  process.exitCode = 1;
});

import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import * as argon2 from 'argon2';
import { PrismaClient } from '../generated/prisma/client.js';
import { getMysqlConnection } from '../src/config/mysql-connection.js';

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} é obrigatório para o seed de desenvolvimento.`);
  return value;
}

async function main(): Promise<void> {
  if (process.env.NODE_ENV !== 'development') {
    throw new Error('O seed de responsável só pode ser executado com NODE_ENV=development.');
  }

  const email = required('DEV_GUARDIAN_EMAIL').trim().toLowerCase();
  const name = required('DEV_GUARDIAN_NAME').trim();
  const password = required('DEV_GUARDIAN_PASSWORD');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    throw new Error('DEV_GUARDIAN_EMAIL deve ser um email válido com até 254 caracteres.');
  }
  if (name.length < 1 || name.length > 100) {
    throw new Error('DEV_GUARDIAN_NAME deve conter entre 1 e 100 caracteres.');
  }
  if (password.length < 12 || password.length > 128) {
    throw new Error('DEV_GUARDIAN_PASSWORD deve conter entre 12 e 128 caracteres.');
  }

  const connection = getMysqlConnection();
  const adapter = new PrismaMariaDb({
    ...connection,
    allowPublicKeyRetrieval: process.env.MYSQL_ALLOW_PUBLIC_KEY_RETRIEVAL === 'true',
    connectionLimit: 2,
  });
  const prisma = new PrismaClient({ adapter });
  try {
    const existing = await prisma.guardian.findUnique({ where: { email }, select: { id: true } });
    if (existing) throw new Error(`Já existe responsável para o email ${email}; seed não alterou dados.`);

    await prisma.guardian.create({
      data: {
        email,
        name,
        passwordHash: await argon2.hash(password, { type: argon2.argon2id }),
      },
    });
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Falha desconhecida ao criar responsável.');
  process.exitCode = 1;
});

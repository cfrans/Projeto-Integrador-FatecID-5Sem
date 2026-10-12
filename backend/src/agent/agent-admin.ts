import { randomBytes, createHash, randomUUID } from 'node:crypto';
import { open, unlink } from 'node:fs/promises';
import { isAbsolute, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { PrismaService } from '../prisma/prisma.service.js';

type Options = Map<string, string | true>;

function parseOptions(args: string[]) {
  const options: Options = new Map();
  for (let index = 0; index < args.length; index += 1) {
    const key = args[index];
    if (!key?.startsWith('--') || options.has(key))
      throw new Error('Argumentos inválidos.');
    const value = args[index + 1];
    if (!value || value.startsWith('--')) {
      options.set(key, true);
    } else {
      options.set(key, value);
      index += 1;
    }
  }
  return options;
}

function requiredValue(options: Options, key: string) {
  const value = options.get(key);
  if (typeof value !== 'string' || !value.trim())
    throw new Error(`Informe ${key}.`);
  return value;
}

async function provision(args: string[]) {
  const options = parseOptions(args);
  const allowed = new Set(['--name', '--output', '--demo']);
  if ([...options.keys()].some((key) => !allowed.has(key)))
    throw new Error('Argumentos inválidos.');
  const name = requiredValue(options, '--name').trim();
  if (name.length > 100)
    throw new Error('--name deve ter no máximo 100 caracteres.');
  const output = requiredValue(options, '--output');
  if (!isAbsolute(output))
    throw new Error('--output precisa ser um caminho absoluto.');
  if (options.has('--demo') && options.get('--demo') !== true)
    throw new Error('--demo não aceita valor.');
  const isDemo = options.get('--demo') === true;
  if (isDemo && process.env.NODE_ENV !== 'development') {
    throw new Error('--demo só pode ser usado com NODE_ENV=development.');
  }

  const credential = randomBytes(32).toString('base64url');
  const deviceId = randomUUID();
  const identityId = randomUUID();
  let fileCreated = false;
  const prisma = new PrismaService();
  try {
    await prisma.$connect();
    await prisma.$transaction(async (tx) => {
      await tx.device.create({
        data: { id: deviceId, name, isDemo, guardianId: null },
      });
      await tx.agentIdentity.create({
        data: {
          id: identityId,
          deviceId,
          credentialHash: createHash('sha256').update(credential).digest('hex'),
        },
      });
      const file = await open(output, 'wx', 0o600);
      fileCreated = true;
      try {
        await file.writeFile(credential, { encoding: 'utf8' });
        await file.chmod(0o600);
      } finally {
        await file.close();
      }
    });
    process.stdout.write(
      `Computador provisionado: ${deviceId}\nCredencial salva em: ${resolve(output)}\n`,
    );
  } catch (error) {
    if (fileCreated) await unlink(output).catch(() => undefined);
    if (error instanceof Error && error.message.startsWith('--')) throw error;
    throw new Error('Provisionamento falhou; nenhum segredo foi emitido.');
  } finally {
    await prisma.$disconnect();
  }
}

async function revoke(args: string[]) {
  const options = parseOptions(args);
  if (options.size !== 1 || !options.has('--device-id'))
    throw new Error('Use --device-id <uuid>.');
  const deviceId = requiredValue(options, '--device-id');
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      deviceId,
    )
  )
    throw new Error('--device-id inválido.');
  const prisma = new PrismaService();
  try {
    await prisma.$connect();
    await prisma.$transaction(async (tx) => {
      const [device] = await tx.$queryRaw<
        { id: string }[]
      >`SELECT id FROM Device WHERE id = ${deviceId} FOR UPDATE`;
      if (!device) throw new Error('Computador não encontrado.');
      const now = new Date();
      await tx.agentIdentity.updateMany({
        where: { deviceId, revokedAt: null },
        data: { revokedAt: now },
      });
      await tx.pairingSession.updateMany({
        where: { deviceId, consumedAt: null, revokedAt: null },
        data: { revokedAt: now },
      });
      const active = await tx.deviceAssociation.findFirst({
        where: { deviceId, activeDeviceId: deviceId, revokedAt: null },
        select: { id: true },
      });
      if (active) {
        await tx.deviceAssociation.update({
          where: { id: active.id },
          data: { revokedAt: now, activeDeviceId: null },
        });
      }
      await tx.device.update({
        where: { id: deviceId },
        data: { guardianId: null },
      });
    });
    process.stdout.write(`Identidade revogada: ${deviceId}\n`);
  } catch {
    throw new Error('Revogação falhou.');
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  const [command, ...args] = process.argv.slice(2);
  if (command === 'provision') return provision(args);
  if (command === 'revoke') return revoke(args);
  throw new Error('Use provision ou revoke.');
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch((error: unknown) => {
    process.stderr.write(
      `${error instanceof Error ? error.message : 'Falha no comando administrativo.'}\n`,
    );
    process.exitCode = 1;
  });
}

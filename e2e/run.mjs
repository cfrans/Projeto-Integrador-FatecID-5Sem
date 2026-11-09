import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { readFile, readdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const envFile = process.argv.find((argument) => argument.startsWith('--env-file='));
if (envFile) process.loadEnvFile(resolve(envFile.slice('--env-file='.length)));
assert.equal(process.env.PIPLUP_TEST_CONTAINER, '1', 'Execute esta suíte pelo docker-compose.test.yml.');
assert.equal(process.env.NODE_ENV, 'test', 'Configure NODE_ENV=test em um arquivo privado de testes.');
assert.match(process.env.MYSQL_DATABASE ?? '', /_test$/, 'Use um banco exclusivo terminado em _test.');
assert.equal(process.env.MYSQL_HOST, 'mysql', 'Use o MySQL isolado do Compose de testes.');

async function runNode(script, args, cwd, extraEnv = {}) {
  const child = spawn(process.execPath, [script, ...args], { cwd, stdio: 'inherit', env: { ...process.env, ...extraEnv } });
  const [code] = await once(child, 'exit');
  assert.equal(code, 0, `Falha ao executar ${script}.`);
}

const backend = resolve(root, '../backend');
const mobile = resolve(root, '../mobile');
await runNode(resolve(backend, 'node_modules/prisma/build/index.js'), ['generate'], backend);
await runNode(resolve(backend, 'node_modules/prisma/build/index.js'), ['migrate', 'deploy'], backend);
await runNode(resolve(backend, 'node_modules/@nestjs/cli/bin/nest.js'), ['build'], backend);
const mysqlTests = (await readdir(resolve(backend, 'test'))).filter((file) => file.endsWith('.mysql-test.mjs')).sort();
await runNode('--test', mysqlTests.map((file) => `test/${file}`), backend);
const client = resolve(root, '../simulated-client');
await runNode('--test', ['test/flow.mysql-test.mjs'], client);

const requireBackend = createRequire(resolve(backend, 'package.json'));
const { NestFactory } = requireBackend('@nestjs/core');
const { ValidationPipe } = requireBackend('@nestjs/common');
const { AppModule } = await import('../backend/dist/src/app.module.js');
const app = await NestFactory.create(AppModule, { logger: false });
app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
app.enableCors();
let server;

try {
  await app.listen(0, '127.0.0.1');
  process.env.PIPLUP_E2E_API_URL = await app.getUrl();
  await runNode(resolve(mobile, 'node_modules/expo/bin/cli'), ['export', '--platform', 'web', '--output-dir', resolve(root, '.web')], mobile, { NODE_ENV: 'production', EXPO_PUBLIC_API_URL: process.env.PIPLUP_E2E_API_URL });
  const webRoot = resolve(root, '.web');
  const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.ico': 'image/x-icon' };
  server = createServer(async (request, response) => {
    try {
      if (!['GET', 'HEAD'].includes(request.method)) { response.writeHead(405).end(); return; }
      const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
      let file = resolve(webRoot, `.${pathname === '/' ? '/index.html' : pathname}`);
      if (!file.startsWith(webRoot + sep)) { response.writeHead(403).end(); return; }
      let content;
      try { content = await readFile(file); }
      catch (error) {
        if (error.code !== 'ENOENT' || extname(pathname)) { response.writeHead(404).end(); return; }
        file = resolve(webRoot, 'index.html');
        content = await readFile(file);
      }
      response.writeHead(200, { 'Content-Type': mime[extname(file)] ?? 'application/octet-stream' });
      response.end(request.method === 'HEAD' ? undefined : content);
    } catch { response.writeHead(500).end(); }
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const cypress = (await import('cypress')).default;
  const options = { project: root, config: { baseUrl: `http://127.0.0.1:${server.address().port}` } };
  const result = await cypress.run({ ...options, browser: process.env.PIPLUP_TEST_BROWSER ?? 'electron' });
  process.exitCode = result.failures || result.totalFailed ? 1 : 0;
} finally {
  if (server?.listening) { server.close(); await once(server, 'close'); }
  await app.close();
}

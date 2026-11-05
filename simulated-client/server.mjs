import { createServer } from 'node:http';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import QRCode from 'qrcode';
import { applicationCatalog, approvedApplications } from './catalog.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function backendUrl(value, allowLanHttp = false) {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || url.pathname !== '/') throw new Error('Use somente a origem HTTP/HTTPS da API.');
  if (url.protocol === 'http:' && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) && !allowLanHttp) throw new Error('HTTP fora do próprio PC exige PIPLUP_ALLOW_LAN_HTTP=true, em rede de desenvolvimento confiável.');
  return url.origin;
}

export function validateSnapshot(value) {
  const settings = value?.settings;
  const connection = value?.connection;
  if (!connection || !(connection.status === 'unverified' ? connection.lastSeen === null
    : ['online', 'offline'].includes(connection.status) && typeof connection.lastSeen === 'string'
      && Number.isFinite(Date.parse(connection.lastSeen)))) throw new Error('A API retornou presença incompatível.');
  if (!value || !uuid.test(value.associationId) || !Number.isSafeInteger(value.revision) || value.revision < 1
    || !(value.appliedRevision === null || (Number.isSafeInteger(value.appliedRevision) && value.appliedRevision >= 1 && value.appliedRevision <= value.revision))
    || !(value.appliedAt === null || (typeof value.appliedAt === 'string' && Number.isFinite(Date.parse(value.appliedAt))))
    || !settings || typeof settings.blockBrowsers !== 'boolean' || typeof settings.blockInstallation !== 'boolean'
    || !['L', '10', '12', '16', '18'].includes(settings.ageRating)
    || !settings.allowedBrowsers || !['firefox', 'chromium', 'brave', 'gnome-web'].every((id) => typeof settings.allowedBrowsers[id] === 'boolean')
    || !settings.applicationRules || typeof settings.applicationRules !== 'object' || Array.isArray(settings.applicationRules)
    || !Object.entries(settings.applicationRules).every(([id, allowed]) => uuid.test(id) && typeof allowed === 'boolean')
    || !settings.installationDecisions || typeof settings.installationDecisions !== 'object' || Array.isArray(settings.installationDecisions)
    || !Object.entries(settings.installationDecisions).every(([id, decision]) => uuid.test(id) && ['APPROVED', 'DENIED'].includes(decision))) throw new Error('A API retornou configurações incompatíveis.');
  return value;
}

export async function createSimulator({ apiUrl = 'http://127.0.0.1:3000', statePath = resolve(root, '.state/identity.json'), allowLanHttp = false, fetchImpl = fetch } = {}) {
  const origin = backendUrl(apiUrl, allowLanHttp);
  let identity = null;
  try {
    identity = JSON.parse(await readFile(statePath, 'utf8'));
    if (identity.backendUrl !== origin || !/^[A-Za-z0-9_-]{43}$/.test(identity.credential) || !uuid.test(identity.device?.id) || !Array.isArray(identity.applications) || !Array.isArray(identity.installationRequests)) throw new Error('Identidade local incompatível com esta API.');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  let snapshot = null;
  let pairing = null;
  let error = '';
  let connected = false;
  let stopped = false;
  let timer;
  let operation = null;
  let reportDirty = true;
  let pollingInterval = null;
  let resetConfirmed = false;

  function startPolling(interval = 2000) {
    pollingInterval = interval;
    clearTimeout(timer);
    stopped = false;
    const poll = async () => { await synchronize(); if (!stopped) timer = setTimeout(() => void poll(), interval); };
    void poll();
  }

  async function leaveComputer() {
    await rm(statePath, { force: true });
    identity = null;
    snapshot = null;
    pairing = null;
    connected = false;
    error = '';
    reportDirty = true;
    resetConfirmed = false;
    stopped = false;
    if (pollingInterval !== null) startPolling(pollingInterval);
  }

  async function persist() {
    await mkdir(dirname(statePath), { recursive: true, mode: 0o700 });
    const temporary = `${statePath}.tmp`;
    await writeFile(temporary, JSON.stringify(identity), { mode: 0o600 });
    await rename(temporary, statePath);
  }

  async function request(path, method = 'GET', body, credential = identity?.credential) {
    let response;
    try {
      response = await fetchImpl(`${origin}${path}`, { method, headers: { ...(credential ? { Authorization: `Bearer ${credential}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(10000), redirect: 'error' });
    } catch { throw new Error('Não foi possível alcançar a API. Confira o endereço e se o backend está iniciado.'); }
    if (!response.ok) {
      const failure = new Error(({ 400: 'Confira os dados informados.', 401: 'Credenciais inválidas ou revogadas.', 404: 'Aguardando pareamento. Leia o QR no app.', 409: 'O vínculo ou as configurações mudaram. Tente novamente.', 503: 'Backend indisponível. Tente novamente.' })[response.status] ?? 'A API recusou a operação.');
      failure.status = response.status;
      throw failure;
    }
    const raw = await response.text();
    if (raw.length > 1024 * 1024) throw new Error('Resposta da API excedeu o limite.');
    try { return JSON.parse(raw); } catch { throw new Error('Resposta da API inválida.'); }
  }

  async function exclusive(action) {
    if (operation) throw new Error('Aguarde a operação atual terminar.');
    operation = action();
    try { return await operation; } finally { operation = null; }
  }

  async function synchronize() {
    if (!identity || operation || stopped) return;
    await exclusive(async () => {
      try {
        const desired = validateSnapshot(await request('/agent/simulation'));
        const next = validateSnapshot(await request('/agent/simulation/heartbeat', 'POST', { associationId: desired.associationId }));
        if (next.associationId !== desired.associationId) throw new Error('O vínculo mudou. Consulte novamente.');
        if (snapshot && snapshot.associationId !== next.associationId) snapshot = null;
        const applications = approvedApplications(identity.applications, identity.installationRequests, next.settings.installationDecisions);
        if (applications.length !== identity.applications.length) {
          identity.applications = applications;
          await persist();
          reportDirty = true;
        }
        const needsReport = reportDirty || !snapshot || snapshot.associationId !== next.associationId || snapshot.revision !== next.revision;
        const acknowledged = needsReport ? validateSnapshot(await request('/agent/simulation', 'PUT', { associationId: next.associationId, revision: next.revision, applications: identity.applications, installationRequests: identity.installationRequests })) : next;
        if (acknowledged.associationId !== next.associationId || acknowledged.revision !== next.revision || acknowledged.appliedRevision !== next.revision) throw new Error('Confirmação da simulação incompatível.');
        snapshot = acknowledged;
        reportDirty = false;
        pairing = null;
        connected = true;
        error = '';
      } catch (cause) {
        connected = false;
        error = cause.status === 404 ? '' : cause.message;
        if ([401, 404].includes(cause.status)) snapshot = null;
        if (cause.status === 401) stopped = true;
      }
    });
  }

  async function pair() {
    const session = await request('/agent/pairing-sessions', 'POST', {});
    if (typeof session.qrPayload !== 'string' || !/^piplup:\/\/pair\?token=[A-Za-z0-9_-]{43}$/.test(session.qrPayload) || !Number.isFinite(Date.parse(session.expiresAt))) throw new Error('Sessão de pareamento inválida.');
    pairing = { qr: await QRCode.toDataURL(session.qrPayload, { width: 280, margin: 3, errorCorrectionLevel: 'M' }), expiresAt: session.expiresAt };
  }

  function publicState() {
    return { catalog: applicationCatalog.map(({ asset, ...app }) => app), backendUrl: origin, device: identity?.device ?? null, paired: !!snapshot, connected, stopped, error, pairing: pairing && Date.parse(pairing.expiresAt) > Date.now() ? pairing : null, snapshot, applications: identity?.applications ?? [], installationRequests: identity?.installationRequests ?? [] };
  }

  const server = createServer(async (req, res) => {
    const localOrigin = `http://127.0.0.1:${server.address()?.port}`;
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    function json(status, data) { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(data)); }
    if (req.headers.host !== new URL(localOrigin).host || (req.headers.origin && req.headers.origin !== localOrigin)) return json(403, { message: 'Origem não autorizada.' });
    try {
      if (req.method === 'GET' && req.url === '/api/state') return json(200, publicState());
      if (req.method === 'POST' && req.url?.startsWith('/api/')) {
        if (req.headers.origin !== localOrigin || req.headers['content-type'] !== 'application/json') return json(403, { message: 'Origem não autorizada.' });
        let raw = '';
        for await (const chunk of req) { raw += chunk; if (raw.length > 16384) throw new Error('Dados excedem o limite.'); }
        const body = JSON.parse(raw);
        await exclusive(async () => {
          if (req.url === '/api/register') {
            if (identity) throw new Error('Este client já possui um computador cadastrado.');
            const login = await request('/auth/login', 'POST', { email: body.email, password: body.password }, null);
            if (typeof login.accessToken !== 'string') throw new Error('Resposta de autenticação inválida.');
            const result = await request('/simulation/devices', 'POST', { name: body.name, managedUser: body.managedUser || null }, login.accessToken);
            if (!uuid.test(result.device?.id) || result.device?.isDemo !== true || typeof result.device?.name !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(result.credential)) throw new Error('Identidade de demonstração inválida.');
            identity = { backendUrl: origin, device: result.device, credential: result.credential, applications: [['Firefox', 'Navegador'], ['LibreOffice', 'Produtividade'], ['Steam', 'Jogos'], ['Visual Studio Code', 'Desenvolvimento']].map(([name, category]) => ({ id: randomUUID(), name, category })), installationRequests: [] };
            await persist();
            await pair();
          } else if (req.url === '/api/logout' || req.url === '/api/reset') {
            if (!identity || body.deviceId !== identity.device.id || body.confirmed !== true) throw new Error('Confirme a operação para o computador atual.');
            if (req.url === '/api/reset' && !resetConfirmed) {
              const result = await request('/agent/simulation', 'DELETE');
              if (result.deletedDeviceId !== identity.device.id) throw new Error('A API não confirmou a exclusão deste computador.');
              resetConfirmed = true;
              stopped = true;
              connected = false;
              clearTimeout(timer);
            }
            await leaveComputer();
          } else if (req.url === '/api/pair') {
            if (!identity || stopped) throw new Error('Prepare uma identidade válida para parear.');
            await pair();
          } else if (req.url === '/api/installation-request') {
            if (!snapshot || !connected) throw new Error('Conecte e pareie o computador primeiro.');
            const entry = applicationCatalog.find((app) => app.id === body.applicationId || app.name === body.applicationName);
            if (!entry) throw new Error('Selecione um aplicativo do catálogo.');
            if (identity.applications.some((app) => app.name === entry.name)) throw new Error('Este aplicativo já está instalado na simulação.');
            if (identity.installationRequests.some((request) => request.applicationName === entry.name && !snapshot.settings.installationDecisions[request.id])) throw new Error('Este aplicativo já tem um pedido pendente.');
            if (identity.installationRequests.length >= 100) throw new Error('Limite de 100 pedidos desta demonstração atingido.');
            identity.installationRequests.push({ id: randomUUID(), applicationName: entry.name, requesterName: identity.device.managedUser || 'Criança', requestedAt: new Date().toISOString(), ageRating: entry.ageRating });
            await persist();
            reportDirty = true;
          } else { throw new Error('Operação desconhecida.'); }
        });
        error = '';
        return json(200, publicState());
      }
      const logo = applicationCatalog.find((app) => req.url === app.logo);
      if (req.method === 'GET' && logo) {
        res.writeHead(200, { 'Content-Type': 'image/png' });
        return res.end(await readFile(resolve(root, '../mobile/assets', logo.asset)));
      }
      const files = { '/': ['index.html', 'text/html'], '/client.js': ['client.js', 'text/javascript'], '/style.css': ['style.css', 'text/css'], '/piplup.svg': ['piplup.svg', 'image/svg+xml'], '/favicon.png': ['favicon.png', 'image/png'] };
      const file = files[req.url];
      if (req.method !== 'GET' || !file) return json(404, { message: 'Página não encontrada.' });
      res.writeHead(200, { 'Content-Type': file[1].startsWith('text/') ? `${file[1]}; charset=utf-8` : file[1] });
      res.end(await readFile(resolve(root, 'public', file[0])));
    } catch (cause) { json(400, { message: cause instanceof SyntaxError ? 'Dados inválidos.' : cause.message }); }
  });

  return {
    server, synchronize, publicState,
    startPolling,
    async close() { stopped = true; clearTimeout(timer); if (operation) await operation; if (server.listening) await new Promise((done) => server.close(done)); },
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const port = Number(process.env.PIPLUP_CLIENT_PORT ?? 4317);
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Porta local inválida.');
    const client = await createSimulator({ apiUrl: process.env.PIPLUP_API_URL, allowLanHttp: process.env.PIPLUP_ALLOW_LAN_HTTP === 'true', ...(process.env.PIPLUP_CLIENT_STATE ? { statePath: resolve(process.env.PIPLUP_CLIENT_STATE) } : {}) });
    client.server.on('error', () => { console.error('Não foi possível abrir o client. Verifique se a porta está ocupada.'); process.exitCode = 1; });
    client.server.listen(port, '127.0.0.1', () => { console.log(`Client simulado: http://127.0.0.1:${port}`); client.startPolling(); });
    for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { void client.close(); });
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}

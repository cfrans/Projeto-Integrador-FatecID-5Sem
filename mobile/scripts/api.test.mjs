import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { ApiError, api, apiErrorMessage } from '../src/lib/api.ts';
import './devices.test.mjs';
import './pairing.test.mjs';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  api.setAccessToken(null);
  api.onUnauthorized(null);
  api.setDevelopmentHostUri(null);
  process.env.EXPO_PUBLIC_API_URL = 'http://127.0.0.1:3000';
});

test('derives the development API URL from RFC1918 hosts on port 3000', async () => {
  const cases = [
    ['10.0.0.1:8081', '10.0.0.1'],
    ['10.255.255.254:8081', '10.255.255.254'],
    ['172.16.0.1:8081', '172.16.0.1'],
    ['172.31.255.254:8081', '172.31.255.254'],
    ['192.168.0.1:8081', '192.168.0.1'],
    ['192.168.255.254:8081', '192.168.255.254'],
  ];

  delete process.env.EXPO_PUBLIC_API_URL;
  for (const [hostUri, ip] of cases) {
    api.setDevelopmentHostUri(hostUri);
    let requestUrl;
    globalThis.fetch = async (url) => {
      requestUrl = url;
      return Response.json({ ok: true });
    };

    await api.request('/health');
    assert.equal(requestUrl, `http://${ip}:3000/health`);
  }
});

test('explicit API URL takes priority over the development host', async () => {
  process.env.EXPO_PUBLIC_API_URL = 'https://api.example.test/v1/';
  api.setDevelopmentHostUri('192.168.1.25:8081');
  let requestUrl;
  globalThis.fetch = async (url) => {
    requestUrl = url;
    return Response.json({ ok: true });
  };

  await api.request('/health');
  assert.equal(requestUrl, 'https://api.example.test/v1/health');
});

test('invalid explicit API URL does not fall back to a development host', async () => {
  process.env.EXPO_PUBLIC_API_URL = 'https://user:password@api.example.test?key=value';
  api.setDevelopmentHostUri('192.168.1.25:8081');
  globalThis.fetch = () => { throw new Error('fetch must not be called'); };

  await assert.rejects(
    api.request('/health'),
    (error) => error instanceof ApiError && error.kind === 'configuration' && error.message.includes('inválida'),
  );
});

test('rejects invalid explicit API URL query and fragment delimiters', async () => {
  for (const value of ['http://192.168.1.10:3000?', 'http://192.168.1.10:3000#']) {
    process.env.EXPO_PUBLIC_API_URL = value;
    api.setDevelopmentHostUri('192.168.1.25:8081');
    await assert.rejects(api.request('/health'), (error) => error instanceof ApiError && error.kind === 'configuration');
  }
});

test('does not derive URLs for unknown, loopback, public, tunneled or IPv6 hosts', async () => {
  const hostUris = [
    undefined,
    null,
    'localhost:8081',
    '127.0.0.1:8081',
    '172.15.255.254:8081',
    '172.32.0.1:8081',
    '192.167.1.1:8081',
    '8.8.8.8:8081',
    'abc123.ngrok-free.app:8081',
    'https://abc123.trycloudflare.com:8081',
    '[fd00::1]:8081',
  ];

  delete process.env.EXPO_PUBLIC_API_URL;
  for (const hostUri of hostUris) {
    api.setDevelopmentHostUri(hostUri);
    globalThis.fetch = () => { throw new Error('fetch must not be called'); };
    await assert.rejects(
      api.request('/health'),
      (error) => error instanceof ApiError
        && error.kind === 'configuration'
        && error.message.includes('modo LAN')
        && error.message.includes('EXPO_PUBLIC_API_URL'),
    );
  }
});

test('sends the bearer token and reports the token used by an old 401 response', async () => {
  process.env.EXPO_PUBLIC_API_URL = 'http://127.0.0.1:3000';
  api.setAccessToken('old-token');
  let releaseResponse;
  let invalidatedToken;
  globalThis.fetch = (_url, init) => {
    assert.equal(new Headers(init.headers).get('authorization'), 'Bearer old-token');
    return new Promise((resolve) => { releaseResponse = resolve; });
  };
  api.onUnauthorized((token) => { invalidatedToken = token; });

  const request = api.request('/auth/me');
  api.setAccessToken('new-token');
  releaseResponse(new Response(null, { status: 401 }));

  await assert.rejects(request, (error) => error instanceof ApiError && error.kind === 'unauthorized');
  assert.equal(invalidatedToken, 'old-token');
});

test('classifies a missing base URL before attempting a request', async () => {
  delete process.env.EXPO_PUBLIC_API_URL;
  globalThis.fetch = () => { throw new Error('fetch must not be called'); };

  await assert.rejects(
    api.request('/auth/me'),
    (error) => error instanceof ApiError && error.kind === 'configuration',
  );
});

test('sends login credentials as JSON without an authorization header', async () => {
  api.setAccessToken('previous-session-token');
  let requestUrl;
  let requestInit;
  globalThis.fetch = async (url, init) => {
    requestUrl = url;
    requestInit = init;
    return Response.json({
      accessToken: 'new-session-token',
      expiresIn: 1800,
      guardian: { id: 'guardian-1', name: 'Ana', email: 'ana@example.com' },
    });
  };

  const response = await api.request('/auth/login', {
    method: 'POST',
    body: { email: 'ana@example.com', password: 'secret' },
    authenticated: false,
  });

  assert.equal(requestUrl, 'http://127.0.0.1:3000/auth/login');
  assert.equal(requestInit.method, 'POST');
  assert.equal(new Headers(requestInit.headers).get('authorization'), null);
  assert.deepEqual(JSON.parse(requestInit.body), { email: 'ana@example.com', password: 'secret' });
  assert.equal(response.expiresIn, 1800);
});

test('classifies connection failures as unavailable', async () => {
  globalThis.fetch = async () => { throw new Error('network is offline'); };

  await assert.rejects(
    api.request('/auth/me'),
    (error) => error instanceof ApiError
      && error.kind === 'unavailable'
      && error.message.includes('http://127.0.0.1:3000')
      && error.message.includes('backend está iniciado'),
  );
});

test('aborts a stalled request after ten seconds without invalidating the session', async (context) => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  let invalidated = false;
  api.setAccessToken('active-token');
  api.onUnauthorized(() => { invalidated = true; });
  globalThis.fetch = (_url, init) => new Promise((_resolve, reject) => {
    init.signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
  });

  const request = api.request('/devices');
  context.mock.timers.tick(10_000);

  await assert.rejects(request, (error) => error instanceof ApiError && error.kind === 'unavailable');
  assert.equal(invalidated, false);
});

test('classifies backend 400 responses as validation errors', async () => {
  globalThis.fetch = async () => Response.json(
    { message: ['E-mail inválido', 'Senha obrigatória'] },
    { status: 400 },
  );

  await assert.rejects(
    api.request('/auth/login', { method: 'POST', body: { email: 'x', password: '' }, authenticated: false }),
    (error) => error instanceof ApiError
      && error.kind === 'validation'
      && error.status === 400
      && error.message === 'E-mail inválido Senha obrigatória',
  );
});

test('preserves backend service-unavailable messages for the device list', async () => {
  globalThis.fetch = async () => Response.json(
    { message: 'Serviço de dispositivos indisponível.' },
    { status: 503 },
  );

  await assert.rejects(
    api.request('/devices'),
    (error) => error instanceof ApiError
      && error.kind === 'server'
      && apiErrorMessage(error) === 'Serviço de dispositivos indisponível.',
  );
});

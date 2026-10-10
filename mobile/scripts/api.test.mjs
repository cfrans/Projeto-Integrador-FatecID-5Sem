import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { ApiError, api } from '../src/lib/api.ts';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  api.setAccessToken(null);
  api.onUnauthorized(null);
  process.env.EXPO_PUBLIC_API_URL = 'http://127.0.0.1:3000';
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
    (error) => error instanceof ApiError && error.kind === 'unavailable',
  );
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

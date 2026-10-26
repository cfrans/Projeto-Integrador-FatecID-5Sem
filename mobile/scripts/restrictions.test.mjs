import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { api, ApiError } from '../src/lib/api.ts';
import { listInstalledApplications, parseApplicationsResponse, ApplicationsResponseError } from '../src/features/restrictions/services/applications.ts';
import { listInstallationRequests, parseInstallationRequestsResponse, InstallationRequestsResponseError } from '../src/features/restrictions/services/installation-requests.ts';

const application = { id: '0a38ce2d-9654-41f1-8098-944e0874752c', name: 'Firefox', category: 'Browser', allowed: true };
const installation = { id: application.id, applicationName: 'Firefox', requesterName: 'Child', requestedAt: '2026-10-20T12:00:00.000Z', ageRating: 'L' };
const originalFetch = globalThis.fetch;

afterEach(() => { globalThis.fetch = originalFetch; api.setAccessToken(null); });

test('parses persisted application and installation lists including confirmed empty reports', () => {
  assert.deepEqual(parseApplicationsResponse([application]), [application]);
  assert.deepEqual(parseInstallationRequestsResponse([installation]), [installation]);
  assert.deepEqual(parseApplicationsResponse([]), []);
  assert.deepEqual(parseInstallationRequestsResponse([]), []);
});

test('rejects malformed records, identifiers and timestamps at the API boundary', () => {
  for (const value of [null, {}, [null], [{ ...application, id: 'invalid' }], [{ ...application, allowed: 'yes' }], [{ ...application, name: '' }]]) {
    assert.throws(() => parseApplicationsResponse(value), ApplicationsResponseError);
  }
  for (const value of [null, {}, [null], [{ ...installation, requestedAt: 'yesterday' }], [{ ...installation, requestedAt: '2026-99-99T12:00:00.000Z' }], [{ ...installation, id: 'invalid' }]]) {
    assert.throws(() => parseInstallationRequestsResponse(value), InstallationRequestsResponseError);
  }
});

test('queries the selected computer and preserves authorization and report unavailability', async () => {
  process.env.EXPO_PUBLIC_API_URL = 'http://127.0.0.1:3000';
  api.setAccessToken('test-token');
  for (const [list, path, record] of [[listInstalledApplications, 'applications', application], [listInstallationRequests, 'installation-requests', installation]]) {
    globalThis.fetch = async (url, options) => {
      assert.equal(url, `http://127.0.0.1:3000/devices/selected%2Fcomputer/${path}`);
      assert.equal(options.headers.Authorization, 'Bearer test-token');
      return Response.json([record]);
    };
    assert.deepEqual(await list('selected/computer'), [record]);
    for (const status of [404, 503]) {
      globalThis.fetch = async () => Response.json({ message: 'Unavailable' }, { status });
      await assert.rejects(list('selected/computer'), (error) => error instanceof ApiError && error.status === status);
    }
  }
});

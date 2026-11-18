import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { api, ApiError } from '../src/lib/api.ts';
import { configureApplications, listInstalledApplications, parseApplicationsResponse, ApplicationsResponseError } from '../src/features/restrictions/services/applications.ts';
import { listInstallationRequests, parseInstallationRequestsResponse, InstallationRequestsResponseError } from '../src/features/restrictions/services/installation-requests.ts';

const application = { id: '0a38ce2d-9654-41f1-8098-944e0874752c', name: 'Firefox', category: 'Browser', allowed: true, blockable: true, executable: '/usr/bin/firefox' };
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
  for (const value of [null, {}, [null], [{ ...application, id: 'invalid' }], [{ ...application, allowed: 'yes' }], [{ ...application, name: '' }], [{ ...application, blockable: false }], [{ ...application, executable: 'usr/bin/firefox' }], [{ ...application, blockable: undefined }]]) {
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

test('treats inventories without group data, as stored by the backend or omitted, as blockable and ungrouped', () => {
  const { blockable, executable, ...legacy } = application;
  assert.deepEqual(parseApplicationsResponse([legacy]), [{ ...legacy, blockable: true, executable: null }]);
  assert.deepEqual(parseApplicationsResponse([{ ...legacy, blockable: true, executable: null }]), [{ ...legacy, blockable: true, executable: null }]);
});

test('shows a group as blocked when any member is blocked and keeps unblockable apps allowed', () => {
  const ids = ['1', '2', '3', '4', '5'].map((digit) => `${digit.repeat(8)}-0000-4000-8000-000000000000`);
  const office = (id, name) => ({ id, name, category: 'Office', allowed: true, blockable: true, executable: '/usr/bin/libreoffice' });
  const apps = parseApplicationsResponse([
    office(ids[0], 'LibreOffice Writer'),
    office(ids[1], 'LibreOffice Calc'),
    { ...application, id: ids[2] },
    { id: ids[3], name: 'Guia', category: 'Docs', allowed: true, blockable: false, executable: null },
    { id: ids[4], name: 'Terminal', category: 'System', allowed: true, blockable: true, executable: '/usr/bin/ptyxis' },
  ]);
  const configured = configureApplications(apps, { [ids[1]]: false, [ids[3]]: false });
  assert.deepEqual(configured.map((app) => app.allowed), [false, false, true, true, true]);
  assert.deepEqual(configured[0].group.map((app) => app.name), ['LibreOffice Calc']);
  assert.deepEqual(configured[2].group, []);
  assert.deepEqual(configured[3].group, []);
  assert.deepEqual(configureApplications(apps, {}).map((app) => app.allowed), [true, true, true, true, true]);
});

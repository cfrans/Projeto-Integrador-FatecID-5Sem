import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  createHttpDevicesSource,
  DeviceResponseError,
  parseDevicesResponse,
} from '../src/features/devices/services/http-devices.ts';

const apiDevice = {
  id: 'd9cdd54a-0083-4b43-b0d4-a54aa87b8998',
  name: 'Notebook da Ana',
  managedUser: null,
  status: 'unverified',
  lastSeen: null,
  isDemo: true,
};

test('parses the device list contract, including nullable owner and demo fixtures', () => {
  assert.deepEqual(parseDevicesResponse([apiDevice]), [apiDevice]);
  assert.deepEqual(parseDevicesResponse([]), []);
  assert.deepEqual(parseDevicesResponse([{ ...apiDevice, isDemo: false, managedUser: 'Ana' }]), [
    { ...apiDevice, isDemo: false, managedUser: 'Ana' },
  ]);
});

test('rejects malformed list responses and records', () => {
  assert.throws(() => parseDevicesResponse({ devices: [apiDevice] }), DeviceResponseError);
  assert.throws(() => parseDevicesResponse([null]), DeviceResponseError);
  assert.throws(() => parseDevicesResponse([{ ...apiDevice, id: 'demo-id' }]), DeviceResponseError);
  assert.throws(() => parseDevicesResponse([{ ...apiDevice, status: 'online' }]), DeviceResponseError);
  assert.throws(() => parseDevicesResponse([{ ...apiDevice, managedUser: 42 }]), DeviceResponseError);
  assert.throws(() => parseDevicesResponse([{ ...apiDevice, lastSeen: '2026-10-10T12:00:00Z' }]), DeviceResponseError);
  assert.throws(() => parseDevicesResponse([{ ...apiDevice, isDemo: 'true' }]), DeviceResponseError);
});

test('requests only GET /devices and returns the API list unchanged', async () => {
  const request = async (path, options) => {
    assert.equal(path, '/devices');
    assert.deepEqual(options, { method: 'GET' });
    return [apiDevice];
  };

  const source = createHttpDevicesSource(request);
  assert.deepEqual(await source.listPairedComputers(), [apiDevice]);
});

test('propagates API failures without falling back to mock data', async () => {
  const unavailable = new Error('API unavailable');
  let requestCount = 0;
  const source = createHttpDevicesSource(async (path, options) => {
    requestCount += 1;
    assert.equal(path, '/devices');
    assert.deepEqual(options, { method: 'GET' });
    throw unavailable;
  });

  await assert.rejects(source.listPairedComputers(), (error) => error === unavailable);
  assert.equal(requestCount, 1);
});

test('rejects an invalid API response instead of returning mock data', async () => {
  const source = createHttpDevicesSource(async (_path, options) => {
    assert.deepEqual(options, { method: 'GET' });
    return [{ ...apiDevice, status: 'offline' }];
  });

  await assert.rejects(source.listPairedComputers(), DeviceResponseError);
});

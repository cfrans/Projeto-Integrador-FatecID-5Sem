export type HttpPairedComputer = {
  id: string;
  name: string;
  managedUser: string | null;
  status: 'unverified' | 'online' | 'offline';
  lastSeen: string | null;
  isDemo: boolean;
  paired: boolean;
  associationId: string | null;
};

type DeviceRequest = (path: string, options: { method: 'GET' | 'DELETE' }) => Promise<unknown>;

export class DeviceResponseError extends Error {
  constructor() {
    super('The devices API returned an invalid response.');
    this.name = 'DeviceResponseError';
  }
}

function isDevice(value: unknown): value is HttpPairedComputer {
  if (!value || typeof value !== 'object') return false;
  const device = value as Record<string, unknown>;
  return typeof device.id === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(device.id)
    && typeof device.name === 'string'
    && (typeof device.managedUser === 'string' || device.managedUser === null)
    && (device.status === 'unverified'
      ? device.lastSeen === null
      : device.paired === true
        && (device.status === 'online' || device.status === 'offline')
        && typeof device.lastSeen === 'string' && Number.isFinite(Date.parse(device.lastSeen)))
    && typeof device.isDemo === 'boolean'
    && typeof device.paired === 'boolean'
    && (device.paired
      ? typeof device.associationId === 'string'
        && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(device.associationId)
      : device.associationId === null || device.associationId === undefined);
}

export function parseDevicesResponse(value: unknown): HttpPairedComputer[] {
  if (!Array.isArray(value) || !value.every(isDevice)) throw new DeviceResponseError();
  return value;
}

export function createHttpDevicesSource(request: DeviceRequest) {
  return {
    async listPairedComputers() {
      const response = await request('/devices', { method: 'GET' });
      return parseDevicesResponse(response).map(({ paired, ...device }) => ({
        ...device,
        isPaired: paired,
        associationId: paired ? device.associationId : null,
      }));
    },
    async removeAssociation(id: string) {
      await request(`/devices/${encodeURIComponent(id)}/association`, { method: 'DELETE' });
    },
  };
}

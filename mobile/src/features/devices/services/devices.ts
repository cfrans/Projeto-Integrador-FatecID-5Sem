import { mockDevices } from '@/mocks/devices';
import { ApiError, api, apiErrorMessage } from '@/lib/api';
import { createHttpDevicesSource, DeviceResponseError } from './http-devices';

export type ComputerStatus = 'online' | 'offline' | 'unverified';

export type PairedComputer = {
  id: string;
  name: string;
  status: ComputerStatus;
  managedUser: string | null;
  lastSeen: string | null;
  isDemo: boolean;
  isPaired: boolean;
  associationId: string | null;
};

export type DevicesSource = {
  listPairedComputers(): Promise<PairedComputer[]>;
  removeAssociation(id: string): Promise<void>;
};

export type PairingDemoSource = {
  simulatePairing(): Promise<PairedComputer>;
};

export const devices: DevicesSource = createHttpDevicesSource((path, options) => api.request<unknown>(path, options));
export const pairingDemo: PairingDemoSource = mockDevices;

export function devicesErrorMessage(error: unknown) {
  if (error instanceof ApiError && error.kind === 'unauthorized') {
    return 'Sua sessão expirou. Entre novamente.';
  }

  if (error instanceof DeviceResponseError) {
    return 'A API retornou uma lista de dispositivos inválida.';
  }

  return apiErrorMessage(error);
}

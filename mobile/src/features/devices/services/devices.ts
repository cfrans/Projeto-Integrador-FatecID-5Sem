import { mockDevices } from '@/mocks/devices';

export type PairedComputer = {
  id: string;
  name: string;
  status: 'online' | 'offline';
  managedUser: string;
  lastSeen: string | null;
};

export type DevicesSource = {
  listPairedComputers(): Promise<PairedComputer[]>;
};

export const devices: DevicesSource = mockDevices;

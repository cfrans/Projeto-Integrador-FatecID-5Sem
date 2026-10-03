import { mockDevices } from '@/mocks/devices';

export type PairedComputer = {
  id: string;
  name: string;
};

export type DevicesSource = {
  listPairedComputers(): Promise<PairedComputer[]>;
};

export const devices: DevicesSource = mockDevices;

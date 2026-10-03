import type { DevicesSource } from '@/features/devices/services/devices';

export const mockDevices: DevicesSource = {
  async listPairedComputers() {
    return [];
  },
};

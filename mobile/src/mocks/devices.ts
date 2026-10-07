import type { DevicesSource } from '@/features/devices/services/devices';

export const mockDevices: DevicesSource = {
  async listPairedComputers() {
    return [
      {
        id: 'computer-living-room',
        name: 'PC da sala',
        status: 'online',
        managedUser: 'Ana',
        lastSeen: '2026-10-07T10:15:00-03:00',
      },
      {
        id: 'computer-bedroom',
        name: 'Desktop do quarto',
        status: 'offline',
        managedUser: 'Ana',
        lastSeen: '2026-10-06T21:42:00-03:00',
      },
      {
        id: 'computer-notebook',
        name: 'Notebook da Ana',
        status: 'online',
        managedUser: 'Ana',
        lastSeen: '2026-10-07T09:58:00-03:00',
      },
    ];
  },
};

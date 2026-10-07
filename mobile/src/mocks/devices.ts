import type { DevicesSource, PairedComputer, PairingDemoSource } from '@/features/devices/services/devices';

const pairedComputers: PairedComputer[] = [
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

const simulatedComputer: PairedComputer = {
  id: 'computer-demo-paired',
  name: 'Computador de demonstração',
  status: 'offline',
  managedUser: 'Demonstração',
  lastSeen: null,
};

export const mockDevices: DevicesSource & PairingDemoSource = {
  async listPairedComputers() {
    return pairedComputers.map((computer) => ({ ...computer }));
  },
  async simulatePairing() {
    const existing = pairedComputers.find((computer) => computer.id === simulatedComputer.id);
    if (existing) return { ...existing };

    const computer = { ...simulatedComputer };
    pairedComputers.push(computer);
    return { ...computer };
  },
};

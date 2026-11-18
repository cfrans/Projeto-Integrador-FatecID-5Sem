import { useSimulationReady } from '@/features/restrictions/SimulationProvider';
import { useRestrictionComputer } from '@/features/restrictions/RestrictionDeviceProvider';
import { InstallationRestrictionScreen } from '@/features/restrictions/InstallationRestrictionScreen';

export default function InstallScreen() {
  const computer = useRestrictionComputer();
  const ready = useSimulationReady();
  return computer?.isDemo && ready ? <InstallationRestrictionScreen key={computer.id} computer={computer} /> : null;
}

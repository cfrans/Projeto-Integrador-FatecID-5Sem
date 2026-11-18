import { useSimulationReady } from '@/features/restrictions/SimulationProvider';
import { useRestrictionComputer } from '@/features/restrictions/RestrictionDeviceProvider';
import { ApplicationsRestrictionScreen } from '@/features/restrictions/ApplicationsRestrictionScreen';

export default function AppsScreen() {
  const computer = useRestrictionComputer();
  const ready = useSimulationReady();
  return computer?.isDemo && ready ? <ApplicationsRestrictionScreen key={computer.id} computer={computer} /> : null;
}

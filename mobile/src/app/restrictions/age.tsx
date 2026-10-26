import { useSimulationReady } from '@/features/restrictions/SimulationProvider';
import { useRestrictionComputer } from '@/features/restrictions/RestrictionDeviceProvider';
import { AgeRestrictionScreen } from '@/features/restrictions/AgeRestrictionScreen';

export default function AgeScreen() {
  const computer = useRestrictionComputer();
  const ready = useSimulationReady();
  return computer && ready ? <AgeRestrictionScreen key={computer.id} /> : null;
}

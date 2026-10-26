import { useSimulationReady } from '@/features/restrictions/SimulationProvider';
import { useRestrictionComputer } from '@/features/restrictions/RestrictionDeviceProvider';
import { BrowserRestrictionScreen } from '@/features/restrictions/BrowserRestrictionScreen';

export default function BrowsersScreen() {
  const computer = useRestrictionComputer();
  const ready = useSimulationReady();
  return computer && ready ? <BrowserRestrictionScreen key={computer.id} /> : null;
}

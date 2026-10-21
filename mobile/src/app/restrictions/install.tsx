import { useRestrictionComputer } from '@/features/restrictions/RestrictionDeviceProvider';
import { InstallationRestrictionScreen } from '@/features/restrictions/InstallationRestrictionScreen';

export default function InstallScreen() {
  const computer = useRestrictionComputer();
  return computer ? <InstallationRestrictionScreen key={computer.id} computer={computer} /> : null;
}

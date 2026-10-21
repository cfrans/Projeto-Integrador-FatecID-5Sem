import { useRestrictionComputer } from '@/features/restrictions/RestrictionDeviceProvider';
import { ApplicationsRestrictionScreen } from '@/features/restrictions/ApplicationsRestrictionScreen';

export default function AppsScreen() {
  const computer = useRestrictionComputer();
  return computer ? <ApplicationsRestrictionScreen key={computer.id} computer={computer} /> : null;
}

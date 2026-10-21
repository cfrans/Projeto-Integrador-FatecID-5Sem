import { useRestrictionComputer } from '@/features/restrictions/RestrictionDeviceProvider';
import { AgeRestrictionScreen } from '@/features/restrictions/AgeRestrictionScreen';

export default function AgeScreen() {
  const computer = useRestrictionComputer();
  return computer ? <AgeRestrictionScreen key={computer.id} computer={computer} /> : null;
}

import { useRestrictionComputer } from '@/features/restrictions/RestrictionDeviceProvider';
import { BrowserRestrictionScreen } from '@/features/restrictions/BrowserRestrictionScreen';

export default function BrowsersScreen() {
  const computer = useRestrictionComputer();
  return computer ? <BrowserRestrictionScreen key={computer.id} computer={computer} /> : null;
}

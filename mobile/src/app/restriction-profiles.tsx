import { useSession } from '@/features/auth/SessionProvider';
import { RestrictionDeviceProvider } from '@/features/restrictions/RestrictionDeviceProvider';
import { RestrictionProfilesScreen } from '@/features/restrictions/RestrictionProfilesScreen';

export default function RestrictionProfilesRoute() {
  const { guardian } = useSession();
  return <RestrictionDeviceProvider showTools={false}>
    <RestrictionProfilesScreen key={guardian?.id} />
  </RestrictionDeviceProvider>;
}

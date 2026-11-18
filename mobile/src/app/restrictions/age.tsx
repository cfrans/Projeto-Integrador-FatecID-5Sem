import { Text } from 'react-native';
import { useSimulationReady } from '@/features/restrictions/SimulationProvider';
import { useRestrictionComputer } from '@/features/restrictions/RestrictionDeviceProvider';
import { AgeRestrictionScreen } from '@/features/restrictions/AgeRestrictionScreen';
import { useLanguage } from '@/features/i18n/LanguageProvider';
import { useTheme } from '@/features/theme/ThemeProvider';

export default function AgeScreen() {
  const computer = useRestrictionComputer();
  const ready = useSimulationReady();
  const { t } = useLanguage();
  const { colors } = useTheme();
  if (computer && !computer.isDemo) return <Text style={{ color: colors.textSecondary, fontSize: 14, paddingHorizontal: 20 }}>{t('restriction.ageRealUnavailable')}</Text>;
  return computer && ready ? <AgeRestrictionScreen key={computer.id} /> : null;
}

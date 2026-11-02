import { Text } from 'react-native';
import { useSession } from '@/features/auth/SessionProvider';
import type { PairedComputer } from '@/features/devices/services/devices';
import { useLanguage } from '@/features/i18n/LanguageProvider';
import { useTheme } from '@/features/theme/ThemeProvider';
import { releaseStorageKey } from './services/release';
import { useLocalRelease } from './useLocalRelease';

export function ReleaseDeadline({ computer, requestId }: { computer: PairedComputer; requestId: string }) {
  const { guardian } = useSession();
  const { t, language } = useLanguage();
  const { colors } = useTheme();
  const key = guardian && computer.associationId ? releaseStorageKey(guardian.id, computer.id, computer.associationId, requestId) : null;
  const { release, error } = useLocalRelease(key);
  const text = error ? t('access.deadlineUnavailable') : release
    ? release.endsAt ? t('access.localDeadline', { date: new Intl.DateTimeFormat(language, { dateStyle: 'short', timeStyle: 'short' }).format(new Date(release.endsAt)) })
      : t('access.noLocalDeadline')
    : t('access.deadlineUnavailable');
  return <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{text}</Text>;
}

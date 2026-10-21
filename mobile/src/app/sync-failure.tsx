import { useLanguage } from '@/features/i18n/LanguageProvider';
import { Screen } from '@/components/Screen';

export default function SyncFailureScreen() {
  const { t } = useLanguage();
  return <Screen title={t('nav.syncFailure')} />;
}

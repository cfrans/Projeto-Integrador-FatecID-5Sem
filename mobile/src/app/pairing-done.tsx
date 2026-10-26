import { useLanguage } from '@/features/i18n/LanguageProvider';
import { Screen } from '@/components/Screen';

export default function PairingDoneScreen() {
  const { t } = useLanguage();
  return <Screen title={t('nav.paired')} />;
}

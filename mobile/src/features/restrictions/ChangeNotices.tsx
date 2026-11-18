import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { PairedComputer } from '@/features/devices/services/devices';
import { useLanguage } from '@/features/i18n/LanguageProvider';
import { useThemedStyles } from '@/features/theme/ThemeProvider';
import { preferenceStorage } from '@/lib/preferenceStorage';
import { radius, spacing, typography, type ColorPalette } from '@/theme';
import { checkChangeNotices, type ChangeNotice } from './services/change-notices';
import { failureMessageKey } from './services/simulation';
import { loadSynchronization } from './services/synchronization';

export function useChangeNotices(computers: PairedComputer[], guardianId: string | null) {
  const [notices, setNotices] = useState<{ guardianId: string; items: ChangeNotice[] } | null>(null);
  const running = useRef(false);

  useEffect(() => {
    if (!guardianId || running.current || !computers.some((computer) => computer.isPaired)) return;
    running.current = true;
    void loadSynchronization(computers)
      .then((entries) => checkChangeNotices(preferenceStorage, guardianId, entries))
      .then((found) => {
        if (found.length === 0) return;
        setNotices((previous) => {
          const kept = previous?.guardianId === guardianId
            ? previous.items.filter((item) => !found.some((notice) => notice.computerId === item.computerId && notice.kind === item.kind))
            : [];
          return { guardianId, items: [...kept, ...found] };
        });
      })
      .catch(() => undefined)
      .finally(() => { running.current = false; });
  }, [computers, guardianId]);

  const items = notices?.guardianId === guardianId ? notices.items : [];
  function dismiss(notice: ChangeNotice) {
    setNotices((previous) => previous && { ...previous, items: previous.items.filter((item) => item !== notice) });
  }
  return { notices: items, dismiss };
}

export function ChangeNoticeCard({ notice, onDismiss }: { notice: ChangeNotice; onDismiss: () => void }) {
  const { t, language } = useLanguage();
  const styles = useThemedStyles(createStyles);
  const failed = notice.kind === 'failed';
  const title = failed ? notice.computerName
    : notice.appliedAt ? t('changeNotice.applied', { name: notice.computerName, time: new Intl.DateTimeFormat(language, { hour: '2-digit', minute: '2-digit' }).format(new Date(notice.appliedAt)) })
      : t('changeNotice.appliedNoTime', { name: notice.computerName });

  return (
    <View style={[styles.card, failed && styles.failed]}>
      <View style={styles.copy}>
        <Text accessibilityLiveRegion="polite" style={styles.title}>{title}</Text>
        {failed ? <Text style={styles.description}>{t(failureMessageKey(notice.code))}</Text> : null}
      </View>
      <Pressable accessibilityRole="button" onPress={onDismiss} style={styles.action}>
        <Text style={styles.dismiss}>{t('requestBanner.dismiss')}</Text>
      </Pressable>
    </View>
  );
}

const createStyles = (colors: ColorPalette) => StyleSheet.create({
  card: { backgroundColor: colors.surfaceRaised, borderColor: colors.accent, borderWidth: 1, borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingTop: spacing.md, gap: spacing.xs },
  failed: { borderColor: colors.danger },
  copy: { gap: spacing.xs },
  title: { color: colors.textPrimary, fontSize: typography.body, fontWeight: '700' },
  description: { color: colors.textSecondary, fontSize: typography.label },
  action: { minHeight: 44, paddingHorizontal: spacing.sm, justifyContent: 'center', alignSelf: 'flex-end' },
  dismiss: { color: colors.textSecondary, fontSize: typography.label },
});

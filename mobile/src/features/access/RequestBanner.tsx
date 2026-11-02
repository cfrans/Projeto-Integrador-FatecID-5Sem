import { useEffect, useRef, useState } from 'react';
import { AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useSession } from '@/features/auth/SessionProvider';
import { devices } from '@/features/devices/services/devices';
import { listInstallationRequests } from '@/features/restrictions/services/installation-requests';
import { ApplicationIcon } from '@/features/restrictions/ApplicationIcon';
import { useLanguage } from '@/features/i18n/LanguageProvider';
import { useThemedStyles } from '@/features/theme/ThemeProvider';
import { radius, spacing, typography, type ColorPalette } from '@/theme';
import { emptyRequestBanners, updateRequestBanners, type RequestBannerState } from './request-banner-state';

export function RequestBanner() {
  const { guardian } = useSession();
  const guardianId = guardian?.id ?? null;
  const { t } = useLanguage();
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const tracked = useRef<{ guardianId: string; state: RequestBannerState } | null>(null);
  const [displayed, setDisplayed] = useState<typeof tracked.current>(null);

  useEffect(() => {
    if (!guardianId) { tracked.current = null; return; }
    if (tracked.current?.guardianId !== guardianId) tracked.current = { guardianId, state: emptyRequestBanners() };
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      if (AppState.currentState === 'active') {
        try {
          const computers = (await devices.listPairedComputers()).filter((computer) => computer.isPaired && computer.associationId);
          if (cancelled) return;
          const results = await Promise.allSettled(computers.map(async (computer) => ({ computer, requests: await listInstallationRequests(computer.id) })));
          if (cancelled) return;
          if (AppState.currentState === 'active' && tracked.current?.guardianId === guardianId) {
            const reports = results.flatMap((result) => result.status === 'fulfilled' ? [result.value] : []);
            const state = updateRequestBanners(tracked.current.state, computers, reports);
            tracked.current = { guardianId, state };
            setDisplayed(tracked.current);
          }
        } catch {
          if (!cancelled && tracked.current?.guardianId === guardianId) {
            tracked.current = { guardianId, state: { ...tracked.current.state, queue: [] } };
            setDisplayed(tracked.current);
          }
        }
      }
      if (!cancelled) timer = setTimeout(() => void poll(), 5000);
    };
    void poll();
    return () => { cancelled = true; clearTimeout(timer); };
  }, [guardianId]);

  const queue = displayed?.guardianId === guardianId ? displayed.state.queue : [];
  const current = queue[0];
  if (!current) return null;

  function dismiss() {
    if (!guardianId || tracked.current?.guardianId !== guardianId) return;
    tracked.current = { guardianId, state: { ...tracked.current.state, queue: tracked.current.state.queue.slice(1) } };
    setDisplayed(tracked.current);
  }

  function open() {
    if (queue.length > 1) {
      if (tracked.current) {
        tracked.current = { ...tracked.current, state: { ...tracked.current.state, queue: [] } };
        setDisplayed(tracked.current);
      }
      router.push('/access-requests');
    } else {
      dismiss();
      router.push({ pathname: '/access-request', params: { deviceId: current.computer.id, requestId: current.request.id } });
    }
  }

  return (
    <View pointerEvents="box-none" style={[styles.overlay, { top: insets.top + spacing.sm }]}>
      <View style={styles.card}>
        <View style={styles.row}>
          <ApplicationIcon name={current.request.applicationName} size={36} />
          <View style={styles.copy}>
            <Text accessibilityLiveRegion="polite" style={styles.title}>{t(queue.length > 1 ? 'requestBanner.multiple' : 'requestBanner.title', { count: queue.length })}</Text>
            <Text numberOfLines={2} style={styles.description}>{t('access.homeTitle', { name: current.request.requesterName, app: current.request.applicationName })}</Text>
          </View>
        </View>
        <View style={styles.actions}>
          <Pressable accessibilityRole="button" onPress={dismiss} style={styles.action}><Text style={styles.dismiss}>{t('requestBanner.dismiss')}</Text></Pressable>
          <Pressable accessibilityRole="button" onPress={open} style={styles.action}><Text style={styles.open}>{t(queue.length > 1 ? 'requestBanner.openAll' : 'requestBanner.open')}</Text></Pressable>
        </View>
      </View>
    </View>
  );
}

const createStyles = (colors: ColorPalette) => StyleSheet.create({
  overlay: { position: 'absolute', left: spacing.lg, right: spacing.lg, zIndex: 100 },
  card: { width: '100%', maxWidth: 520, alignSelf: 'center', backgroundColor: colors.surfaceRaised, borderColor: colors.accent, borderWidth: 1, borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingTop: spacing.md, elevation: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  copy: { flex: 1, gap: spacing.xs },
  title: { color: colors.textPrimary, fontSize: typography.body, fontWeight: '700' },
  description: { color: colors.textSecondary, fontSize: typography.label },
  actions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: spacing.md },
  action: { minHeight: 44, paddingHorizontal: spacing.sm, justifyContent: 'center' },
  dismiss: { color: colors.textSecondary, fontSize: typography.label },
  open: { color: colors.accentText, fontSize: typography.label, fontWeight: '700' },
});

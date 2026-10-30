import { useMemo, useSyncExternalStore } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Button } from '@/components/ui/Button';
import type { PendingRequest } from '@/features/access/pendingRequests';
import { useLanguage } from '@/features/i18n/LanguageProvider';
import { ApplicationIcon } from '@/features/restrictions/ApplicationIcon';
import { useThemedStyles } from '@/features/theme/ThemeProvider';
import { radius, spacing, typography, type ColorPalette } from '@/theme';

type DemoRequest = { id: string; name: string; application: string; computer: string; minutes: number; requestedAt: string };

export type RequestItem =
  | { kind: 'real'; id: string; requestedAt: string; pending: PendingRequest }
  | { kind: 'demo'; id: string; requestedAt: string; demo: DemoRequest };

const DEMO_MINUTES = 5;
const DEMO_REQUESTS: DemoRequest[] = [
  {
    id: 'demo-1',
    name: 'Pedro',
    application: 'Discord',
    computer: 'Notebook do Pedro',
    minutes: DEMO_MINUTES,
    requestedAt: new Date(Date.now() - DEMO_MINUTES * 60_000).toISOString(),
  },
];

let dismissedDemoIds: readonly string[] = [];
const listeners = new Set<() => void>();

function dismissDemo(id: string) {
  dismissedDemoIds = [...dismissedDemoIds, id];
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useRequestItems(pending: PendingRequest[]): RequestItem[] {
  const dismissed = useSyncExternalStore(subscribe, () => dismissedDemoIds);
  return useMemo(() => {
    const real = pending.map((item): RequestItem => ({ kind: 'real', id: item.request.id, requestedAt: item.request.requestedAt, pending: item }));
    const demo = DEMO_REQUESTS
      .filter((item) => !dismissed.includes(item.id))
      .map((item): RequestItem => ({ kind: 'demo', id: item.id, requestedAt: item.requestedAt, demo: item }));
    return [...real, ...demo].sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));
  }, [pending, dismissed]);
}

export function RequestCard({ item }: { item: RequestItem }) {
  return item.kind === 'real' ? <RealRequestCard pending={item.pending} /> : <DemoRequestCard demo={item.demo} />;
}

function RealRequestCard({ pending }: { pending: PendingRequest }) {
  const { language, t } = useLanguage();
  const styles = useThemedStyles(createStyles);
  const { computer, request } = pending;
  const title = t('access.homeTitle', { name: request.requesterName, app: request.applicationName });

  return (
    <Pressable
      accessibilityLabel={title}
      accessibilityRole="button"
      onPress={() => router.push({
        pathname: '/access-request',
        params: { deviceId: computer.id, requestId: request.id, applicationName: request.applicationName },
      })}
      style={({ pressed }) => [styles.realCard, pressed && styles.pressed]}
    >
      <ApplicationIcon name={request.applicationName} />
      <View style={styles.copy}>
        <Text style={styles.realTitle}>{title}</Text>
        <Text style={styles.meta}>
          {computer.name} · {new Intl.DateTimeFormat(language, { dateStyle: 'short', timeStyle: 'short' }).format(new Date(request.requestedAt))}
        </Text>
      </View>
    </Pressable>
  );
}

function DemoRequestCard({ demo }: { demo: DemoRequest }) {
  const { t } = useLanguage();
  const styles = useThemedStyles(createStyles);

  function review() {
    router.push({
      pathname: '/access-request',
      params: {
        demo: '1',
        requestId: `${demo.id}-${Date.now()}`,
        applicationName: demo.application,
        requesterName: demo.name,
        computerName: demo.computer,
        minutes: String(demo.minutes),
      },
    });
  }

  return (
    <View style={styles.demoCard}>
      <View style={styles.row}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{demo.name.charAt(0)}</Text>
        </View>
        <View style={styles.copy}>
          <Text style={styles.request}>
            {t('access.demoWants', { name: demo.name })} <Text style={styles.application}>{demo.application}</Text>
          </Text>
          <Text style={styles.meta}>
            {demo.computer} · {t('access.demoAgo', { n: demo.minutes })}
          </Text>
        </View>
      </View>
      <View style={styles.actions}>
        <Button label={t('access.demoRefuse')} variant="neutral" onPress={() => dismissDemo(demo.id)} style={styles.action} />
        <Button label={t('access.demoRelease')} variant="solid" onPress={review} style={styles.action} />
      </View>
    </View>
  );
}

const createStyles = (colors: ColorPalette) => StyleSheet.create({
  pressed: { opacity: 0.72 },
  realCard: {
    alignItems: 'center',
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent,
    borderRadius: radius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
  },
  realTitle: { color: colors.textPrimary, fontSize: typography.body, fontWeight: '600' },
  demoCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.md,
  },
  row: { alignItems: 'center', flexDirection: 'row', gap: spacing.md },
  avatar: {
    alignItems: 'center',
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.pill,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  avatarText: { color: colors.accentText, fontSize: 18, fontWeight: '700' },
  copy: { flex: 1, gap: 2 },
  request: { color: colors.textPrimary, fontSize: typography.body },
  application: { fontWeight: '700' },
  meta: { color: colors.textSecondary, fontSize: typography.label },
  actions: { flexDirection: 'row', gap: spacing.sm },
  action: { flex: 1 },
});

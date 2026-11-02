import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import type { PendingRequest } from '@/features/access/pendingRequests';
import { useLanguage } from '@/features/i18n/LanguageProvider';
import { ApplicationIcon } from '@/features/restrictions/ApplicationIcon';
import { ReleaseDeadline } from './ReleaseDeadline';
import { useThemedStyles } from '@/features/theme/ThemeProvider';
import { radius, spacing, typography, type ColorPalette } from '@/theme';

export type RequestItem = { kind: 'real'; id: string; requestedAt: string; pending: PendingRequest };

export function useRequestItems(pending: PendingRequest[]): RequestItem[] {
  return useMemo(() => pending.map((item) => ({ kind: 'real', id: item.request.id, requestedAt: item.request.requestedAt, pending: item })), [pending]);
}

export function RequestCard({ item }: { item: RequestItem }) {
  return <RealRequestCard pending={item.pending} />;
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
        {request.status ? <Text style={styles.meta}>{t(request.status === 'APPROVED' ? 'access.approvedStatus' : 'access.deniedStatus')}</Text> : null}
        {request.status === 'APPROVED' ? <ReleaseDeadline computer={computer} requestId={request.id} /> : null}
        <Text style={styles.meta}>
          {computer.name} · {new Intl.DateTimeFormat(language, { dateStyle: 'short', timeStyle: 'short' }).format(new Date(request.requestedAt))}
        </Text>
      </View>
    </Pressable>
  );
}

const createStyles = (colors: ColorPalette) => StyleSheet.create({
  pressed: { opacity: 0.72 },
  realCard: { alignItems: 'center', backgroundColor: colors.accentSoft, borderColor: colors.accent, borderRadius: radius.lg, borderWidth: 1, flexDirection: 'row', gap: spacing.md, minHeight: 44, padding: spacing.md },
  realTitle: { color: colors.textPrimary, fontSize: typography.body, fontWeight: '600' },
  copy: { flex: 1, gap: spacing.xs },
  meta: { color: colors.textSecondary, fontSize: typography.label },
});

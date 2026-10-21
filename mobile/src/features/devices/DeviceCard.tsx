import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { radius, spacing, typography, type ColorPalette } from '@/theme';
import type { PairedComputer } from '@/features/devices/services/devices';
import { useLanguage } from '@/features/i18n/LanguageProvider';
import { useThemedStyles } from '@/features/theme/ThemeProvider';

type DeviceCardProps = {
  computer: PairedComputer;
  onRemove?: () => void;
  removing?: boolean;
};

export function DeviceCard({ computer, onRemove, removing = false }: DeviceCardProps) {
  const { language, t } = useLanguage();
  const styles = useThemedStyles(createStyles);
  const online = computer.status === 'online';
  const unverified = computer.status === 'unverified';
  const lastSeen = computer.lastSeen
    ? new Intl.DateTimeFormat(language, {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(computer.lastSeen))
    : null;

  return (
    <Card style={styles.card}>
      <View style={styles.row}>
        <View style={[styles.deviceMark, online && styles.deviceMarkOnline]}>
          <View style={[styles.dot, online && styles.dotOnline]} />
        </View>
        <View style={styles.details}>
          <Text style={styles.name}>{computer.name}</Text>
          <Text style={styles.managedUser}>
            {t('device.managed')}: {computer.managedUser ?? t('common.notProvided')}
          </Text>
          {computer.isDemo ? <Text style={styles.demoLabel}>{t('device.demo')}</Text> : null}
        </View>
        <View style={styles.statusBlock}>
          <Text style={[styles.status, online ? styles.online : styles.offline]}>
            {unverified ? t('device.unverified') : t(online ? 'device.online' : 'device.offline')}
          </Text>
          {unverified ? (
            <Text style={styles.lastSeen}>{computer.isPaired ? t('device.active') : t('device.inactive')}</Text>
          ) : lastSeen ? (
            <Text style={styles.lastSeen}>{t('device.seen')} {lastSeen}</Text>
          ) : null}
        </View>
      </View>
      {computer.isPaired ? (
        <Button label={t('nav.restrictions')} disabled={removing} onPress={() => router.push({ pathname: '/restrictions/browsers', params: { deviceId: computer.id } })} />
      ) : null}
      {computer.isPaired && onRemove ? (
        <Button
          accessibilityHint={t('device.removeHint', { name: computer.name })}
          accessibilityState={{ disabled: removing }}
          disabled={removing}
          label={removing ? t('device.removing') : t('device.remove')}
          onPress={onRemove}
          style={styles.removeButton}
        />
      ) : null}
    </Card>
  );
}

const createStyles = (colors: ColorPalette) => StyleSheet.create({
  card: {
    gap: spacing.md,
    padding: spacing.md,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  deviceMark: {
    alignItems: 'center',
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.sm,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  deviceMarkOnline: { backgroundColor: colors.accentSoft },
  dot: { backgroundColor: colors.textMuted, borderRadius: radius.pill, height: 8, width: 8 },
  dotOnline: { backgroundColor: colors.success },
  details: { flex: 1, gap: spacing.xs },
  name: { color: colors.textPrimary, fontSize: typography.body, fontWeight: '600' },
  managedUser: { color: colors.textSecondary, fontSize: typography.label },
  demoLabel: { color: colors.textMuted, fontSize: typography.label },
  statusBlock: { alignItems: 'flex-end', gap: spacing.xs, maxWidth: 112 },
  status: { fontSize: typography.label, fontWeight: '600' },
  online: { color: colors.success },
  offline: { color: colors.textSecondary },
  lastSeen: { color: colors.textMuted, fontSize: typography.label },
  removeButton: { alignSelf: 'flex-end', minHeight: 44, paddingVertical: spacing.xs },
});

import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { radius, spacing, typography, type ColorPalette } from '@/theme';
import type { PairedComputer } from '@/features/devices/services/devices';
import { useLanguage } from '@/features/i18n/LanguageProvider';
import { useThemedStyles } from '@/features/theme/ThemeProvider';
import { ComputerIcon } from './ComputerIcon';
import { ComputerIconPicker } from './ComputerIconPicker';

type DeviceCardProps = {
  computer: PairedComputer;
  onRemove?: () => void;
  removing?: boolean;
};

export function DeviceCard({ computer, onRemove, removing = false }: DeviceCardProps) {
  const { language, t } = useLanguage();
  const styles = useThemedStyles(createStyles);
  const [pickingIcon, setPickingIcon] = useState(false);
  const { fontScale, width } = useWindowDimensions();
  const stacked = fontScale > 1.3 || width < 360;
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
      <View style={[styles.row, stacked && styles.stackedRow]}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('device.changeIcon', { name: computer.name })} accessibilityState={{ disabled: removing }} disabled={removing} onPress={() => setPickingIcon(true)} style={styles.iconButton}>
          <ComputerIcon deviceId={computer.id} selected={online} />
          <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.editBadge}><Text style={styles.editMark}>✎</Text></View>
        </Pressable>
        <View style={[styles.details, stacked && styles.stackedDetails]}>
          <Text style={styles.name}>{computer.name}</Text>
          <Text style={styles.managedUser}>
            {t('device.managed')}: {computer.managedUser ?? t('common.notProvided')}
          </Text>
          {computer.isDemo ? <Text style={styles.demoLabel}>{t('device.demo')}</Text> : null}
        </View>
        <View style={[styles.statusBlock, stacked && styles.stackedStatus]}>
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
      <ComputerIconPicker visible={pickingIcon} deviceId={computer.id} name={computer.name} onClose={() => setPickingIcon(false)} />
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
  stackedRow: { flexWrap: 'wrap', alignItems: 'flex-start' },
  stackedDetails: { flexBasis: '70%' },
  stackedStatus: { maxWidth: '100%', alignItems: 'flex-start', width: '100%' },
  iconButton: { minWidth: 44, minHeight: 44, justifyContent: 'center', alignItems: 'center' },
  editBadge: { position: 'absolute', bottom: -2, right: -3, height: 18, width: 18, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  editMark: { color: colors.accentText, fontSize: 12 },
  details: { flex: 1, gap: spacing.xs },
  name: { color: colors.textPrimary, fontSize: typography.body, fontWeight: '600' },
  managedUser: { color: colors.textSecondary, fontSize: typography.label },
  demoLabel: { color: colors.textSecondary, fontSize: typography.label },
  statusBlock: { alignItems: 'flex-end', gap: spacing.xs, maxWidth: 112 },
  status: { fontSize: typography.label, fontWeight: '600' },
  online: { color: colors.success },
  offline: { color: colors.textSecondary },
  lastSeen: { color: colors.textSecondary, fontSize: typography.label },
  removeButton: { alignSelf: 'flex-end', minHeight: 44, paddingVertical: spacing.xs },
});

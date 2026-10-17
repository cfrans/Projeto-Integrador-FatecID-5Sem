import { StyleSheet, Text, View } from 'react-native';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { colors, radius, spacing, typography } from '@/theme';
import type { PairedComputer } from '@/features/devices/services/devices';
import { useLanguage } from '@/features/i18n/LanguageProvider';

type DeviceCardProps = {
  computer: PairedComputer;
  onRemove?: () => void;
  removing?: boolean;
};

export function DeviceCard({ computer, onRemove, removing = false }: DeviceCardProps) {
  const { language } = useLanguage();
  const labels = language === 'en'
    ? { managed: 'Managed account', unknown: 'not provided', demo: 'Demo', unverified: 'Connection not verified', active: 'Active link', inactive: 'No active link', seen: 'Seen at', removing: 'Removing link…', remove: 'Remove link' }
    : language === 'es'
      ? { managed: 'Cuenta gestionada', unknown: 'no informada', demo: 'Demostración', unverified: 'Conexión no validada', active: 'Vínculo activo', inactive: 'Sin vínculo activo', seen: 'Visto a las', removing: 'Quitando vínculo…', remove: 'Quitar vínculo' }
      : { managed: 'Conta gerenciada', unknown: 'não informada', demo: 'Demonstração', unverified: 'Conexão não validada', active: 'Vínculo ativo', inactive: 'Sem vínculo ativo', seen: 'Visto em', removing: 'Removendo vínculo…', remove: 'Remover vínculo' };
  const online = computer.status === 'online';
  const unverified = computer.status === 'unverified';
  const lastSeen = computer.lastSeen
    ? new Intl.DateTimeFormat('pt-BR', {
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
            {labels.managed}: {computer.managedUser ?? labels.unknown}
          </Text>
          {computer.isDemo ? <Text style={styles.demoLabel}>{labels.demo}</Text> : null}
        </View>
        <View style={styles.statusBlock}>
          <Text style={[styles.status, online ? styles.online : styles.offline]}>
            {unverified ? labels.unverified : online ? 'Online' : 'Offline'}
          </Text>
          {unverified ? (
            <Text style={styles.lastSeen}>{computer.isPaired ? labels.active : labels.inactive}</Text>
          ) : lastSeen ? (
            <Text style={styles.lastSeen}>{labels.seen} {lastSeen}</Text>
          ) : null}
        </View>
      </View>
      {computer.isPaired && onRemove ? (
        <Button
          accessibilityHint={`Remove o vínculo de ${computer.name} da sua conta`}
          accessibilityState={{ disabled: removing }}
          disabled={removing}
          label={removing ? labels.removing : labels.remove}
          onPress={onRemove}
          style={styles.removeButton}
        />
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
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

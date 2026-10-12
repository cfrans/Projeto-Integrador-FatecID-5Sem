import { StyleSheet, Text, View } from 'react-native';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { colors, radius, spacing, typography } from '@/theme';
import type { PairedComputer } from '@/features/devices/services/devices';

type DeviceCardProps = {
  computer: PairedComputer;
  onRemove?: () => void;
  removing?: boolean;
};

export function DeviceCard({ computer, onRemove, removing = false }: DeviceCardProps) {
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
            Conta gerenciada: {computer.managedUser ?? 'não informada'}
          </Text>
          {computer.isDemo ? <Text style={styles.demoLabel}>Demonstração</Text> : null}
        </View>
        <View style={styles.statusBlock}>
          <Text style={[styles.status, online ? styles.online : styles.offline]}>
            {unverified ? 'Conexão não validada' : online ? 'Online' : 'Offline'}
          </Text>
          {unverified ? (
            <Text style={styles.lastSeen}>{computer.isPaired ? 'Vínculo ativo' : 'Sem vínculo ativo'}</Text>
          ) : lastSeen ? (
            <Text style={styles.lastSeen}>Visto em {lastSeen}</Text>
          ) : null}
        </View>
      </View>
      {computer.isPaired && onRemove ? (
        <Button
          accessibilityHint={`Remove o vínculo de ${computer.name} da sua conta`}
          accessibilityState={{ disabled: removing }}
          disabled={removing}
          label={removing ? 'Removendo vínculo…' : 'Remover vínculo'}
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

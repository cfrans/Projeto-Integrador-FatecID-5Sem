import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/Button';
import { DeviceCard } from '@/features/devices/DeviceCard';
import { devices, type PairedComputer } from '@/features/devices/services/devices';
import { colors, radius, spacing, typography } from '@/theme';

type HomeState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'loaded'; computers: PairedComputer[] };

export function HomeScreen() {
  const [state, setState] = useState<HomeState>({ status: 'loading' });
  const requestId = useRef(0);

  const loadComputers = useCallback(() => {
    const request = ++requestId.current;
    devices.listPairedComputers()
      .then((computers) => {
        if (request === requestId.current) setState({ status: 'loaded', computers });
      })
      .catch(() => {
        if (request === requestId.current) setState({ status: 'error' });
      });
  }, []);

  useFocusEffect(useCallback(() => {
    loadComputers();
    return () => {
      requestId.current += 1;
    };
  }, [loadComputers]));

  function retry() {
    setState({ status: 'loading' });
    loadComputers();
  }

  const computers = state.status === 'loaded' ? state.computers : [];

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.greeting}>
          <Text style={styles.eyebrow}>PIPLUP · CONTROLE FAMILIAR</Text>
          <Text style={styles.title}>Olá, Camila</Text>
          <Text style={styles.subtitle}>Acompanhe os computadores da sua família.</Text>
          <Text style={styles.demoLabel}>Demonstração · dados simulados</Text>
        </View>

        <View style={styles.pairingCard}>
          <View style={styles.pairingCopy}>
            <Text style={styles.pairingTitle}>Conecte um computador</Text>
            <Text style={styles.pairingDescription}>
              Faça o pareamento para acompanhar o dispositivo por aqui.
            </Text>
          </View>
          <Button
            label="Parear computador"
            onPress={() => router.push('/qr-scan')}
          />
        </View>

        <View style={styles.sectionHeader}>
          <View style={styles.sectionHeading}>
            <Text style={styles.sectionTitle}>Computadores</Text>
            {state.status === 'loaded' ? (
              <Text style={styles.count}>{computers.length}</Text>
            ) : null}
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/computers')}
            style={({ pressed }) => [styles.linkButton, pressed && styles.pressed]}
          >
            <Text style={styles.link}>Ver todos</Text>
          </Pressable>
        </View>

        {state.status === 'loading' ? (
          <View style={styles.stateContainer}>
            <ActivityIndicator color={colors.accent} />
            <Text style={styles.stateText}>Carregando computadores…</Text>
          </View>
        ) : null}

        {state.status === 'error' ? (
          <View style={styles.stateContainer}>
            <Text style={styles.stateTitle}>Não foi possível carregar</Text>
            <Text style={styles.stateText}>Confira sua conexão e tente novamente.</Text>
            <Button label="Tentar novamente" onPress={retry} />
          </View>
        ) : null}

        {state.status === 'loaded' && computers.length === 0 ? (
          <View style={styles.stateContainer}>
            <Text style={styles.stateTitle}>Nenhum computador pareado</Text>
            <Text style={styles.stateText}>Adicione um computador para começar.</Text>
          </View>
        ) : null}

        {state.status === 'loaded' && computers.length > 0 ? (
          <View style={styles.deviceList}>
            {computers.map((computer) => (
              <DeviceCard computer={computer} key={computer.id} />
            ))}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: colors.background, flex: 1 },
  content: { gap: spacing.xl, padding: spacing.lg, paddingBottom: spacing.xxl },
  greeting: { gap: spacing.sm, paddingTop: spacing.sm },
  eyebrow: {
    color: colors.accentText,
    fontSize: typography.label,
    fontWeight: '600',
    letterSpacing: 1.2,
  },
  title: { color: colors.textPrimary, fontSize: typography.title, fontWeight: '700' },
  subtitle: { color: colors.textSecondary, fontSize: typography.body, lineHeight: 21 },
  demoLabel: { color: colors.textMuted, fontSize: typography.label },
  pairingCard: {
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.lg,
    padding: spacing.lg,
  },
  pairingCopy: { gap: spacing.xs },
  pairingTitle: { color: colors.textPrimary, fontSize: typography.body, fontWeight: '600' },
  pairingDescription: { color: colors.textSecondary, fontSize: typography.label, lineHeight: 18 },
  sectionHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  sectionHeading: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  sectionTitle: { color: colors.textPrimary, fontSize: 18, fontWeight: '600' },
  count: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.pill,
    color: colors.textSecondary,
    fontSize: typography.label,
    minWidth: 24,
    overflow: 'hidden',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    textAlign: 'center',
  },
  linkButton: { justifyContent: 'center', minHeight: 44, paddingHorizontal: spacing.sm },
  pressed: { opacity: 0.65 },
  link: { color: colors.accentText, fontSize: typography.label, fontWeight: '600' },
  deviceList: { gap: spacing.sm },
  stateContainer: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.xl,
  },
  stateTitle: { color: colors.textPrimary, fontSize: typography.body, fontWeight: '600' },
  stateText: { color: colors.textSecondary, fontSize: typography.label, textAlign: 'center' },
});

import { useCallback, useEffect, useRef, useState } from 'react';
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
import { prefetchTeamAvatars } from '@/features/about/AboutScreen';
import { useSession } from '@/features/auth/SessionProvider';
import { DeviceCard } from '@/features/devices/DeviceCard';
import { devices, devicesErrorMessage, type PairedComputer } from '@/features/devices/services/devices';
import { colors, radius, spacing, typography } from '@/theme';

type HomeState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'loaded'; computers: PairedComputer[] };

export function HomeScreen() {
  const { busy, clearError, error, guardian, signOut } = useSession();
  const [state, setState] = useState<HomeState>({ status: 'loading' });
  const requestId = useRef(0);

  useEffect(() => {
    prefetchTeamAvatars();
  }, []);

  const loadComputers = useCallback(() => {
    const request = ++requestId.current;
    setState({ status: 'loading' });
    devices.listPairedComputers()
      .then((computers) => {
        if (request === requestId.current) setState({ status: 'loaded', computers });
      })
      .catch((error: unknown) => {
        if (request === requestId.current) setState({ status: 'error', message: devicesErrorMessage(error) });
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
          <Text style={styles.title}>Olá, {guardian?.name}</Text>
          <Text style={styles.subtitle}>Acompanhe os computadores da sua família.</Text>
          {error ? (
            <Text accessibilityLiveRegion="polite" style={styles.logoutError}>{error}</Text>
          ) : null}
          <Button
            label={busy ? 'Saindo…' : 'Sair'}
            disabled={busy}
            onPress={() => {
              clearError();
              void signOut();
            }}
          />
        </View>

        <View style={styles.pairingCard}>
          <View style={styles.pairingCopy}>
            <Text style={styles.pairingTitle}>Adicionar computador</Text>
            <Text style={styles.pairingDescription}>
              Leia o QR Code exibido no Lux para associar um novo computador.
            </Text>
          </View>
          <Button
            label="Adicionar computador"
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
            <Text style={styles.stateText}>{state.message}</Text>
            <Button label="Tentar novamente" onPress={retry} />
          </View>
        ) : null}

        {state.status === 'loaded' && computers.length === 0 ? (
          <View style={styles.stateContainer}>
            <Text style={styles.stateTitle}>Nenhum computador associado</Text>
            <Text style={styles.stateText}>
              Leia o QR Code temporário exibido no computador para criar um vínculo.
            </Text>
          </View>
        ) : null}

        {state.status === 'loaded' && computers.length > 0 ? (
          <View style={styles.deviceList}>
            {computers.map((computer) => (
              <DeviceCard computer={computer} key={computer.id} />
            ))}
          </View>
        ) : null}

        <View style={styles.shortcutsSection}>
          <Text style={styles.shortcutsHeader}>ATALHOS DE RESTRIÇÃO</Text>

          <View style={styles.shortcutsGrid}>
            <View style={styles.shortcutsRow}>
              <Pressable
                accessibilityLabel="Navegadores, Bloqueados"
                accessibilityRole="button"
                onPress={() => router.push('/restrictions/browsers')}
                style={({ pressed }) => [styles.shortcutCard, pressed && styles.pressed]}
              >
                <View style={styles.shortcutIconBox}>
                  <View style={styles.globeCircle}>
                    <View style={styles.globeLineHorizontal} />
                    <View style={styles.globeLineVertical} />
                  </View>
                </View>
                <View style={styles.shortcutCopy}>
                  <Text style={styles.shortcutTitle}>Navegadores</Text>
                  <Text style={styles.shortcutSubtitle}>Bloqueados</Text>
                </View>
              </Pressable>

              <Pressable
                accessibilityLabel="Aplicativos, 4 de 8 liberados"
                accessibilityRole="button"
                onPress={() => router.push('/restrictions/apps')}
                style={({ pressed }) => [styles.shortcutCard, pressed && styles.pressed]}
              >
                <View style={styles.shortcutIconBox}>
                  <View style={styles.appGridIcon}>
                    <View style={styles.appGridDot} />
                    <View style={styles.appGridDot} />
                    <View style={styles.appGridDot} />
                    <View style={styles.appGridDot} />
                  </View>
                </View>
                <View style={styles.shortcutCopy}>
                  <Text style={styles.shortcutTitle}>Aplicativos</Text>
                  <Text style={styles.shortcutSubtitle}>4 de 8 liberados</Text>
                </View>
              </Pressable>
            </View>

            <View style={styles.shortcutsRow}>
              <Pressable
                accessibilityLabel="Instalação, Bloqueada"
                accessibilityRole="button"
                onPress={() => router.push('/restrictions/install')}
                style={({ pressed }) => [styles.shortcutCard, pressed && styles.pressed]}
              >
                <View style={styles.shortcutIconBox}>
                  <View style={styles.installIcon}>
                    <Text style={styles.shortcutSymbolText}>↓</Text>
                    <View style={styles.installTray} />
                  </View>
                </View>
                <View style={styles.shortcutCopy}>
                  <Text style={styles.shortcutTitle}>Instalação</Text>
                  <Text style={styles.shortcutSubtitle}>Bloqueada</Text>
                </View>
              </Pressable>

              <Pressable
                accessibilityLabel="Faixa etária, Até 12 anos"
                accessibilityRole="button"
                onPress={() => router.push('/restrictions/age')}
                style={({ pressed }) => [styles.shortcutCard, pressed && styles.pressed]}
              >
                <View style={styles.shortcutIconBox}>
                  <Text style={styles.ageBadgeIconText}>12+</Text>
                </View>
                <View style={styles.shortcutCopy}>
                  <Text style={styles.shortcutTitle}>Faixa etária</Text>
                  <Text style={styles.shortcutSubtitle}>Até 12 anos</Text>
                </View>
              </Pressable>
            </View>
          </View>
        </View>

        <Button
          label="Sobre o projeto"
          onPress={() => router.push('/about')}
        />
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
  logoutError: { color: colors.accentText, fontSize: typography.label, lineHeight: 18 },
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
  shortcutsSection: {
    gap: spacing.sm,
  },
  shortcutsHeader: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.8,
  },
  shortcutsGrid: {
    gap: spacing.sm,
  },
  shortcutsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  shortcutCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flex: 1,
    gap: spacing.md,
    justifyContent: 'space-between',
    minHeight: 104,
    padding: spacing.md,
  },
  shortcutIconBox: {
    alignItems: 'center',
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  globeCircle: {
    alignItems: 'center',
    borderColor: colors.textSecondary,
    borderRadius: radius.pill,
    borderWidth: 1.3,
    height: 15,
    justifyContent: 'center',
    width: 15,
  },
  globeLineHorizontal: {
    backgroundColor: colors.textSecondary,
    height: 1.2,
    position: 'absolute',
    width: 13,
  },
  globeLineVertical: {
    backgroundColor: colors.textSecondary,
    height: 13,
    position: 'absolute',
    width: 1.2,
  },
  appGridIcon: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 2.5,
    height: 13,
    width: 13,
  },
  appGridDot: {
    borderColor: colors.textSecondary,
    borderRadius: 1.5,
    borderWidth: 1.2,
    height: 5,
    width: 5,
  },
  installIcon: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  shortcutSymbolText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 13,
  },
  installTray: {
    backgroundColor: colors.textSecondary,
    borderRadius: 1,
    height: 1.5,
    marginTop: 1,
    width: 11,
  },
  ageBadgeIconText: {
    color: colors.textSecondary,
    fontSize: 10,
    fontWeight: '700',
  },
  shortcutCopy: {
    gap: 2,
  },
  shortcutTitle: {
    color: colors.textPrimary,
    fontSize: typography.body,
    fontWeight: '600',
  },
  shortcutSubtitle: {
    color: colors.textSecondary,
    fontSize: typography.label,
  },
});

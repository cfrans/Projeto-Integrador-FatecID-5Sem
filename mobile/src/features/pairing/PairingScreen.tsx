import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/Button';
import { DeviceCard } from '@/features/devices/DeviceCard';
import { pairingDemo, type PairedComputer } from '@/features/devices/services/devices';
import { colors, radius, spacing, typography } from '@/theme';

type PairingState =
  | { status: 'ready' }
  | { status: 'pending' }
  | { status: 'error' }
  | { status: 'complete'; computer: PairedComputer };

export function PairingScreen() {
  const [state, setState] = useState<PairingState>({ status: 'ready' });
  const requestInFlight = useRef(false);
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  async function simulatePairing() {
    if (requestInFlight.current) return;

    requestInFlight.current = true;
    setState({ status: 'pending' });

    try {
      const computer = await pairingDemo.simulatePairing();
      if (mounted.current) setState({ status: 'complete', computer });
    } catch {
      if (mounted.current) setState({ status: 'error' });
    } finally {
      requestInFlight.current = false;
    }
  }

  const pending = state.status === 'pending';

  return (
    <SafeAreaView edges={['bottom', 'left', 'right']} style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        {state.status === 'complete' ? (
          <View style={styles.completeContent}>
            <View style={styles.successMark}>
              <Text accessibilityLabel="Pareamento simulado concluído" style={styles.successCheck}>
                ✓
              </Text>
            </View>
            <Text style={styles.eyebrow}>DEMONSTRAÇÃO</Text>
            <Text style={styles.title}>Exemplo adicionado</Text>
            <Text style={styles.description}>
              A simulação não altera a lista da API nem vincula um computador ao Lux.
            </Text>
            <View style={styles.summaryCard}>
              <DeviceCard computer={state.computer} />
            </View>
            <Button
              label="Ver computadores"
              onPress={() => router.dismissTo('/computers')}
              style={styles.actionButton}
            />
          </View>
        ) : (
          <View style={styles.scanContent}>
            <View style={styles.intro}>
              <Text style={styles.eyebrow}>ADICIONAR À DEMONSTRAÇÃO</Text>
              <Text style={styles.title}>Adicionar computador</Text>
              <Text style={styles.description}>
                Esta tela apresenta o fluxo visual de leitura. O pareamento real ainda não está integrado.
              </Text>
            </View>

            <View style={styles.scanner}>
              <View style={[styles.corner, styles.topLeft]} />
              <View style={[styles.corner, styles.topRight]} />
              <View style={[styles.corner, styles.bottomLeft]} />
              <View style={[styles.corner, styles.bottomRight]} />
              <View style={styles.scannerCenter}>
                <View style={styles.cameraMark}>
                  <View style={styles.cameraLens} />
                </View>
                <Text style={styles.scannerTitle}>Leitura demonstrativa</Text>
                <Text style={styles.scannerText}>Moldura ilustrativa. A câmera não está ativa.</Text>
              </View>
            </View>

            <Text style={styles.demoNote}>
              Nenhum QR Code é lido ou usado como credencial. A simulação não altera a API.
            </Text>

            {state.status === 'error' ? (
              <Text accessibilityRole="alert" style={styles.error}>
                Não foi possível concluir a simulação. Tente novamente.
              </Text>
            ) : null}

            <Button
              accessibilityHint="Adiciona um computador fictício à lista da demonstração"
              accessibilityState={{ disabled: pending }}
              disabled={pending}
              label={pending ? 'Simulando pareamento…' : state.status === 'error' ? 'Tentar novamente' : 'Simular pareamento'}
              onPress={simulatePairing}
              style={styles.actionButton}
            />
            {pending ? <ActivityIndicator color={colors.accent} /> : null}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: colors.background, flex: 1 },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  scanContent: {
    alignItems: 'center',
    alignSelf: 'center',
    gap: spacing.lg,
    maxWidth: 440,
    width: '100%',
  },
  intro: { alignSelf: 'stretch', gap: spacing.sm },
  eyebrow: {
    color: colors.accentText,
    fontSize: typography.label,
    fontWeight: '600',
    letterSpacing: 1.2,
  },
  title: { color: colors.textPrimary, fontSize: typography.title, fontWeight: '700' },
  description: { color: colors.textSecondary, fontSize: typography.body, lineHeight: 21 },
  scanner: {
    alignItems: 'center',
    alignSelf: 'center',
    aspectRatio: 1,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    justifyContent: 'center',
    maxWidth: 280,
    position: 'relative',
    width: '100%',
  },
  corner: { height: 28, position: 'absolute', width: 28 },
  topLeft: { borderLeftColor: colors.accent, borderLeftWidth: 3, borderTopColor: colors.accent, borderTopWidth: 3, left: spacing.lg, top: spacing.lg },
  topRight: { borderRightColor: colors.accent, borderRightWidth: 3, borderTopColor: colors.accent, borderTopWidth: 3, right: spacing.lg, top: spacing.lg },
  bottomLeft: { borderBottomColor: colors.accent, borderBottomWidth: 3, borderLeftColor: colors.accent, borderLeftWidth: 3, bottom: spacing.lg, left: spacing.lg },
  bottomRight: { borderBottomColor: colors.accent, borderBottomWidth: 3, borderRightColor: colors.accent, borderRightWidth: 3, bottom: spacing.lg, right: spacing.lg },
  scannerCenter: { alignItems: 'center', gap: spacing.sm, padding: spacing.xxl },
  cameraMark: {
    alignItems: 'center',
    borderColor: colors.accentText,
    borderRadius: radius.sm,
    borderWidth: 2,
    height: 42,
    justifyContent: 'center',
    marginBottom: spacing.xs,
    width: 52,
  },
  cameraLens: {
    borderColor: colors.accentText,
    borderRadius: radius.pill,
    borderWidth: 2,
    height: 18,
    width: 18,
  },
  scannerTitle: { color: colors.textPrimary, fontSize: typography.body, fontWeight: '600', textAlign: 'center' },
  scannerText: { color: colors.textSecondary, fontSize: typography.label, lineHeight: 18, textAlign: 'center' },
  demoNote: { color: colors.textMuted, fontSize: typography.label, lineHeight: 18, textAlign: 'center' },
  error: { color: colors.accentText, fontSize: typography.label, lineHeight: 18, textAlign: 'center' },
  actionButton: { alignSelf: 'stretch', marginTop: spacing.xs },
  completeContent: {
    alignItems: 'center',
    alignSelf: 'center',
    gap: spacing.md,
    maxWidth: 440,
    width: '100%',
  },
  summaryCard: { alignSelf: 'stretch' },
  successMark: {
    alignItems: 'center',
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent,
    borderRadius: radius.pill,
    borderWidth: 1,
    height: 64,
    justifyContent: 'center',
    marginBottom: spacing.sm,
    width: 64,
  },
  successCheck: { color: colors.accentText, fontSize: 32, fontWeight: '600' },
});

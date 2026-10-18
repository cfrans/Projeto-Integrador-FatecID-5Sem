import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { parsePairingToken, PairingTokenError, pairingCompletionErrorMessage, pairingErrorMessage, type PairingPreview, type PairingResult } from '@/features/pairing/services/pairing';
import { pairing } from '@/features/pairing/services/http-pairing';
import { darkColors, radius, spacing, typography, type ColorPalette } from '@/theme';
import { useLanguage } from '@/features/i18n/LanguageProvider';
import { useTheme, useThemedStyles } from '@/features/theme/ThemeProvider';

type PairingState =
  | { status: 'scanning' }
  | { status: 'error'; message: string; canCheckDevices?: boolean }
  | { status: 'checking' }
  | { status: 'confirming'; token: string; preview: PairingPreview }
  | { status: 'completing'; token: string; preview: PairingPreview }
  | { status: 'complete'; result: PairingResult };

export function PairingScreen() {
  const { t } = useLanguage();
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [permission, requestPermission, getPermission] = useCameraPermissions();
  const [permissionOverride, setPermissionOverride] = useState<typeof permission>();
  const [state, setState] = useState<PairingState>({ status: 'scanning' });
  const [permissionPending, setPermissionPending] = useState(false);
  const [focused, setFocused] = useState(false);
  const operationId = useRef(0);
  const operationInFlight = useRef(false);
  const mounted = useRef(false);
  const focusedRef = useRef(false);
  const getPermissionRef = useRef(getPermission);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      operationId.current += 1;
      operationInFlight.current = false;
    };
  }, []);

  useEffect(() => {
    getPermissionRef.current = getPermission;
  }, [getPermission]);

  useFocusEffect(useCallback(() => {
    focusedRef.current = true;
    setFocused(true);
    setState({ status: 'scanning' });
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active') return;
      void getPermissionRef.current().then((result) => {
        if (mounted.current && focusedRef.current) setPermissionOverride(result);
      }).catch(() => {
        if (mounted.current && focusedRef.current) setState({ status: 'error', message: 'Não foi possível verificar a permissão da câmera.' });
      });
    });
    void getPermissionRef.current().then((result) => {
      if (mounted.current && focusedRef.current) setPermissionOverride(result);
    }).catch(() => undefined);
    return () => {
      focusedRef.current = false;
      setFocused(false);
      setPermissionPending(false);
      subscription.remove();
      operationId.current += 1;
      operationInFlight.current = false;
    };
  }, []));

  const currentPermission = permissionOverride ?? permission;

  async function openSettings() {
    try {
      await Linking.openSettings();
    } catch {
      setState({ status: 'error', message: 'Não foi possível abrir as configurações. Ative a câmera nas permissões do aplicativo.' });
    }
  }

  async function enableCamera() {
    if (permissionPending) return;
    setPermissionPending(true);
    try {
      const result = await requestPermission();
      if (mounted.current && focusedRef.current) setPermissionOverride(result);
      if (mounted.current && focusedRef.current && !result.granted) {
        setState({ status: 'error', message: 'A permissão da câmera foi negada. Ative o acesso nas configurações para ler o QR Code.' });
      }
    } catch {
      if (mounted.current && focusedRef.current) setState({ status: 'error', message: 'Não foi possível acessar a câmera. Verifique a permissão e tente novamente.' });
    } finally {
      if (mounted.current && focusedRef.current) setPermissionPending(false);
    }
  }

  async function scanQr(data: string) {
    if (operationInFlight.current || state.status !== 'scanning') return;
    operationInFlight.current = true;
    const operation = ++operationId.current;
    const token = parsePairingToken(data);
    if (!token) {
      setState({ status: 'error', message: pairingErrorMessage(new PairingTokenError('invalid')) });
      operationInFlight.current = false;
      return;
    }

    setState({ status: 'checking' });
    try {
      const preview = await pairing.validate(token);
      if (mounted.current && operation === operationId.current) setState({ status: 'confirming', token, preview });
    } catch (error) {
      if (mounted.current && operation === operationId.current) {
        setState({ status: 'error', message: pairingErrorMessage(error) });
      }
    } finally {
      if (operation === operationId.current) operationInFlight.current = false;
    }
  }

  async function confirmPairing() {
    if (state.status !== 'confirming' || operationInFlight.current) return;
    operationInFlight.current = true;
    const operation = ++operationId.current;
    const { token, preview } = state;
    setState({ status: 'completing', token, preview });
    try {
      const result = await pairing.complete(token);
      if (mounted.current && operation === operationId.current) setState({ status: 'complete', result });
    } catch (error) {
      if (mounted.current && operation === operationId.current) {
        setState({ status: 'error', message: pairingCompletionErrorMessage(error), canCheckDevices: true });
      }
    } finally {
      if (operation === operationId.current) operationInFlight.current = false;
    }
  }

  function cancelConfirmation() {
    operationId.current += 1;
    operationInFlight.current = false;
    setState({ status: 'scanning' });
  }

  const cameraGranted = currentPermission?.granted === true;
  const pending = state.status === 'checking' || state.status === 'completing';

  return (
    <SafeAreaView edges={['bottom', 'left', 'right']} style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.main}>
          <View style={styles.intro}>
            <Text style={styles.eyebrow}>{t('pairing.eyebrow')}</Text>
            <Text style={styles.title}>{t('pairing.title')}</Text>
            <Text style={styles.description}>{t('pairing.description')}</Text>
          </View>

          {state.status === 'complete' ? (
            <Card style={styles.resultCard}>
              <Text style={styles.resultTitle}>
                {state.result.isDemo ? t('pairing.demoCreated') : t('pairing.computerAssociated')}
              </Text>
              <Text style={styles.description}>{state.result.name}</Text>
              <Text style={styles.resultNote}>
                {state.result.isDemo
                  ? t('pairing.demoNote')
                  : t('pairing.activeNote')}
              </Text>
              <Button label={t('pairing.viewComputers')} onPress={() => router.dismissTo('/computers')} style={styles.actionButton} />
            </Card>
          ) : state.status === 'confirming' || state.status === 'completing' ? (
            <Card style={styles.confirmCard}>
              <Text style={styles.sectionTitle}>{t('pairing.confirm')}</Text>
              <Text style={styles.deviceName}>{state.preview.device.name}</Text>
              <Text style={styles.description}>
                {t('pairing.managedAccount', { name: state.preview.device.managedUser ?? 'não informada' })}
              </Text>
              {state.preview.device.isDemo ? (
                <Text style={styles.demoNote}>
                  {t('pairing.demoConfirm')}
                </Text>
              ) : null}
              <Text style={styles.expiry}>{t('pairing.qrValid', { time: new Date(state.preview.expiresAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) })}</Text>
              <Button
                accessibilityState={{ disabled: state.status === 'completing' }}
                disabled={state.status === 'completing'}
                label={state.status === 'completing' ? t('pairing.creating') : t('pairing.confirmLink')}
                onPress={confirmPairing}
                style={styles.actionButton}
              />
              {state.status === 'completing' ? <ActivityIndicator color={colors.accent} /> : null}
              <Button
                label={t('common.cancel')}
                disabled={state.status === 'completing'}
                onPress={cancelConfirmation}
                style={styles.secondaryButton}
              />
            </Card>
          ) : (
            <>
              <View style={styles.scanner}>
                {focused && cameraGranted && state.status === 'scanning' ? (
                  <CameraView
                    active
                    barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                    onMountError={() => {
                      if (focusedRef.current) setState({ status: 'error', message: 'Não foi possível iniciar a câmera. Tente novamente.' });
                    }}
                    onBarcodeScanned={({ data, type }) => {
                      if (type === 'qr') void scanQr(data);
                    }}
                    style={StyleSheet.absoluteFill}
                  />
                ) : null}
                <View pointerEvents="none" style={styles.viewfinder}>
                  <View style={[styles.corner, styles.topLeft]} />
                  <View style={[styles.corner, styles.topRight]} />
                  <View style={[styles.corner, styles.bottomLeft]} />
                  <View style={[styles.corner, styles.bottomRight]} />
                </View>
                {pending ? (
                  <View style={styles.pendingOverlay}>
                    <ActivityIndicator color={darkColors.accentText} />
                    <Text style={styles.scannerText}>{state.status === 'checking' ? t('pairing.validating') : t('pairing.creating')}</Text>
                  </View>
                ) : state.status === 'error' && cameraGranted ? (
                  <View style={styles.permissionPrompt}>
                    <Text accessibilityRole="alert" style={styles.error}>{state.message}</Text>
                    <Button palette={darkColors} label={t('pairing.readAnother')} onPress={() => setState({ status: 'scanning' })} style={styles.permissionButton} />
                    {state.canCheckDevices ? (
                      <Button palette={darkColors} label="Ver computadores" onPress={() => router.dismissTo('/computers')} style={styles.permissionButton} />
                    ) : null}
                  </View>
                ) : !cameraGranted ? (
                  <View style={styles.permissionPrompt}>
                    {state.status === 'error' ? (
                      <Text accessibilityRole="alert" style={styles.error}>{state.message}</Text>
                    ) : null}
                    <Text style={styles.scannerTitle}>{t('pairing.cameraNeeded')}</Text>
                    <Text style={styles.scannerText}>{t('pairing.cameraDescription')}</Text>
                    {currentPermission?.canAskAgain !== false ? (
                      <Button
                        label={permissionPending ? t('pairing.requestAccess') : t('pairing.enableCamera')}
                        palette={darkColors}
                        disabled={permissionPending}
                        onPress={enableCamera}
                        style={styles.permissionButton}
                      />
                    ) : (
                      <Button palette={darkColors} label={t('pairing.openSettings')} onPress={() => void openSettings()} style={styles.permissionButton} />
                    )}
                  </View>
                ) : null}
              </View>

              <Text style={styles.demoNote}>
                {t('pairing.qrNote')}
              </Text>
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: ColorPalette) => StyleSheet.create({
  safeArea: { backgroundColor: colors.background, flex: 1 },
  content: { flexGrow: 1, justifyContent: 'center', padding: spacing.lg, paddingBottom: spacing.xxl },
  main: { alignSelf: 'center', gap: spacing.lg, maxWidth: 440, width: '100%' },
  intro: { gap: spacing.sm },
  eyebrow: { color: colors.accentText, fontSize: typography.label, fontWeight: '600', letterSpacing: 1.2 },
  title: { color: colors.textPrimary, fontSize: typography.title, fontWeight: '700' },
  description: { color: colors.textSecondary, fontSize: typography.body, lineHeight: 21 },
  scanner: {
    alignItems: 'center',
    alignSelf: 'center',
    aspectRatio: 1,
    backgroundColor: darkColors.background,
    borderColor: darkColors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    justifyContent: 'center',
    maxWidth: 320,
    overflow: 'hidden',
    position: 'relative',
    width: '100%',
  },
  viewfinder: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  corner: { height: 32, position: 'absolute', width: 32 },
  topLeft: { borderLeftColor: darkColors.accent, borderLeftWidth: 3, borderTopColor: darkColors.accent, borderTopWidth: 3, left: spacing.lg, top: spacing.lg },
  topRight: { borderRightColor: darkColors.accent, borderRightWidth: 3, borderTopColor: darkColors.accent, borderTopWidth: 3, right: spacing.lg, top: spacing.lg },
  bottomLeft: { borderBottomColor: darkColors.accent, borderBottomWidth: 3, borderLeftColor: darkColors.accent, borderLeftWidth: 3, bottom: spacing.lg, left: spacing.lg },
  bottomRight: { borderBottomColor: darkColors.accent, borderBottomWidth: 3, borderRightColor: darkColors.accent, borderRightWidth: 3, bottom: spacing.lg, right: spacing.lg },
  pendingOverlay: { alignItems: 'center', backgroundColor: darkColors.background, gap: spacing.md, padding: spacing.xl },
  permissionPrompt: { alignItems: 'center', gap: spacing.md, padding: spacing.xl },
  scannerTitle: { color: darkColors.textPrimary, fontSize: typography.body, fontWeight: '600', textAlign: 'center' },
  scannerText: { color: darkColors.textSecondary, fontSize: typography.label, lineHeight: 18, textAlign: 'center' },
  permissionButton: { marginTop: spacing.xs, minWidth: 190 },
  demoNote: { color: colors.textMuted, fontSize: typography.label, lineHeight: 18, textAlign: 'center' },
  error: { color: darkColors.accentText, fontSize: typography.label, lineHeight: 18, textAlign: 'center' },
  confirmCard: { gap: spacing.md },
  sectionTitle: { color: colors.textPrimary, fontSize: typography.body, fontWeight: '600' },
  deviceName: { color: colors.textPrimary, fontSize: typography.title, fontWeight: '700' },
  expiry: { color: colors.textMuted, fontSize: typography.label },
  actionButton: { alignSelf: 'stretch', marginTop: spacing.xs },
  secondaryButton: { alignSelf: 'stretch', borderColor: colors.border },
  resultCard: { alignItems: 'center', gap: spacing.md },
  resultTitle: { color: colors.textPrimary, fontSize: typography.body, fontWeight: '600', textAlign: 'center' },
  resultNote: { color: colors.textSecondary, fontSize: typography.label, lineHeight: 18, textAlign: 'center' },
});

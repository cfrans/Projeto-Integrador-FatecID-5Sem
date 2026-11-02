import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect, useGlobalSearchParams } from 'expo-router';
import { Button } from '@/components/ui/Button';
import { devices, devicesErrorMessage, type PairedComputer } from '@/features/devices/services/devices';
import { useLanguage } from '@/features/i18n/LanguageProvider';
import { useTheme, useThemedStyles } from '@/features/theme/ThemeProvider';
import { spacing, type ColorPalette } from '@/theme';
import { selectRestrictionComputer } from './services/device-selection';
import { SimulationProvider } from './SimulationProvider';
import { RestrictionComputerSelector } from './RestrictionComputerSelector';

type DeviceState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'loaded'; computers: PairedComputer[] };

const DeviceContext = createContext<PairedComputer | null | undefined>(undefined);

export function RestrictionDeviceProvider({ children, showTools = true }: { children: ReactNode; showTools?: boolean }) {
  const { deviceId } = useGlobalSearchParams<{ deviceId?: string | string[] }>();
  const routeId = typeof deviceId === 'string' ? deviceId : deviceId === undefined ? null : '';
  const [selection, setSelection] = useState<{ routeId: string | null; id: string | null }>({ routeId, id: routeId });
  const [state, setState] = useState<DeviceState>({ status: 'loading' });
  const requestId = useRef(0);
  const { t, localize } = useLanguage();
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const selectedId = routeId !== null && selection.routeId !== routeId ? routeId : selection.id;

  const loadComputers = useCallback(() => {
    const request = ++requestId.current;
    setState({ status: 'loading' });
    devices.listPairedComputers()
      .then((computers) => {
        if (request !== requestId.current) return;
        setState({ status: 'loaded', computers });
        setSelection((current) => {
          const id = routeId !== null && current.routeId !== routeId ? routeId : current.id;
          return { routeId: routeId ?? current.routeId, id: id ?? selectRestrictionComputer(computers, null)?.id ?? null };
        });
      })
      .catch((error: unknown) => {
        if (request === requestId.current) setState({ status: 'error', message: devicesErrorMessage(error) });
      });
  }, [routeId]);

  useFocusEffect(useCallback(() => {
    loadComputers();
    return () => { requestId.current += 1; };
  }, [loadComputers]));

  const computers = state.status === 'loaded' ? state.computers.filter((computer) => computer.isPaired) : [];
  const computer = selectRestrictionComputer(computers, selectedId);

  return (
    <DeviceContext.Provider value={computer}>
      <View style={styles.container}>
        {state.status === 'loading' ? <ActivityIndicator style={styles.loading} color={colors.accent} /> : null}
        {state.status === 'error' ? (
          <View style={styles.messageBlock}>
            <Text accessibilityRole="alert" style={styles.message}>{localize(state.message)}</Text>
            <Button label={t('common.retry')} onPress={loadComputers} />
          </View>
        ) : null}
        {state.status === 'loaded' ? (
          <>
            {computers.length ? (
              <RestrictionComputerSelector computers={computers} computer={computer} showActions={showTools} onSelect={(id) => setSelection({ routeId: routeId ?? selection.routeId, id })} />
            ) : <View style={styles.messageBlock}><Text style={styles.message}>{t('restriction.pairToContinue')}</Text><Button label={t('common.addComputer')} onPress={() => router.push('/qr-scan')} /></View>}
          </>
        ) : null}
        <View style={styles.screens}><SimulationProvider computer={computer}>{children}</SimulationProvider></View>
      </View>
    </DeviceContext.Provider>
  );
}

export function useRestrictionComputer() {
  const computer = useContext(DeviceContext);
  if (computer === undefined) throw new Error('RestrictionDeviceProvider is required');
  return computer;
}

const createStyles = (colors: ColorPalette) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  screens: { flex: 1 },
  loading: { padding: spacing.lg },
  messageBlock: { padding: spacing.lg, gap: spacing.sm },
  message: { color: colors.textSecondary, fontSize: 14 },
});

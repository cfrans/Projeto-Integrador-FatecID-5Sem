import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect, useGlobalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/Button';
import { devices, devicesErrorMessage, type PairedComputer } from '@/features/devices/services/devices';
import { useLanguage } from '@/features/i18n/LanguageProvider';
import { useTheme, useThemedStyles } from '@/features/theme/ThemeProvider';
import { radius, spacing, type ColorPalette } from '@/theme';
import { selectRestrictionComputer } from './services/device-selection';

type DeviceState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'loaded'; computers: PairedComputer[] };

const DeviceContext = createContext<PairedComputer | null | undefined>(undefined);

export function RestrictionDeviceProvider({ children }: { children: ReactNode }) {
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
      <SafeAreaView edges={['top']} style={styles.container}>
        <View style={styles.selector}>
          <View style={styles.heading}>
            <Button label={t('common.back')} onPress={() => router.back()} />
            <Text style={styles.label}>{t('restriction.computer')}</Text>
          </View>
          {state.status === 'loading' ? <ActivityIndicator color={colors.accent} /> : null}
          {state.status === 'error' ? (
            <>
              <Text accessibilityRole="alert" style={styles.message}>{localize(state.message)}</Text>
              <Button label={t('common.retry')} onPress={loadComputers} />
            </>
          ) : null}
          {state.status === 'loaded' ? (
            <>
              {!computer ? <Text style={styles.message}>{t(computers.length ? 'restriction.chooseComputer' : 'restriction.pairToContinue')}</Text> : null}
              <ScrollView horizontal contentContainerStyle={styles.list}>
                {computers.map((item) => (
                  <Pressable
                    key={item.id}
                    accessibilityRole="button"
                    accessibilityState={{ selected: item.id === computer?.id }}
                    onPress={() => setSelection({ routeId: routeId ?? selection.routeId, id: item.id })}
                    style={[styles.chip, item.id === computer?.id && styles.selected]}
                  >
                    <Text style={styles.name}>{item.name}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </>
          ) : null}
        </View>
        <View style={styles.screens}>{children}</View>
      </SafeAreaView>
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
  selector: { padding: spacing.md, gap: spacing.sm, borderBottomWidth: 1, borderColor: colors.border },
  heading: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  label: { color: colors.textSecondary, fontSize: 12 },
  message: { color: colors.textSecondary, fontSize: 14 },
  list: { gap: spacing.sm },
  chip: { padding: spacing.md, minHeight: 44, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  selected: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  name: { color: colors.textPrimary, fontSize: 14 },
});

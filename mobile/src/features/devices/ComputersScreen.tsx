import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/Button';
import { DeviceCard } from '@/features/devices/DeviceCard';
import { useLanguage } from '@/features/i18n/LanguageProvider';
import { devices, devicesErrorMessage, type PairedComputer } from '@/features/devices/services/devices';
import { radius, spacing, typography, type ColorPalette } from '@/theme';
import { useTheme, useThemedStyles } from '@/features/theme/ThemeProvider';

type ComputersState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'loaded'; computers: PairedComputer[] };

export function ComputersScreen() {
  const { t, localize } = useLanguage();
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [state, setState] = useState<ComputersState>({ status: 'loading' });
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [removalError, setRemovalError] = useState<string | null>(null);
  const requestId = useRef(0);
  const removeOperation = useRef(0);
  const removalPromptOpen = useRef(false);
  const removalInProgress = useRef(false);

  const loadComputers = useCallback((silent = false) => {
    if (silent && removalInProgress.current) return Promise.resolve();
    const request = ++requestId.current;
    if (!silent) setState({ status: 'loading' });
    return devices.listPairedComputers()
      .then((computers) => {
        if (request === requestId.current) setState({ status: 'loaded', computers });
      })
      .catch((error: unknown) => {
        if (request === requestId.current) setState({ status: 'error', message: devicesErrorMessage(error) });
      });
  }, []);

  useFocusEffect(useCallback(() => {
    setRemovingId(null);
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async (silent = false) => {
      await loadComputers(silent);
      if (!cancelled) timer = setTimeout(() => void poll(true), 5000);
    };
    void poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
      requestId.current += 1;
      removeOperation.current += 1;
      removalPromptOpen.current = false;
      setRemovingId(null);
    };
  }, [loadComputers]));

  const retry = useCallback(() => {
    setState({ status: 'loading' });
    loadComputers();
  }, [loadComputers]);

  const computers = state.status === 'loaded' ? state.computers : [];

  const removeAssociation = useCallback((computer: PairedComputer) => {
    if (!computer.isPaired || removingId || removalPromptOpen.current) return;
    removalPromptOpen.current = true;

    Alert.alert(
      t('device.removeTitle'),
      t('device.removeDescription', { name: computer.name }),
      [
        { text: t('common.cancel'), style: 'cancel', onPress: () => { removalPromptOpen.current = false; } },
        {
          text: t('device.remove'),
          style: 'destructive',
          onPress: async () => {
            removalPromptOpen.current = false;
            const operation = ++removeOperation.current;
            removalInProgress.current = true;
            requestId.current += 1;
            setRemovingId(computer.id);
            setRemovalError(null);
            try {
              await devices.removeAssociation(computer.id);
              if (operation === removeOperation.current) await loadComputers();
            } catch (error) {
              if (operation === removeOperation.current) setRemovalError(devicesErrorMessage(error));
            } finally {
              removalInProgress.current = false;
              if (operation === removeOperation.current) setRemovingId(null);
            }
          },
        },
      ],
      { cancelable: false },
    );
  }, [loadComputers, removingId, t]);

  return (
    <SafeAreaView edges={['bottom', 'left', 'right']} style={styles.safeArea}>
      <FlatList
        contentContainerStyle={styles.content}
        data={computers}
        ItemSeparatorComponent={ItemSeparator}
        keyExtractor={(computer) => computer.id}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            {state.status === 'loading' ? (
              <>
                <ActivityIndicator color={colors.accent} />
                <Text style={styles.stateText}>{t('common.loadingComputers')}</Text>
              </>
            ) : null}
            {state.status === 'error' ? (
              <>
                <Text style={styles.stateTitle}>{t('common.loadError')}</Text>
                <Text style={styles.stateText}>{localize(state.message)}</Text>
                <Button label={t('common.retry')} onPress={retry} />
              </>
            ) : null}
            {state.status === 'loaded' ? (
              <>
                <Text style={styles.stateTitle}>{t('home.noneTitle')}</Text>
                <Text style={styles.stateText}>{t('home.noneDescription')}</Text>
              </>
            ) : null}
          </View>
        }
        ListHeaderComponent={
          <View style={styles.listHeader}>
            <Text style={styles.description}>
              {t('home.subtitle')}
            </Text>
            <Button
              label={t('common.addComputer')}
              onPress={() => router.push('/qr-scan')}
            />
            {removalError ? <Text accessibilityRole="alert" style={styles.error}>{localize(removalError)}</Text> : null}
          </View>
        }
        renderItem={({ item }) => (
          <DeviceCard
            computer={item}
            onRemove={() => removeAssociation(item)}
            removing={removingId === item.id}
          />
        )}
      />
    </SafeAreaView>
  );
}

function ItemSeparator() {
  const styles = useThemedStyles(createStyles);
  return <View style={styles.separator} />;
}

const createStyles = (colors: ColorPalette) => StyleSheet.create({
  safeArea: { backgroundColor: colors.background, flex: 1 },
  content: { flexGrow: 1, padding: spacing.lg, paddingBottom: spacing.xxl },
  listHeader: { gap: spacing.md, marginBottom: spacing.lg },
  description: { color: colors.textSecondary, fontSize: typography.body, lineHeight: 21 },
  separator: { height: spacing.sm },
  emptyState: {
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
  error: { color: colors.accentText, fontSize: typography.label, lineHeight: 18 },
});

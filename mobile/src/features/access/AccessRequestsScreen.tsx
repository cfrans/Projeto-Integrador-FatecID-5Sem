import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/Button';
import { loadPendingRequests, type PendingRequest } from '@/features/access/pendingRequests';
import { RequestCard, useRequestItems } from '@/features/access/RequestCards';
import { devices, devicesErrorMessage } from '@/features/devices/services/devices';
import { useLanguage } from '@/features/i18n/LanguageProvider';
import { useTheme, useThemedStyles } from '@/features/theme/ThemeProvider';
import { spacing, typography, type ColorPalette } from '@/theme';

type LoadState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'loaded' };

export function AccessRequestsScreen() {
  const { t, localize } = useLanguage();
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [pending, setPending] = useState<PendingRequest[]>([]);
  const requestId = useRef(0);
  const items = useRequestItems(pending);

  const load = useCallback((silent = false) => {
    const current = ++requestId.current;
    if (!silent) setState({ status: 'loading' });
    return devices.listPairedComputers()
      .then((computers) => loadPendingRequests(computers))
      .then((loaded) => {
        if (current !== requestId.current) return;
        setPending(loaded);
        setState({ status: 'loaded' });
      })
      .catch((error: unknown) => {
        if (current === requestId.current) setState({ status: 'error', message: devicesErrorMessage(error) });
      });
  }, []);

  useFocusEffect(useCallback(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async (silent = false) => {
      await load(silent);
      if (!cancelled) timer = setTimeout(() => void poll(true), 5000);
    };
    void poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
      requestId.current += 1;
    };
  }, [load]));

  return (
    <SafeAreaView edges={['bottom']} style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        {state.status === 'loading' ? (
          <View style={styles.state}>
            <ActivityIndicator color={colors.accent} />
            <Text style={styles.stateText}>{t('restriction.loadingComputers')}</Text>
          </View>
        ) : null}

        {state.status === 'error' ? (
          <View style={styles.state}>
            <Text style={styles.stateText}>{localize(state.message)}</Text>
            <Button label={t('common.retry')} onPress={() => void load()} />
          </View>
        ) : null}

        {state.status === 'loaded' && items.length === 0 ? <Text style={styles.stateText}>{t('access.empty')}</Text> : null}

        {state.status !== 'loading' ? items.map((item) => <RequestCard key={`${item.kind}-${item.id}`} item={item} />) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: ColorPalette) => StyleSheet.create({
  safeArea: { backgroundColor: colors.background, flex: 1 },
  content: { gap: spacing.md, padding: spacing.lg, paddingBottom: spacing.xxl },
  state: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xl },
  stateText: { color: colors.textSecondary, fontSize: typography.label, textAlign: 'center' },
});

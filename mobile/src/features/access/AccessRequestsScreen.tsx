import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/Button';
import { loadPendingRequestsReport, type PendingRequest } from '@/features/access/pendingRequests';
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
  const [history, setHistory] = useState(false);
  const requestId = useRef(0);
  const [failures, setFailures] = useState<{ computer: { id: string; name: string }; message: string }[]>([]);
  const items = useRequestItems(pending);

  const load = useCallback((silent = false) => {
    const current = ++requestId.current;
    if (!silent) setState({ status: 'loading' });
    return devices.listPairedComputers()
      .then((computers) => loadPendingRequestsReport(computers, history))
      .then((loaded) => {
        if (current !== requestId.current) return;
        setPending(loaded.pending);
        setFailures(loaded.failures);
        setState({ status: 'loaded' });
      })
      .catch((error: unknown) => {
        if (current === requestId.current) {
          setPending([]);
          setFailures([]);
          setState({ status: 'error', message: devicesErrorMessage(error) });
        }
      });
  }, [history]);

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
        <Button label={t(history ? 'access.showPending' : 'access.showHistory')} onPress={() => { requestId.current += 1; setPending([]); setState({ status: 'loading' }); setHistory(!history); }} />
        <Text accessibilityRole="header" style={styles.stateText}>{t(history ? 'access.historyTitle' : 'nav.requests')}</Text>
        {state.status === 'loading' ? (
          <View style={styles.state}>
            <ActivityIndicator color={colors.accent} />
            <Text style={styles.stateText}>{t('common.loadingComputers')}</Text>
          </View>
        ) : null}

        {state.status === 'error' ? (
          <View style={styles.state}>
            <Text style={styles.stateText}>{localize(state.message)}</Text>
            <Button label={t('common.retry')} onPress={() => void load()} />
          </View>
        ) : null}

        {state.status === 'loaded' && failures.length === 0 && items.length === 0 ? <Text style={styles.stateText}>{t(history ? 'access.historyEmpty' : 'access.empty')}</Text> : null}

        {state.status === 'loaded' && failures.length > 0 ? (
          <View style={styles.state}>
            <Text accessibilityRole="alert" style={styles.stateText}>{t('access.partialError')}</Text>
            {failures.map((failure) => <Text key={failure.computer.id} style={styles.stateText}>{failure.computer.name}: {localize(failure.message)}</Text>)}
            <Button label={t('common.retry')} onPress={() => void load()} />
          </View>
        ) : null}

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

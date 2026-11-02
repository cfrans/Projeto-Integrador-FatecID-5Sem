import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, AppState, ScrollView, Text, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/Button';
import { useSession } from '@/features/auth/SessionProvider';
import { devices, devicesErrorMessage } from '@/features/devices/services/devices';
import { useLanguage } from '@/features/i18n/LanguageProvider';
import { useTheme, useThemedStyles } from '@/features/theme/ThemeProvider';
import { loadSynchronization, synchronizationStatus, type SynchronizationEntry } from './services/synchronization';
import { managementStyles } from './management-styles';

export function SynchronizationScreen() {
  const { guardian } = useSession();
  const { deviceId } = useLocalSearchParams<{ deviceId?: string | string[] }>();
  const selectedId = typeof deviceId === 'string' ? deviceId : deviceId === undefined ? null : '';
  const { t, localize, language } = useLanguage();
  const { colors } = useTheme();
  const styles = useThemedStyles(managementStyles);
  const [entries, setEntries] = useState<SynchronizationEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [checkedAt, setCheckedAt] = useState<Date | null>(null);
  const reload = useRef<() => void>(() => undefined);

  useFocusEffect(useCallback(() => {
    if (!guardian?.id) return;
    let disposed = false;
    let foreground = AppState.currentState !== 'background' && AppState.currentState !== 'inactive';
    let inFlight = false;
    let epoch = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    setEntries([]);
    setLoading(true);
    setError('');
    setCheckedAt(null);
    const poll = async () => {
      if (disposed || !foreground || inFlight) return;
      clearTimeout(timer);
      inFlight = true;
      const request = epoch;
      setRefreshing(true);
      try {
        const computers = await devices.listPairedComputers();
        const selected = computers.filter((computer) => computer.isPaired && (selectedId === null || computer.id === selectedId));
        const next = await loadSynchronization(selected);
        if (!disposed && foreground && request === epoch) {
          setEntries(next);
          setError(selectedId !== null && !selected.length ? t('sync.missingComputer') : '');
          setCheckedAt(new Date());
        }
      } catch (cause) {
        if (!disposed && foreground && request === epoch) { setEntries([]); setError(devicesErrorMessage(cause)); }
      } finally {
        inFlight = false;
        if (!disposed && foreground) {
          setLoading(false);
          setRefreshing(false);
          timer = setTimeout(() => void poll(), request === epoch ? 5000 : 0);
        }
      }
    };
    reload.current = () => { void poll(); };
    void poll();
    const subscription = AppState.addEventListener('change', (state) => {
      foreground = state === 'active';
      epoch += 1;
      clearTimeout(timer);
      if (foreground) void poll();
    });
    return () => { disposed = true; clearTimeout(timer); subscription.remove(); reload.current = () => undefined; };
  }, [guardian?.id, selectedId, t]));

  function format(date: string | Date | null) {
    return date ? new Intl.DateTimeFormat(language, { dateStyle: 'short', timeStyle: 'medium' }).format(new Date(date)) : t('sync.notConfirmed');
  }

  return <SafeAreaView edges={['bottom', 'left', 'right']} style={styles.screen}>
    <ScrollView contentContainerStyle={styles.content}>
      <Text accessibilityRole="header" style={styles.title}>{t('sync.title')}</Text>
      <Text style={styles.body}>{t('sync.description')}</Text>
      <Button label={t('sync.refresh')} loading={refreshing} disabled={refreshing} onPress={() => reload.current()} />
      {checkedAt ? <Text style={styles.body}>{t('sync.checkedAt', { time: format(checkedAt) })}</Text> : null}
      {loading ? <ActivityIndicator color={colors.accent} /> : null}
      {error ? <Text accessibilityRole="alert" style={styles.error}>{localize(error)}</Text> : null}
      {!loading && !error && !entries.length ? <View style={styles.card}><Text style={styles.body}>{t('sync.empty')}</Text><Button label={t('common.addComputer')} onPress={() => router.push('/qr-scan')} /></View> : null}
      {entries.map((entry) => {
        const status = synchronizationStatus(entry);
        const snapshot = entry.snapshot;
        return <View key={entry.computer.id} style={styles.card}>
          <Text style={styles.heading}>{entry.computer.name}</Text>
          <Text accessibilityLiveRegion="polite" style={status === 'applied' ? styles.success : status === 'error' ? styles.error : styles.label}>{t(`sync.status.${status}`)}</Text>
          {entry.error ? <Text accessibilityRole="alert" style={styles.error}>{localize(entry.error)}</Text> : null}
          {snapshot ? <>
            <Text style={styles.body}>{t('sync.lastSeen', { time: format(snapshot.connection.lastSeen) })}</Text>
            <Text style={styles.body}>{t('sync.sentRevision', { revision: snapshot.revision })}</Text>
            <Text style={styles.body}>{t('sync.appliedRevision', { revision: snapshot.appliedRevision ?? t('sync.notConfirmed') })}</Text>
            <Text style={styles.body}>{t('sync.appliedAt', { time: format(snapshot.appliedAt) })}</Text>
            {snapshot.revision !== snapshot.appliedRevision ? <Text style={styles.body}>{t('sync.waiting')}</Text> : null}
            {status === 'offline' ? <Text style={styles.body}>{t('sync.offlineHelp')}</Text> : null}
          </> : null}
          {entry.computer.isDemo ? <Button label={t('nav.restrictions')} onPress={() => router.push({ pathname: '/restrictions/browsers', params: { deviceId: entry.computer.id } })} /> : null}
        </View>;
      })}
    </ScrollView>
  </SafeAreaView>;
}

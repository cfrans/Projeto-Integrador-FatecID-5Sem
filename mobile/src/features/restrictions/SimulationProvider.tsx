import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Button } from '@/components/ui/Button';
import { ApiError, apiErrorMessage } from '@/lib/api';
import { useLanguage } from '@/features/i18n/LanguageProvider';
import { useTheme } from '@/features/theme/ThemeProvider';
import type { PairedComputer } from '@/features/devices/services/devices';
import { readSimulation, updateSimulation, type SimulationSettings, type SimulationSnapshot } from './services/simulation';

type SimulationContextValue = {
  snapshot: SimulationSnapshot;
  save: (settings: Partial<SimulationSettings>) => Promise<boolean>;
  busy: boolean;
};

const SimulationContext = createContext<SimulationContextValue | null>(null);

export function SimulationProvider({ computer, children }: { computer: PairedComputer | null; children: ReactNode }) {
  const [stored, setStored] = useState<{ deviceId: string; snapshot: SimulationSnapshot } | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const current = useRef<SimulationSnapshot | null>(null);
  const saving = useRef(false);
  const generation = useRef(0);
  const active = useRef(false);
  const deviceId = computer?.id ?? null;
  const isDemo = computer?.isDemo === true;
  const snapshot = stored && stored.deviceId === deviceId ? stored.snapshot : null;
  const { t, localize, language } = useLanguage();
  const { colors } = useTheme();

  const load = useCallback(async () => {
    if (saving.current || !deviceId || !isDemo) return;
    const request = ++generation.current;
    try {
      const next = await readSimulation(deviceId);
      if (active.current && request === generation.current) {
        current.current = next;
        setStored({ deviceId, snapshot: next });
        setError('');
      }
    } catch (cause) {
      if (active.current && request === generation.current) {
        if (cause instanceof ApiError && (cause.status === 401 || cause.status === 404)) {
          current.current = null;
          setStored(null);
        }
        setError(apiErrorMessage(cause));
      }
    }
  }, [deviceId, isDemo]);

  useFocusEffect(useCallback(() => {
    active.current = true;
    setBusy(saving.current);
    setError('');
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      await load();
      if (!cancelled) timer = setTimeout(() => void poll(), 2000);
    };
    if (deviceId && isDemo) void poll();
    return () => { cancelled = true; active.current = false; generation.current += 1; clearTimeout(timer); };
  }, [deviceId, isDemo, load]));

  async function save(settings: Partial<SimulationSettings>) {
    if (!deviceId || !snapshot || !current.current || saving.current) return false;
    saving.current = true;
    const request = ++generation.current;
    setBusy(true);
    try {
      const next = await updateSimulation(deviceId, current.current.revision, settings);
      if (!active.current || request !== generation.current) return false;
      current.current = next;
      setStored({ deviceId, snapshot: next });
      setError('');
      return true;
    } catch (cause) {
      if (active.current && request === generation.current) setError(apiErrorMessage(cause));
      return false;
    } finally {
      saving.current = false;
      if (active.current) setBusy(false);
    }
  }

  return (
    <>
      {computer ? <View style={{ paddingHorizontal: 20, paddingBottom: 10, gap: 8 }}>
        {isDemo && snapshot ? <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
          {t(error ? 'simulation.connectionUnknown' : `simulation.client${snapshot.connection.status}`)}
          {snapshot.connection.lastSeen ? ` · ${t('simulation.lastContact', { time: new Intl.DateTimeFormat(language, { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date(snapshot.connection.lastSeen)) })}` : ''}
        </Text> : null}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: error ? colors.danger : snapshot?.appliedRevision === snapshot?.revision && snapshot && !busy ? colors.success : colors.textMuted }} />
          <Text testID="simulation-status" accessibilityLiveRegion="polite" style={{ color: colors.textSecondary, fontSize: 12, flexShrink: 1 }}>
            {t(!isDemo ? 'simulation.realUnavailable' : busy ? 'simulation.saving' : !snapshot ? 'simulation.loading' : snapshot.appliedRevision === snapshot.revision ? 'simulation.applied' : 'simulation.pending')}
            {snapshot?.appliedAt && snapshot.appliedRevision === snapshot.revision ? ` · ${new Intl.DateTimeFormat(language, { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date(snapshot.appliedAt))}` : ''}
          </Text>
        </View>
        {error ? <Text accessibilityRole="alert" style={{ color: colors.danger, fontSize: 12 }}>{localize(error)}</Text> : null}
        {error ? <Button label={t('common.retry')} disabled={busy} onPress={() => void load()} /> : null}
      </View> : null}
      <SimulationContext.Provider value={snapshot ? { snapshot, save, busy } : null}><View style={{ flex: 1 }} pointerEvents={busy ? 'none' : 'auto'} accessibilityState={{ busy }}>{children}</View></SimulationContext.Provider>
    </>
  );
}

export function useSimulation() {
  const context = useContext(SimulationContext);
  if (!context) throw new Error('SimulationProvider is required');
  return context;
}

export function useSimulationReady() {
  return useContext(SimulationContext) !== null;
}

export function useOptionalSimulation() {
  return useContext(SimulationContext);
}

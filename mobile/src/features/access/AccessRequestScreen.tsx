import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/Button';
import { CheckIcon } from '@/components/ui/FieldIcons';
import {
  clearRelease,
  createRelease,
  getRelease,
  releaseEnd,
  releaseOptions,
  remainingMinutes,
  storeRelease,
  totalMinutes,
  type Release,
  type ReleaseOptionId,
} from '@/features/access/services/release';
import { devices, devicesErrorMessage, type PairedComputer } from '@/features/devices/services/devices';
import { useLanguage } from '@/features/i18n/LanguageProvider';
import { ApplicationIcon } from '@/features/restrictions/ApplicationIcon';
import {
  installationRequestsErrorMessage,
  listInstallationRequests,
  type InstallationRequest,
} from '@/features/restrictions/services/installation-requests';
import { SimulationProvider, useSimulation, useSimulationReady } from '@/features/restrictions/SimulationProvider';
import { useTheme, useThemedStyles } from '@/features/theme/ThemeProvider';
import { fonts, radius, spacing, typography, type ColorPalette } from '@/theme';

type ComputerState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'missing' }
  | { status: 'loaded'; computer: PairedComputer };

type LoadState = 'loading' | 'ready' | 'error';

function firstParam(value: string | string[] | undefined) {
  return typeof value === 'string' ? value : '';
}

export function AccessRequestScreen() {
  const params = useLocalSearchParams<{
    deviceId?: string | string[];
    requestId?: string | string[];
    applicationName?: string | string[];
    demo?: string | string[];
    requesterName?: string | string[];
    computerName?: string | string[];
    minutes?: string | string[];
  }>();
  const deviceId = firstParam(params.deviceId);
  const requestId = firstParam(params.requestId);
  const applicationName = firstParam(params.applicationName);
  const demo = firstParam(params.demo) === '1';
  const [state, setState] = useState<ComputerState>({ status: 'loading' });
  const { t, localize } = useLanguage();
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  const loadComputer = useCallback(() => {
    if (demo) return;
    let active = true;
    setState({ status: 'loading' });
    devices.listPairedComputers()
      .then((computers) => {
        if (!active) return;
        const computer = computers.find((item) => item.id === deviceId && item.isPaired);
        setState(computer ? { status: 'loaded', computer } : { status: 'missing' });
      })
      .catch((error: unknown) => {
        if (active) setState({ status: 'error', message: devicesErrorMessage(error) });
      });
    return () => { active = false; };
  }, [deviceId, demo]);

  useFocusEffect(loadComputer);

  if (demo) {
    return (
      <SafeAreaView edges={['left', 'right']} style={styles.safeArea}>
        <DemoFlow
          requestId={requestId}
          applicationName={applicationName}
          requesterName={firstParam(params.requesterName)}
          computerName={firstParam(params.computerName)}
          minutes={Number(firstParam(params.minutes)) || 5}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['left', 'right']} style={styles.safeArea}>
      {state.status === 'loading' ? (
        <View style={styles.centerState}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : null}

      {state.status === 'error' ? (
        <View style={styles.message}>
          <Text accessibilityRole="alert" style={styles.stateText}>{localize(state.message)}</Text>
          <Button label={t('common.retry')} onPress={loadComputer} />
        </View>
      ) : null}

      {state.status === 'missing' || !requestId ? (
        <View style={styles.message}>
          <Text style={styles.emptyTitle}>{t('access.notPending')}</Text>
          <Button label={t('access.backHome')} onPress={() => router.replace('/home')} />
        </View>
      ) : null}

      {state.status === 'loaded' && requestId ? (
        <SimulationProvider computer={state.computer}>
          <AccessRequestContent computer={state.computer} requestId={requestId} applicationName={applicationName} />
        </SimulationProvider>
      ) : null}
    </SafeAreaView>
  );
}

type ContentProps = { computer: PairedComputer; requestId: string; applicationName: string };

function AccessRequestContent(props: ContentProps) {
  return useSimulationReady() ? <LiveFlow {...props} /> : null;
}

type Decision = 'APPROVED' | 'DENIED';

type FlowSource = {
  request: InstallationRequest | null;
  loadState: LoadState;
  errorMessage: string;
  decision: Decision | undefined;
  busy: boolean;
  decide: (decision: Decision) => Promise<boolean>;
};

function LiveFlow(props: ContentProps) {
  const { computer, requestId } = props;
  const { snapshot, save, busy } = useSimulation();
  const [request, setRequest] = useState<InstallationRequest | null>(null);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [errorMessage, setErrorMessage] = useState('');

  useFocusEffect(
    useCallback(() => {
      if (!snapshot.appliedAt) {
        setLoadState('loading');
        return;
      }
      let active = true;
      setErrorMessage('');

      listInstallationRequests(computer.id)
        .then((requests) => {
          if (!active) return;
          const found = requests.find((item) => item.id === requestId);
          if (found) setRequest(found);
          setLoadState('ready');
        })
        .catch((error: unknown) => {
          if (!active) return;
          setErrorMessage(installationRequestsErrorMessage(error));
          setLoadState('error');
        });

      return () => { active = false; };
    }, [computer.id, requestId, snapshot.appliedAt]),
  );

  const source: FlowSource = {
    request,
    loadState,
    errorMessage,
    decision: snapshot.settings.installationDecisions[requestId],
    busy,
    decide: (decision) => save({ installationDecisions: { [requestId]: decision } }),
  };

  return <AccessRequestFlow {...props} source={source} />;
}

type DemoProps = { requestId: string; applicationName: string; requesterName: string; computerName: string; minutes: number };

function DemoFlow({ requestId, applicationName, requesterName, computerName, minutes }: DemoProps) {
  const [decision, setDecision] = useState<Decision>();
  const [demo] = useState(() => ({
    computer: {
      id: 'demo-computer',
      name: computerName,
      status: 'online',
      managedUser: requesterName,
      lastSeen: null,
      isDemo: true,
      isPaired: true,
      associationId: null,
    } satisfies PairedComputer,
    request: {
      id: requestId,
      applicationName,
      requesterName,
      requestedAt: new Date(Date.now() - minutes * 60_000).toISOString(),
      ageRating: '12+',
    } satisfies InstallationRequest,
  }));

  const source: FlowSource = {
    request: demo.request,
    loadState: 'ready',
    errorMessage: '',
    decision,
    busy: false,
    decide: async (next) => {
      setDecision(next);
      return true;
    },
  };

  return <AccessRequestFlow computer={demo.computer} requestId={requestId} applicationName={applicationName} source={source} />;
}

function AccessRequestFlow({ computer, requestId, applicationName, source }: ContentProps & { source: FlowSource }) {
  const { request, loadState, errorMessage, decision, busy } = source;
  const { language, t, localize } = useLanguage();
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [step, setStep] = useState<'review' | 'time'>('review');
  const [optionId, setOptionId] = useState<ReleaseOptionId>('hour1');
  const [blockAtEnd, setBlockAtEnd] = useState(true);
  const [release, setRelease] = useState<Release | null>(() => getRelease(requestId));
  const [now, setNow] = useState(() => new Date());
  const appName = request?.applicationName ?? applicationName;
  const requesterName = request?.requesterName ?? computer.managedUser ?? computer.name;
  const minutesAgo = request ? Math.max(1, Math.round((now.getTime() - new Date(request.requestedAt).getTime()) / 60_000)) : 0;
  const timeFormat = new Intl.DateTimeFormat(language, { hour: '2-digit', minute: '2-digit' });

  const countingDown = decision === 'APPROVED' && release?.endsAt != null;

  useEffect(() => {
    if (!countingDown) return;
    const timer = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(timer);
  }, [countingDown]);

  function formatDuration(minutes: number) {
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    if (hours === 0) return t('access.minutes', { n: rest });
    return rest === 0 ? t('access.hours', { n: hours }) : t('access.hoursMinutes', { h: hours, m: rest });
  }

  async function confirmRelease() {
    const created = createRelease(optionId, blockAtEnd);
    storeRelease(requestId, created);
    setRelease(created);
    if (!(await source.decide('APPROVED'))) {
      clearRelease(requestId);
      setRelease(null);
    }
  }

  async function denyRequest() {
    await source.decide('DENIED');
  }

  async function endRelease() {
    if (await source.decide('DENIED')) {
      clearRelease(requestId);
      setRelease(null);
    }
  }

  const view =
    decision === 'APPROVED' ? 'released'
      : decision === 'DENIED' ? 'denied'
        : request ? step
          : loadState === 'loading' ? 'loading'
            : loadState === 'error' ? 'error'
              : 'missing';

  const header = (
    <>
      <View style={styles.banner}>
        <View style={styles.bannerDot} />
        <Text style={styles.bannerText}>{t('access.banner')}</Text>
      </View>

      <View style={styles.requester}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{requesterName.charAt(0).toUpperCase()}</Text>
        </View>
        <View style={styles.requesterCopy}>
          <Text style={styles.heading}>
            {t('access.heading', { name: requesterName })} <Text style={styles.headingApp}>{appName}</Text>
          </Text>
          <Text style={styles.requesterMeta}>
            {request ? `${computer.name} · ${t('access.ago', { n: minutesAgo })}` : computer.name}
          </Text>
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <ApplicationIcon name={appName} />
          <View style={styles.cardCopy}>
            <Text style={styles.applicationName}>{appName}</Text>
          </View>
          {request ? (
            <View style={styles.ageBadge}>
              <Text style={styles.ageText}>{request.ageRating}</Text>
            </View>
          ) : null}
        </View>
        <View style={styles.divider} />
        <DetailRow label={t('access.computer')} value={computer.name} styles={styles} />
        {computer.managedUser ? <DetailRow label={t('access.account')} value={computer.managedUser} styles={styles} /> : null}
        <DetailRow label={t('access.blockedBy')} value={t('access.blockedByInstall')} styles={styles} />
        {request ? (
          <DetailRow
            label={t('access.requestedAt')}
            value={new Intl.DateTimeFormat(language, { dateStyle: 'short', timeStyle: 'short' }).format(new Date(request.requestedAt))}
            styles={styles}
          />
        ) : null}
      </View>
    </>
  );

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {view === 'loading' ? (
        <View style={styles.centerState}>
          <ActivityIndicator color={colors.accent} />
          <Text style={styles.stateText}>{t('restriction.loadingComputer')}</Text>
        </View>
      ) : null}

      {view === 'error' ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>{t('restriction.installUnavailable')}</Text>
          <Text style={styles.stateText}>{localize(errorMessage)}</Text>
        </View>
      ) : null}

      {view === 'missing' ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>{t('access.notPending')}</Text>
          <Button label={t('access.backHome')} onPress={() => router.replace('/home')} />
        </View>
      ) : null}

      {view === 'review' || view === 'time' ? header : null}

      {view === 'review' ? (
        <>
          <View style={styles.actions}>
            <Button
              label={t('access.allowLimited')}
              variant="solid"
              icon={<CheckIcon color="#FFFFFF" />}
              disabled={busy}
              onPress={() => setStep('time')}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: busy }}
              disabled={busy}
              onPress={() => void denyRequest()}
              style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
            >
              <Text style={styles.secondaryText}>{t('access.deny')}</Text>
            </Pressable>
          </View>
          <Text style={styles.stateText}>{t('access.responseNote', { name: request?.requesterName ?? computer.managedUser ?? computer.name })}</Text>
        </>
      ) : null}

      {view === 'time' ? (
        <>
          <Text style={styles.sectionTitle}>{t('access.timeSection')}</Text>
          <View style={styles.optionGrid}>
            {releaseOptions.map((option) => {
              const selected = option.id === optionId;
              const end = releaseEnd(option.id, now);
              return (
                <Pressable
                  key={option.id}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  onPress={() => setOptionId(option.id)}
                  style={({ pressed }) => [styles.option, selected && styles.optionSelected, pressed && styles.pressed]}
                >
                  <Text style={styles.optionTitle}>{t(`access.option.${option.id}`)}</Text>
                  <Text style={styles.optionSubtitle}>
                    {option.id === 'week' ? t('access.perDay')
                      : end ? t('access.until', { time: timeFormat.format(end) })
                        : t('access.fixed')}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.blockCard}>
            <View style={styles.cardCopy}>
              <Text style={styles.applicationName}>{t('access.blockAtEnd')}</Text>
              <Text style={styles.stateText}>{t('access.blockAtEndDescription')}</Text>
            </View>
            <Switch
              accessibilityLabel={t('access.blockAtEnd')}
              onValueChange={setBlockAtEnd}
              thumbColor={colors.textPrimary}
              trackColor={{ false: colors.surfaceRaised, true: colors.accent }}
              value={blockAtEnd}
            />
          </View>

          <Text style={styles.localNotice}>{t('access.localNotice')}</Text>

          <View style={styles.actions}>
            <Button label={t('access.confirm')} variant="solid" disabled={busy} onPress={() => void confirmRelease()} />
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={() => setStep('review')}
              style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
            >
              <Text style={styles.secondaryText}>{t('common.cancel')}</Text>
            </Pressable>
          </View>
        </>
      ) : null}

      {view === 'released' ? (
        <>
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <ApplicationIcon name={appName} />
              <View style={styles.cardCopy}>
                <Text style={styles.applicationName}>{t('access.released', { app: appName })}</Text>
                <Text style={styles.stateText}>
                  {release
                    ? t(
                      release.endsAt === null ? 'access.releasedFixed' : release.blockAtEnd ? 'access.releasedUntilBlock' : 'access.releasedUntil',
                      {
                        start: timeFormat.format(new Date(release.startedAt)),
                        end: release.endsAt ? timeFormat.format(new Date(release.endsAt)) : '',
                      },
                    )
                    : t('access.releasedNoDetail')}
                </Text>
              </View>
            </View>
          </View>

          {release && release.endsAt ? (
            <ReleaseCountdown
              left={remainingMinutes(release, now) ?? 0}
              total={totalMinutes(release) ?? 0}
              formatDuration={formatDuration}
              styles={styles}
              label={t('access.remaining')}
              endedLabel={t('access.ended')}
              ofLabel={(left, total) => t('access.remainingOf', { left, total })}
            />
          ) : null}

          <Text style={styles.localNotice}>{t('access.localNotice')}</Text>

          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: busy }}
              disabled={busy}
              onPress={() => void endRelease()}
              style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
            >
              <Text style={styles.secondaryText}>{t('access.endNow')}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => router.replace('/home')} style={styles.linkButton}>
              <Text style={styles.linkText}>{t('access.backHome')}</Text>
            </Pressable>
          </View>
        </>
      ) : null}

      {view === 'denied' ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>{t('access.denied', { app: appName })}</Text>
          <Text style={styles.stateText}>{t('access.deniedDetail')}</Text>
          <Button label={t('access.backHome')} onPress={() => router.replace('/home')} />
        </View>
      ) : null}
    </ScrollView>
  );
}

type Styles = ReturnType<typeof createStyles>;

function DetailRow({ label, value, styles }: { label: string; value: string; styles: Styles }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

type CountdownProps = {
  left: number;
  total: number;
  formatDuration: (minutes: number) => string;
  styles: Styles;
  label: string;
  endedLabel: string;
  ofLabel: (left: string, total: string) => string;
};

function ReleaseCountdown({ left, total, formatDuration, styles, label, endedLabel, ofLabel }: CountdownProps) {
  const ratio = total > 0 ? Math.min(1, left / total) : 0;
  return (
    <View style={styles.countdown}>
      <View style={styles.countdownHeader}>
        <Text style={styles.stateText}>{label}</Text>
        <Text style={styles.detailValue}>{left === 0 ? endedLabel : ofLabel(formatDuration(left), formatDuration(total))}</Text>
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${ratio * 100}%` }]} />
      </View>
    </View>
  );
}

const createStyles = (colors: ColorPalette) => StyleSheet.create({
  safeArea: { backgroundColor: colors.background, flex: 1 },
  content: { gap: spacing.lg, padding: spacing.lg, paddingBottom: spacing.xxl },
  centerState: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xxl },
  message: { gap: spacing.md, padding: spacing.lg },
  emptyState: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, gap: spacing.md, padding: spacing.lg },
  emptyTitle: { color: colors.textPrimary, fontSize: typography.body, fontWeight: '600' },
  stateText: { color: colors.textSecondary, fontSize: typography.label, lineHeight: 18 },
  banner: { alignItems: 'center', alignSelf: 'flex-start', backgroundColor: colors.accentSoft, borderRadius: radius.pill, flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  requester: { alignItems: 'center', flexDirection: 'row', gap: spacing.md },
  avatar: { alignItems: 'center', backgroundColor: colors.surfaceRaised, borderRadius: radius.pill, height: 48, justifyContent: 'center', width: 48 },
  avatarText: { color: colors.accentText, fontSize: 20, fontWeight: '700' },
  requesterCopy: { flex: 1, gap: 2 },
  heading: { color: colors.textPrimary, fontSize: 26, fontFamily: fonts.title, letterSpacing: -0.6, lineHeight: 32 },
  headingApp: { color: colors.accentText },
  requesterMeta: { color: colors.textSecondary, fontSize: typography.label },
  bannerDot: { backgroundColor: colors.accentText, borderRadius: radius.pill, height: 8, width: 8 },
  bannerText: { color: colors.accentText, fontSize: typography.label, fontWeight: '700' },
  card: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg, borderWidth: 1, gap: spacing.sm, padding: spacing.md },
  cardHeader: { alignItems: 'center', flexDirection: 'row', gap: spacing.md },
  cardCopy: { flex: 1, gap: 2 },
  applicationName: { color: colors.textPrimary, fontSize: typography.body, fontWeight: '600' },
  ageBadge: { alignItems: 'center', borderColor: colors.textMuted, borderRadius: radius.pill, borderWidth: 1, minWidth: 48, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  ageText: { color: colors.textSecondary, fontSize: typography.label },
  divider: { backgroundColor: colors.border, height: 1, marginVertical: spacing.xs },
  detailRow: { flexDirection: 'row', gap: spacing.md, justifyContent: 'space-between' },
  detailLabel: { color: colors.textSecondary, fontSize: typography.label },
  detailValue: { color: colors.textPrimary, flexShrink: 1, fontSize: typography.label, textAlign: 'right' },
  actions: { gap: spacing.md },
  secondaryButton: { alignItems: 'center', borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, justifyContent: 'center', minHeight: 48 },
  secondaryText: { color: colors.textSecondary, fontSize: typography.button },
  linkButton: { alignItems: 'center', justifyContent: 'center', minHeight: 44 },
  linkText: { color: colors.accentText, fontSize: typography.label, fontWeight: '600' },
  sectionTitle: { color: colors.textSecondary, fontSize: 11, fontWeight: '600', letterSpacing: 0.8 },
  optionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  option: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, flexBasis: '48%', flexGrow: 1, gap: 2, minHeight: 56, padding: spacing.md },
  optionSelected: { backgroundColor: colors.accentSoft, borderColor: colors.accent },
  optionTitle: { color: colors.textPrimary, fontSize: typography.body, fontWeight: '600' },
  optionSubtitle: { color: colors.textSecondary, fontSize: typography.label },
  blockCard: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, flexDirection: 'row', gap: spacing.md, padding: spacing.md },
  localNotice: { color: colors.textMuted, fontSize: typography.label, lineHeight: 18 },
  countdown: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, gap: spacing.sm, padding: spacing.md },
  countdownHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  progressTrack: { backgroundColor: colors.surfaceRaised, borderRadius: radius.pill, height: 6, overflow: 'hidden' },
  progressFill: { backgroundColor: colors.accent, height: 6 },
  pressed: { opacity: 0.78 },
});

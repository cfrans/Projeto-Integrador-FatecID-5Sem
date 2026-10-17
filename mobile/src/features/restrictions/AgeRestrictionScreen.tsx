import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card } from '@/components/ui/Card';
import {
  devices,
  devicesErrorMessage,
  type PairedComputer,
} from '@/features/devices/services/devices';
import { colors, radius, spacing, typography } from '@/theme';
import { useLanguage } from '@/features/i18n/LanguageProvider';

type AgeRatingId = 'L' | '10' | '12' | '16' | '18';

type AgeRatingOption = {
  id: AgeRatingId;
  badge: string;
  title: string;
  description: string;
  blockedSummary: string;
};

type SyncStatus = 'synced' | 'syncing';

type ComputersLoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'loaded'; computers: PairedComputer[] };

const AGE_RATING_OPTIONS: readonly AgeRatingOption[] = [
  {
    id: 'L',
    badge: 'L',
    title: 'Livre',
    description: 'Sem restrição de idade',
    blockedSummary:
      '5 aplicativos instalados ficam bloqueados por essa faixa, incluindo Minecraft, Steam e Discord.',
  },
  {
    id: '10',
    badge: '10',
    title: '10 anos',
    description: 'Conteúdo leve, sem violência',
    blockedSummary:
      '4 aplicativos instalados ficam bloqueados por essa faixa, incluindo Steam, Discord e Telegram.',
  },
  {
    id: '12',
    badge: '12',
    title: '12 anos',
    description: 'Violência leve, linguagem branda',
    blockedSummary:
      '3 aplicativos instalados ficam bloqueados por essa faixa, incluindo Steam e Discord.',
  },
  {
    id: '16',
    badge: '16',
    title: '16 anos',
    description: 'Conteúdo adulto moderado',
    blockedSummary:
      '1 aplicativo instalado fica bloqueado por essa faixa, incluindo Steam.',
  },
  {
    id: '18',
    badge: '18',
    title: '18 anos',
    description: 'Sem filtro de classificação',
    blockedSummary:
      'Nenhum aplicativo instalado fica bloqueado por essa faixa etária.',
  },
];

const DEFAULT_AGE_RATING: AgeRatingId = '12';
const SYNC_FEEDBACK_DURATION_MS = 900;

export function AgeRestrictionScreen() {
  const { t } = useLanguage();
  const params = useLocalSearchParams<{ deviceId?: string; computer?: string }>();
  const [devicesState, setDevicesState] = useState<ComputersLoadState>({ status: 'loading' });
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [ratingsByDevice, setRatingsByDevice] = useState<Record<string, AgeRatingId>>({});
  const [fallbackRating, setFallbackRating] = useState<AgeRatingId>(DEFAULT_AGE_RATING);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('synced');

  const requestIdRef = useRef(0);
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (syncTimerRef.current) {
        clearTimeout(syncTimerRef.current);
      }
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      const request = ++requestIdRef.current;
      setDevicesState({ status: 'loading' });

      devices
        .listPairedComputers()
        .then((computers) => {
          if (request !== requestIdRef.current) return;
          setDevicesState({ status: 'loaded', computers });
        })
        .catch((error: unknown) => {
          if (request !== requestIdRef.current) return;
          setDevicesState({ status: 'error', message: devicesErrorMessage(error) });
        });

      return () => {
        requestIdRef.current += 1;
      };
    }, []),
  );

  const computers = devicesState.status === 'loaded' ? devicesState.computers : [];
  const requestedDeviceId =
    typeof params.deviceId === 'string' && params.deviceId.trim().length > 0
      ? params.deviceId.trim()
      : null;
  const effectiveDeviceId = selectedDeviceId ?? requestedDeviceId;
  const activeComputer =
    computers.find((item) => item.id === effectiveDeviceId) ?? computers[0] ?? null;

  const computerTitle =
    activeComputer?.name ??
    (typeof params.computer === 'string' && params.computer.trim().length > 0
      ? params.computer.trim()
      : 'Nenhum computador selecionado');

  const selectedId = activeComputer
    ? (ratingsByDevice[activeComputer.id] ?? DEFAULT_AGE_RATING)
    : fallbackRating;

  function selectAgeRating(nextId: AgeRatingId) {
    if (nextId === selectedId) return;

    if (activeComputer) {
      setRatingsByDevice((current) => ({ ...current, [activeComputer.id]: nextId }));
    } else {
      setFallbackRating(nextId);
    }

    setSyncStatus('syncing');

    if (syncTimerRef.current) {
      clearTimeout(syncTimerRef.current);
    }

    syncTimerRef.current = setTimeout(() => {
      setSyncStatus('synced');
      syncTimerRef.current = null;
    }, SYNC_FEEDBACK_DURATION_MS);
  }

  const activeOption =
    AGE_RATING_OPTIONS.find((option) => option.id === selectedId) ?? AGE_RATING_OPTIONS[2];

  function localizedTitle(id: AgeRatingId) {
    return t(`restriction.${id === 'L' ? 'free' : `age${id}`}`);
  }

  function localizedDescription(id: AgeRatingId) {
    const keys: Record<AgeRatingId, string> = {
      L: 'restriction.noAgeRestriction',
      '10': 'restriction.contentLight',
      '12': 'restriction.violenceLight',
      '16': 'restriction.moderateAdult',
      '18': 'restriction.noRatingFilter',
    };
    return t(keys[id]);
  }

  return (
    <SafeAreaView edges={['left', 'right']} style={styles.safeArea}>
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.main}>
            <View style={styles.headerRow}>
              <View style={styles.headerTitles}>
                <Text style={styles.computerName}>{computerTitle}</Text>
                <Text style={styles.screenSubtitle}>
                  {activeComputer?.managedUser
                    ? `${t('restriction.ageAdjustment')} · ${t('restriction.account', { name: activeComputer.managedUser })}`
                    : t('restriction.ageAdjustment')}
                </Text>
              </View>

              <View
                accessibilityLiveRegion="polite"
                style={[styles.syncBadge, syncStatus === 'syncing' && styles.syncBadgeActive]}
              >
                <View style={styles.syncDot} />
                <Text style={styles.syncBadgeText}>
                  {syncStatus === 'syncing' ? t('restriction.syncing') : t('restriction.sync')}
                </Text>
              </View>
            </View>

            {devicesState.status === 'loading' ? (
              <View style={styles.computerStatusRow}>
                <ActivityIndicator color={colors.accent} size="small" />
                <Text style={styles.computerStatusText}>{t('restriction.loadingAccountComputers')}</Text>
              </View>
            ) : null}

            {devicesState.status === 'error' ? (
              <Text style={styles.computerErrorText}>{devicesState.message}</Text>
            ) : null}

            {computers.length > 1 ? (
              <View style={styles.computerSwitcher}>
                <Text style={styles.switcherLabel}>{t('restriction.computer')}</Text>
                <ScrollView
                  contentContainerStyle={styles.switcherList}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                >
                  {computers.map((computer) => {
                    const isSelectedComputer = computer.id === activeComputer?.id;
                    return (
                      <Pressable
                        key={computer.id}
                        accessibilityRole="button"
                        accessibilityState={{ selected: isSelectedComputer }}
                        onPress={() => setSelectedDeviceId(computer.id)}
                        style={({ pressed }) => [
                          styles.computerChip,
                          isSelectedComputer && styles.computerChipSelected,
                          pressed && styles.optionPressed,
                        ]}
                      >
                        <Text
                          style={[
                            styles.computerChipText,
                            isSelectedComputer && styles.computerChipTextSelected,
                          ]}
                        >
                          {computer.name}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            ) : null}

            <Text style={styles.description}>
              Aplicativos com classificação acima da faixa escolhida ficam ocultos na loja e não
              podem ser abertos.
            </Text>

            <View accessibilityRole="radiogroup" style={styles.optionsList}>
              {AGE_RATING_OPTIONS.map((option) => {
                const selected = option.id === selectedId;

                return (
                  <Pressable
                    key={option.id}
                    accessibilityLabel={`${localizedTitle(option.id)}, ${localizedDescription(option.id)}`}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: selected }}
                    onPress={() => selectAgeRating(option.id)}
                    style={({ pressed }) => [
                      styles.optionCard,
                      selected && styles.optionCardSelected,
                      pressed && styles.optionPressed,
                    ]}
                  >
                    <View style={[styles.ratingBadge, selected && styles.ratingBadgeSelected]}>
                      <Text
                        style={[styles.ratingBadgeText, selected && styles.ratingBadgeTextSelected]}
                      >
                        {option.badge}
                      </Text>
                    </View>

                    <View style={styles.optionCopy}>
                      <Text style={styles.optionTitle}>{localizedTitle(option.id)}</Text>
                      <Text style={styles.optionDescription}>{localizedDescription(option.id)}</Text>
                    </View>

                    <View style={[styles.radioOuter, selected && styles.radioOuterSelected]}>
                      {selected ? <View style={styles.radioInner} /> : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>

            <Card style={styles.infoCard}>
              <View style={styles.infoIconCircle}>
                <Text style={styles.infoIconText}>i</Text>
              </View>
              <Text style={styles.infoText}>{activeOption.blockedSummary}</Text>
            </Card>
          </View>
        </ScrollView>

        {syncStatus === 'syncing' ? (
          <View accessibilityLiveRegion="polite" style={styles.syncToast}>
            <View style={styles.syncDot} />
            <Text style={styles.syncToastText}>Enviando alteração ao Web Service…</Text>
          </View>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: colors.background,
    flex: 1,
  },
  container: {
    flex: 1,
    position: 'relative',
  },
  content: {
    flexGrow: 1,
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  main: {
    alignSelf: 'center',
    gap: spacing.lg,
    maxWidth: 440,
    width: '100%',
  },
  headerRow: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: spacing.md,
  },
  headerTitles: {
    flex: 1,
    gap: 2,
    paddingRight: spacing.sm,
  },
  computerName: {
    color: colors.textPrimary,
    fontSize: 17,
    fontWeight: '700',
  },
  screenSubtitle: {
    color: colors.textSecondary,
    fontSize: typography.label,
  },
  syncBadge: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs + 1,
  },
  syncBadgeActive: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent,
  },
  syncDot: {
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    height: 6,
    width: 6,
  },
  syncBadgeText: {
    color: colors.accentText,
    fontSize: 11,
    fontWeight: '600',
  },
  computerStatusRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  computerStatusText: {
    color: colors.textSecondary,
    fontSize: typography.label,
  },
  computerErrorText: {
    color: colors.accentText,
    fontSize: typography.label,
  },
  computerSwitcher: {
    gap: spacing.xs,
  },
  switcherLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.8,
  },
  switcherList: {
    gap: spacing.sm,
  },
  computerChip: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
  },
  computerChipSelected: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent,
  },
  computerChipText: {
    color: colors.textSecondary,
    fontSize: typography.label,
    fontWeight: '500',
  },
  computerChipTextSelected: {
    color: colors.accentText,
    fontWeight: '600',
  },
  description: {
    color: colors.textSecondary,
    fontSize: typography.body,
    lineHeight: 20,
  },
  optionsList: {
    gap: spacing.sm,
  },
  optionCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 64,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  optionCardSelected: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent,
  },
  optionPressed: {
    opacity: 0.78,
  },
  ratingBadge: {
    alignItems: 'center',
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  ratingBadgeSelected: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent,
  },
  ratingBadgeText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  ratingBadgeTextSelected: {
    color: colors.accentText,
  },
  optionCopy: {
    flex: 1,
    gap: 2,
  },
  optionTitle: {
    color: colors.textPrimary,
    fontSize: typography.body,
    fontWeight: '600',
  },
  optionDescription: {
    color: colors.textSecondary,
    fontSize: typography.label,
    lineHeight: 16,
  },
  radioOuter: {
    alignItems: 'center',
    borderColor: colors.textMuted,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    height: 20,
    justifyContent: 'center',
    width: 20,
  },
  radioOuterSelected: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  radioInner: {
    backgroundColor: colors.textPrimary,
    borderRadius: radius.pill,
    height: 7,
    width: 7,
  },
  infoCard: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
  },
  infoIconCircle: {
    alignItems: 'center',
    borderColor: colors.textSecondary,
    borderRadius: radius.pill,
    borderWidth: 1.2,
    height: 16,
    justifyContent: 'center',
    marginTop: 1,
    width: 16,
  },
  infoIconText: {
    color: colors.textSecondary,
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 12,
  },
  infoText: {
    color: colors.textSecondary,
    flex: 1,
    fontSize: typography.label,
    lineHeight: 18,
  },
  syncToast: {
    alignItems: 'center',
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    bottom: spacing.md,
    flexDirection: 'row',
    gap: spacing.sm,
    left: spacing.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    position: 'absolute',
    right: spacing.lg,
  },
  syncToastText: {
    color: colors.textSecondary,
    fontSize: typography.label,
  },
});

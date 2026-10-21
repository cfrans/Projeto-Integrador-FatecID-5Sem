import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card } from '@/components/ui/Card';
import type { PairedComputer } from '@/features/devices/services/devices';
import { useLanguage } from '@/features/i18n/LanguageProvider';
import { radius, spacing, typography, type ColorPalette } from '@/theme';
import { useThemedStyles } from '@/features/theme/ThemeProvider';

type AgeRatingId = 'L' | '10' | '12' | '16' | '18';

type SyncStatus = 'synced' | 'syncing';

const AGE_RATING_OPTIONS: readonly AgeRatingId[] = ['L', '10', '12', '16', '18'];

const DEFAULT_AGE_RATING: AgeRatingId = '12';
const SYNC_FEEDBACK_DURATION_MS = 900;

export function AgeRestrictionScreen({ computer: activeComputer }: { computer: PairedComputer }) {
  const { t } = useLanguage();
  const styles = useThemedStyles(createStyles);
  const [selectedId, setSelectedId] = useState<AgeRatingId>(DEFAULT_AGE_RATING);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('synced');

  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (syncTimerRef.current) {
        clearTimeout(syncTimerRef.current);
      }
    };
  }, []);

  const computerTitle = activeComputer.name;

  function selectAgeRating(nextId: AgeRatingId) {
    if (nextId === selectedId) return;

    setSelectedId(nextId);

    setSyncStatus('syncing');

    if (syncTimerRef.current) {
      clearTimeout(syncTimerRef.current);
    }

    syncTimerRef.current = setTimeout(() => {
      setSyncStatus('synced');
      syncTimerRef.current = null;
    }, SYNC_FEEDBACK_DURATION_MS);
  }

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

            <Text style={styles.description}>
              {t('restriction.ageDescription')}
            </Text>

            <View accessibilityRole="radiogroup" style={styles.optionsList}>
              {AGE_RATING_OPTIONS.map((option) => {
                const selected = option === selectedId;

                return (
                  <Pressable
                    key={option}
                    accessibilityLabel={`${localizedTitle(option)}, ${localizedDescription(option)}`}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: selected }}
                    onPress={() => selectAgeRating(option)}
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
                        {option === 'L' ? t('restriction.free') : option}
                      </Text>
                    </View>

                    <View style={styles.optionCopy}>
                      <Text style={styles.optionTitle}>{localizedTitle(option)}</Text>
                      <Text style={styles.optionDescription}>{localizedDescription(option)}</Text>
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
              <Text style={styles.infoText}>{t(`restriction.summary${selectedId}`)}</Text>
            </Card>
          </View>
        </ScrollView>

        {syncStatus === 'syncing' ? (
          <View accessibilityLiveRegion="polite" style={styles.syncToast}>
            <View style={styles.syncDot} />
            <Text style={styles.syncToastText}>{t('restriction.sending')}</Text>
          </View>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const createStyles = (colors: ColorPalette) => StyleSheet.create({
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

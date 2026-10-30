import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { PairedComputer } from '@/features/devices/services/devices';
import { useLanguage } from '@/features/i18n/LanguageProvider';
import {
  installationRequestsErrorMessage,
  listInstallationRequests,
  type InstallationRequest,
} from '@/features/restrictions/services/installation-requests';
import { fonts, radius, spacing, typography, type ColorPalette } from '@/theme';
import { useTheme, useThemedStyles } from '@/features/theme/ThemeProvider';
import { useSimulation } from './SimulationProvider';
import { ApplicationIcon } from './ApplicationIcon';

type LoadState = 'loading' | 'ready' | 'error';

type SwitchControlProps = {
  accessibilityLabel?: string;
  value: boolean;
  onPress?: () => void;
};

export function InstallationRestrictionScreen({ computer }: { computer: PairedComputer }) {
  const [requests, setRequests] = useState<InstallationRequest[]>([]);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const { snapshot, save } = useSimulation();
  const { blockInstallation } = snapshot.settings;
  const { language, t, localize } = useLanguage();
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  useFocusEffect(
    useCallback(() => {
      if (!snapshot.appliedAt) {
        setLoadState('loading');
        return;
      }
      let active = true;
      setLoadState('loading');
      setErrorMessage('');

      listInstallationRequests(computer.id)
        .then((installationRequests) => {
          if (!active) return;
          setRequests(installationRequests);
          setLoadState('ready');
        })
        .catch((error: unknown) => {
          if (!active) return;
          setErrorMessage(installationRequestsErrorMessage(error));
          setLoadState('error');
        });

      return () => {
        active = false;
      };
    }, [computer.id, snapshot.appliedAt]),
  );


  function decideRequest(id: string, decision: 'APPROVED' | 'DENIED') {
    void save({ installationDecisions: { [id]: decision } });
  }

  return (
    <SafeAreaView edges={['left', 'right']} style={styles.safeArea}>
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text accessibilityRole="header" style={styles.screenTitle}>{t('nav.install')}</Text>

          {loadState === 'loading' ? (
            <View style={styles.centerState}>
              <ActivityIndicator color={colors.accent} />
              <Text style={styles.stateText}>{t('restriction.loadingComputer')}</Text>
            </View>
          ) : null}

          {loadState === 'error' ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>{t('restriction.installUnavailable')}</Text>
              <Text style={styles.stateText}>{localize(errorMessage)}</Text>
            </View>
          ) : null}

          {loadState === 'ready' ? (
            <>
              <View style={[styles.blockCard, blockInstallation && styles.blockCardActive]}>
                <View style={styles.blockCopy}>
                  <Text style={styles.blockTitle}>{t('restriction.blockInstall')}</Text>
                  <Text style={styles.blockDescription}>{t('restriction.blockInstallDescription')}</Text>
                </View>
                <SwitchControl
                  accessibilityLabel={t('restriction.blockInstall')}
                  value={blockInstallation}
                  onPress={() => void save({ blockInstallation: !blockInstallation })}
                />
              </View>

              <Text style={styles.sectionTitle}>{t('restriction.pendingRequests')}</Text>

              {requests.length > 0 ? (
                <View style={styles.requestList}>
                  {requests.map((request) => (
                    <View key={request.id} style={styles.requestCard}>
                      <View style={styles.requestHeader}>
                        <ApplicationIcon name={request.applicationName} />
                        <View style={styles.requestCopy}>
                          <Text style={styles.applicationName}>{request.applicationName}</Text>
                          <Text style={styles.requestDetails}>
                            {t('restriction.requestBy', { name: request.requesterName, time: new Intl.DateTimeFormat(language, { dateStyle: 'short', timeStyle: 'short' }).format(new Date(request.requestedAt)) })}
                          </Text>
                        </View>
                        <View style={styles.ageBadge}>
                          <Text style={styles.ageText}>{request.ageRating}</Text>
                        </View>
                      </View>

                      <View style={styles.actions}>
                        <Pressable
                          accessibilityLabel={t('restriction.allowInstall', { name: request.applicationName })}
                          accessibilityRole="button"
                          onPress={() => decideRequest(request.id, 'APPROVED')}
                          style={({ pressed }) => [styles.allowButton, pressed && styles.pressed]}
                        >
                          <Text style={styles.allowText}>{t('restriction.allow')}</Text>
                        </Pressable>
                        <Pressable
                          accessibilityLabel={t('restriction.denyInstall', { name: request.applicationName })}
                          accessibilityRole="button"
                          onPress={() => decideRequest(request.id, 'DENIED')}
                          style={({ pressed }) => [styles.denyButton, pressed && styles.pressed]}
                        >
                          <Text style={styles.denyText}>{t('restriction.deny')}</Text>
                        </Pressable>
                      </View>
                    </View>
                  ))}
                </View>
              ) : (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyTitle}>{t('restriction.noPendingRequests')}</Text>
                  <Text style={styles.stateText}>{t('restriction.newRequests')}</Text>
                </View>
              )}
            </>
          ) : null}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

function SwitchControl({ accessibilityLabel, value, onPress }: SwitchControlProps) {
  const { colors, scheme } = useTheme();
  const styles = useThemedStyles(createStyles);
  const style = [styles.switch, value && styles.switchOn];
  const thumbColor = scheme === 'dark' ? colors.textPrimary : colors.backgroundGlow;
  const thumb = (
    <View
      style={[
        styles.switchThumb,
        value && styles.switchThumbOn,
        value && { backgroundColor: thumbColor },
      ]}
    />
  );

  return onPress ? (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      onPress={onPress}
      style={style}
    >
      {thumb}
    </Pressable>
  ) : (
    <View accessibilityLabel={accessibilityLabel} style={style}>{thumb}</View>
  );
}

const createStyles = (colors: ColorPalette) => StyleSheet.create({
  safeArea: { backgroundColor: colors.background, flex: 1 },
  container: { flex: 1 },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  screenTitle: { color: colors.textPrimary, fontSize: 22, fontFamily: fonts.title, letterSpacing: -0.5, marginBottom: spacing.lg },
  centerState: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xxl },
  emptyState: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, gap: spacing.sm, padding: spacing.lg },
  emptyTitle: { color: colors.textPrimary, fontSize: typography.body, fontWeight: '600' },
  stateText: { color: colors.textSecondary, fontSize: typography.label, lineHeight: 18 },
  blockCard: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, flexDirection: 'row', gap: spacing.md, padding: spacing.md },
  blockCardActive: { backgroundColor: colors.accentSoft },
  blockCopy: { flex: 1, gap: 2 },
  blockTitle: { color: colors.textPrimary, fontSize: typography.body, fontWeight: '600' },
  blockDescription: { color: colors.textSecondary, fontSize: typography.label, lineHeight: 18 },
  sectionTitle: { color: colors.textSecondary, fontSize: 11, fontWeight: '600', letterSpacing: 0.8, marginBottom: spacing.md, marginTop: spacing.xl },
  requestList: { gap: spacing.md },
  requestCard: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, padding: spacing.md },
  requestHeader: { alignItems: 'center', flexDirection: 'row', gap: spacing.md },
  requestCopy: { flex: 1, gap: 2 },
  applicationName: { color: colors.textPrimary, fontSize: typography.body, fontWeight: '600' },
  requestDetails: { color: colors.textSecondary, fontSize: typography.label, lineHeight: 18 },
  ageBadge: { alignItems: 'center', borderColor: colors.textMuted, borderRadius: radius.pill, borderWidth: 1, minWidth: 48, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  ageText: { color: colors.textSecondary, fontSize: typography.label },
  actions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md },
  allowButton: { alignItems: 'center', borderColor: colors.accent, borderRadius: radius.sm, borderWidth: 1, flex: 1, justifyContent: 'center', minHeight: 44 },
  allowText: { color: colors.accentText, fontSize: typography.body },
  denyButton: { alignItems: 'center', borderColor: colors.border, borderRadius: radius.sm, borderWidth: 1, flex: 1, justifyContent: 'center', minHeight: 44 },
  denyText: { color: colors.textSecondary, fontSize: typography.body },
  switch: { backgroundColor: colors.surfaceRaised, borderColor: colors.textMuted, borderRadius: radius.pill, borderWidth: 2, height: 36, justifyContent: 'center', paddingHorizontal: 4, width: 64 },
  switchOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  switchThumb: { alignSelf: 'flex-start', backgroundColor: colors.textMuted, borderRadius: radius.pill, height: 26, width: 26 },
  switchThumbOn: { alignSelf: 'flex-end' },
  pressed: { opacity: 0.78 },
});

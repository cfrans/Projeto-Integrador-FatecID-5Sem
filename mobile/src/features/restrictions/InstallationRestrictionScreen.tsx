import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { devices, devicesErrorMessage, type PairedComputer } from '@/features/devices/services/devices';
import { useLanguage } from '@/features/i18n/LanguageProvider';
import {
  installationRequestsErrorMessage,
  listInstallationRequests,
  type InstallationRequest,
} from '@/features/restrictions/services/installation-requests';
import { colors, radius, spacing, typography } from '@/theme';

type LoadState = 'loading' | 'ready' | 'empty' | 'error';

type SwitchControlProps = {
  accessibilityLabel?: string;
  value: boolean;
  onPress?: () => void;
};

export function InstallationRestrictionScreen() {
  const [computer, setComputer] = useState<PairedComputer | null>(null);
  const [requests, setRequests] = useState<InstallationRequest[]>([]);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [blockInstallation, setBlockInstallation] = useState(true);
  const { t } = useLanguage();

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoadState('loading');
      setErrorMessage('');

      devices
        .listPairedComputers()
        .then(async (computers) => {
          const pairedComputer = computers.find((item) => item.isPaired) ?? null;
          if (!pairedComputer) {
            if (active) {
              setComputer(null);
              setRequests([]);
              setLoadState('empty');
            }
            return;
          }

          const installationRequests = await listInstallationRequests(pairedComputer.id);
          if (!active) return;
          setComputer(pairedComputer);
          setRequests(installationRequests);
          setLoadState('ready');
        })
        .catch((error: unknown) => {
          if (!active) return;
          setErrorMessage(
            error instanceof Error && error.message.includes('devices')
              ? devicesErrorMessage(error)
              : installationRequestsErrorMessage(error),
          );
          setLoadState('error');
        });

      return () => {
        active = false;
      };
    }, []),
  );

  const computerName = computer?.name ?? t('nav.install');

  function removeRequest(id: string) {
    setRequests((current) => current.filter((request) => request.id !== id));
  }

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <Pressable
              accessibilityLabel="Voltar"
              accessibilityRole="button"
              hitSlop={8}
              onPress={() => router.back()}
              style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
            >
              <Text style={styles.backIcon}>‹</Text>
            </Pressable>
            <View style={styles.headerCopy}>
              <Text numberOfLines={1} style={styles.computerName}>{computerName}</Text>
              <Text style={styles.screenSubtitle}>{t('nav.install')}</Text>
            </View>
            {computer ? (
              <View style={styles.syncBadge}>
                <View style={styles.syncDot} />
                <Text style={styles.syncText}>{t('restriction.sync')}</Text>
              </View>
            ) : null}
          </View>

          {loadState === 'loading' ? (
            <View style={styles.centerState}>
              <ActivityIndicator color={colors.accent} />
              <Text style={styles.stateText}>{t('restriction.loadingComputer')}</Text>
            </View>
          ) : null}

          {loadState === 'empty' ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>{t('restriction.noComputer')}</Text>
              <Text style={styles.stateText}>{t('restriction.pairToContinue')}</Text>
            </View>
          ) : null}

          {loadState === 'error' ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>{t('restriction.installUnavailable')}</Text>
              <Text style={styles.stateText}>{errorMessage}</Text>
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
                  accessibilityLabel="Bloquear instalação"
                  value={blockInstallation}
                  onPress={() => setBlockInstallation((current) => !current)}
                />
              </View>

              <Text style={styles.sectionTitle}>{t('restriction.pendingRequests')}</Text>

              {requests.length > 0 ? (
                <View style={styles.requestList}>
                  {requests.map((request) => (
                    <View key={request.id} style={styles.requestCard}>
                      <View style={styles.requestHeader}>
                        <View style={styles.applicationIcon}>
                          <Text style={styles.applicationIconText}>{request.applicationName.slice(0, 1).toUpperCase()}</Text>
                        </View>
                        <View style={styles.requestCopy}>
                          <Text style={styles.applicationName}>{request.applicationName}</Text>
                          <Text style={styles.requestDetails}>
                            {t('restriction.requestBy', { name: request.requesterName, time: request.requestedAt })}
                          </Text>
                        </View>
                        <View style={styles.ageBadge}>
                          <Text style={styles.ageText}>{request.ageRating}</Text>
                        </View>
                      </View>

                      <View style={styles.actions}>
                        <Pressable
                          accessibilityLabel={`Permitir instalação de ${request.applicationName}`}
                          accessibilityRole="button"
                          onPress={() => removeRequest(request.id)}
                          style={({ pressed }) => [styles.allowButton, pressed && styles.pressed]}
                        >
                          <Text style={styles.allowText}>{t('restriction.allow')}</Text>
                        </Pressable>
                        <Pressable
                          accessibilityLabel={`Recusar instalação de ${request.applicationName}`}
                          accessibilityRole="button"
                          onPress={() => removeRequest(request.id)}
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
  const style = [styles.switch, value && styles.switchOn];
  const thumb = <View style={[styles.switchThumb, value && styles.switchThumbOn]} />;

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

const styles = StyleSheet.create({
  safeArea: { backgroundColor: colors.background, flex: 1 },
  container: { flex: 1 },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  header: { alignItems: 'center', flexDirection: 'row', gap: spacing.md, marginBottom: spacing.lg },
  backButton: { alignItems: 'center', borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, height: 44, justifyContent: 'center', width: 44 },
  backIcon: { color: colors.textPrimary, fontSize: 30, fontWeight: '300', lineHeight: 34 },
  headerCopy: { flex: 1, gap: 2 },
  computerName: { color: colors.textPrimary, fontSize: 17, fontWeight: '700' },
  screenSubtitle: { color: colors.textSecondary, fontSize: typography.label },
  syncBadge: { alignItems: 'center', backgroundColor: colors.accentSoft, borderRadius: radius.pill, flexDirection: 'row', gap: 6, paddingHorizontal: spacing.sm + 2, paddingVertical: spacing.xs + 1 },
  syncDot: { backgroundColor: colors.accent, borderRadius: radius.pill, height: 6, width: 6 },
  syncText: { color: colors.accentText, fontSize: 11, fontWeight: '600' },
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
  applicationIcon: { alignItems: 'center', backgroundColor: colors.surfaceRaised, borderRadius: radius.sm, height: 42, justifyContent: 'center', width: 42 },
  applicationIconText: { color: colors.textSecondary, fontSize: typography.body, fontWeight: '600' },
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
  switchThumbOn: { alignSelf: 'flex-end', backgroundColor: '#FFE1DC' },
  pressed: { opacity: 0.78 },
});

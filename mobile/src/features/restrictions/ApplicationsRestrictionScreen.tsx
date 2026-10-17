import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { devices, devicesErrorMessage, type PairedComputer } from '@/features/devices/services/devices';
import { useLanguage } from '@/features/i18n/LanguageProvider';
import {
  applicationsErrorMessage,
  listInstalledApplications,
  type InstalledApplication,
} from '@/features/restrictions/services/applications';
import { colors, radius, spacing, typography } from '@/theme';

type LoadState = 'loading' | 'ready' | 'empty' | 'error';

type SwitchProps = {
  value: boolean;
  onPress?: () => void;
};

export function ApplicationsRestrictionScreen() {
  const [computer, setComputer] = useState<PairedComputer | null>(null);
  const [applications, setApplications] = useState<InstalledApplication[]>([]);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [query, setQuery] = useState('');
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
              setApplications([]);
              setLoadState('empty');
            }
            return;
          }

          const installedApplications = await listInstalledApplications(pairedComputer.id);
          if (!active) return;
          setComputer(pairedComputer);
          setApplications(installedApplications);
          setLoadState('ready');
        })
        .catch((error: unknown) => {
          if (!active) return;
          setErrorMessage(
            error instanceof Error && error.message.includes('devices')
              ? devicesErrorMessage(error)
              : applicationsErrorMessage(error),
          );
          setLoadState('error');
        });

      return () => {
        active = false;
      };
    }, []),
  );

  const visibleApplications = applications.filter((application) =>
    `${application.name} ${application.category}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
  );
  const allowedCount = applications.filter((application) => application.allowed).length;
  const computerName = computer?.name ?? t('nav.apps');

  function toggleApplication(id: string) {
    setApplications((current) => current.map((application) => (
      application.id === id ? { ...application, allowed: !application.allowed } : application
    )));
  }

  function restrictAll() {
    setApplications((current) => current.map((application) => ({ ...application, allowed: false })));
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
              <Text style={styles.screenSubtitle}>{t('nav.apps')}</Text>
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
              <Text style={styles.emptyTitle}>{t('restriction.appsUnavailable')}</Text>
              <Text style={styles.stateText}>{errorMessage}</Text>
            </View>
          ) : null}

          {loadState === 'ready' ? (
            <>
              <View style={styles.searchBox}>
                <Text style={styles.searchIcon}>⌕</Text>
                <TextInput
                  accessibilityLabel="Buscar aplicativo"
                  autoCapitalize="none"
                  onChangeText={setQuery}
                  placeholder={t('restriction.searchApp')}
                  placeholderTextColor={colors.textMuted}
                  style={styles.searchInput}
                  value={query}
                />
              </View>

              <View style={styles.summaryRow}>
                <Text style={styles.summaryText}>{t('restriction.allowedApps', { allowed: allowedCount, total: applications.length })}</Text>
                <Pressable accessibilityRole="button" onPress={restrictAll}>
                  <Text style={styles.restrictText}>{t('restriction.restrictAll')}</Text>
                </Pressable>
              </View>

              {visibleApplications.length > 0 ? (
                <View style={styles.applicationList}>
                  {visibleApplications.map((application) => (
                    <Pressable
                      key={application.id}
                      accessibilityLabel={`${application.name}, ${application.allowed ? 'liberado' : 'restrito'}`}
                      accessibilityRole="switch"
                      accessibilityState={{ checked: application.allowed }}
                      onPress={() => toggleApplication(application.id)}
                      style={({ pressed }) => [styles.applicationRow, pressed && styles.pressed]}
                    >
                      <View style={styles.applicationIcon}>
                        <Text style={styles.applicationIconText}>{application.name.slice(0, 1).toUpperCase()}</Text>
                      </View>
                      <View style={styles.applicationCopy}>
                        <Text style={styles.applicationName}>{application.name}</Text>
                        <Text style={styles.applicationCategory}>{application.category}</Text>
                      </View>
                      <SwitchControl value={application.allowed} />
                    </Pressable>
                  ))}
                </View>
              ) : (
                <Text style={styles.stateText}>{t('restriction.noAppMatch')}</Text>
              )}
            </>
          ) : null}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

function SwitchControl({ value, onPress }: SwitchProps) {
  const style = [styles.switch, value && styles.switchOn];
  const thumb = <View style={[styles.switchThumb, value && styles.switchThumbOn]} />;

  return onPress ? (
    <Pressable accessibilityRole="switch" accessibilityState={{ checked: value }} onPress={onPress} style={style}>
      {thumb}
    </Pressable>
  ) : (
    <View accessibilityRole="switch" accessibilityState={{ checked: value }} style={style}>
      {thumb}
    </View>
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
  searchBox: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, flexDirection: 'row', height: 52, paddingHorizontal: spacing.md },
  searchIcon: { color: colors.textSecondary, fontSize: 27, width: 34 },
  searchInput: { color: colors.textPrimary, flex: 1, fontSize: typography.body },
  summaryRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginVertical: spacing.md },
  summaryText: { color: colors.textSecondary, fontSize: typography.body },
  restrictText: { color: colors.accentText, fontSize: typography.body },
  applicationList: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, overflow: 'hidden' },
  applicationRow: { alignItems: 'center', borderBottomColor: colors.border, borderBottomWidth: 1, flexDirection: 'row', gap: spacing.md, minHeight: 72, paddingHorizontal: spacing.md },
  applicationIcon: { alignItems: 'center', backgroundColor: colors.surfaceRaised, borderRadius: radius.sm, height: 42, justifyContent: 'center', width: 42 },
  applicationIconText: { color: colors.textSecondary, fontSize: typography.body, fontWeight: '600' },
  applicationCopy: { flex: 1, gap: 2 },
  applicationName: { color: colors.textPrimary, fontSize: typography.body, fontWeight: '600' },
  applicationCategory: { color: colors.textSecondary, fontSize: typography.label },
  switch: { backgroundColor: colors.surfaceRaised, borderColor: colors.textMuted, borderRadius: radius.pill, borderWidth: 2, height: 36, justifyContent: 'center', paddingHorizontal: 4, width: 64 },
  switchOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  switchThumb: { alignSelf: 'flex-start', backgroundColor: colors.textMuted, borderRadius: radius.pill, height: 26, width: 26 },
  switchThumbOn: { alignSelf: 'flex-end', backgroundColor: '#FFE1DC' },
  pressed: { opacity: 0.78 },
});

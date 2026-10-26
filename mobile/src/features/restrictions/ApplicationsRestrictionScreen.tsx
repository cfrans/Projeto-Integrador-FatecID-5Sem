import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { PairedComputer } from '@/features/devices/services/devices';
import { useLanguage } from '@/features/i18n/LanguageProvider';
import {
  applicationsErrorMessage,
  listInstalledApplications,
  type InstalledApplication,
} from '@/features/restrictions/services/applications';
import { radius, spacing, typography, type ColorPalette } from '@/theme';
import { useTheme, useThemedStyles } from '@/features/theme/ThemeProvider';
import { useSimulation } from './SimulationProvider';
import { ApplicationIcon } from './ApplicationIcon';

type LoadState = 'loading' | 'ready' | 'error';

type SwitchProps = {
  value: boolean;
  onPress?: () => void;
};

export function ApplicationsRestrictionScreen({ computer }: { computer: PairedComputer }) {
  const [applications, setApplications] = useState<InstalledApplication[]>([]);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [query, setQuery] = useState('');
  const { t, localize } = useLanguage();
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { snapshot, save } = useSimulation();

  useFocusEffect(
    useCallback(() => {
      if (!snapshot.appliedAt) {
        setLoadState('loading');
        return;
      }
      let active = true;
      setLoadState('loading');
      setErrorMessage('');

      listInstalledApplications(computer.id)
        .then((installedApplications) => {
          if (!active) return;
          setApplications(installedApplications);
          setLoadState('ready');
        })
        .catch((error: unknown) => {
          if (!active) return;
          setErrorMessage(applicationsErrorMessage(error));
          setLoadState('error');
        });

      return () => {
        active = false;
      };
    }, [computer.id, snapshot.appliedAt]),
  );

  const configuredApplications = applications.map((application) => ({ ...application, allowed: snapshot.settings.applicationRules[application.id] ?? application.allowed }));
  const visibleApplications = configuredApplications.filter((application) =>
    `${application.name} ${application.category}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
  );
  const allowedCount = configuredApplications.filter((application) => application.allowed).length;

  function toggleApplication(id: string) {
    const application = configuredApplications.find((item) => item.id === id);
    if (application) void save({ applicationRules: { [id]: !application.allowed } });
  }

  function restrictAll() {
    if (applications.length) void save({ applicationRules: Object.fromEntries(applications.map((application) => [application.id, false])) });
  }

  return (
    <SafeAreaView edges={['left', 'right']} style={styles.safeArea}>
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text accessibilityRole="header" style={styles.screenTitle}>{t('nav.apps')}</Text>

          {loadState === 'loading' ? (
            <View style={styles.centerState}>
              <ActivityIndicator color={colors.accent} />
              <Text style={styles.stateText}>{t('restriction.loadingComputer')}</Text>
            </View>
          ) : null}

          {loadState === 'error' ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>{t('restriction.appsUnavailable')}</Text>
              <Text style={styles.stateText}>{localize(errorMessage)}</Text>
            </View>
          ) : null}

          {loadState === 'ready' ? (
            <>
              <View style={styles.searchBox}>
                <Text style={styles.searchIcon}>⌕</Text>
                <TextInput
                  accessibilityLabel={t('restriction.searchApp')}
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
                      accessibilityLabel={`${application.name}, ${t(application.allowed ? 'restriction.allowed' : 'restriction.restricted')}`}
                      accessibilityRole="switch"
                      accessibilityState={{ checked: application.allowed }}
                      onPress={() => toggleApplication(application.id)}
                      style={({ pressed }) => [styles.applicationRow, pressed && styles.pressed]}
                    >
                      <ApplicationIcon name={application.name} />
                      <View style={styles.applicationCopy}>
                        <Text style={styles.applicationName}>{application.name}</Text>
                        <Text style={styles.applicationCategory}>{application.category}</Text>
                      </View>
                      <SwitchControl value={application.allowed} />
                    </Pressable>
                  ))}
                </View>
              ) : (
                <Text style={styles.stateText}>{t(applications.length === 0 ? 'restriction.noApplications' : 'restriction.noAppMatch')}</Text>
              )}
            </>
          ) : null}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

function SwitchControl({ value, onPress }: SwitchProps) {
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
    <Pressable accessibilityRole="switch" accessibilityState={{ checked: value }} onPress={onPress} style={style}>
      {thumb}
    </Pressable>
  ) : (
    <View accessibilityRole="switch" accessibilityState={{ checked: value }} style={style}>
      {thumb}
    </View>
  );
}

const createStyles = (colors: ColorPalette) => StyleSheet.create({
  safeArea: { backgroundColor: colors.background, flex: 1 },
  container: { flex: 1 },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  screenTitle: { color: colors.textPrimary, fontSize: 22, fontWeight: '700', marginBottom: spacing.lg },
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
  applicationCopy: { flex: 1, gap: 2 },
  applicationName: { color: colors.textPrimary, fontSize: typography.body, fontWeight: '600' },
  applicationCategory: { color: colors.textSecondary, fontSize: typography.label },
  switch: { backgroundColor: colors.surfaceRaised, borderColor: colors.textMuted, borderRadius: radius.pill, borderWidth: 2, height: 36, justifyContent: 'center', paddingHorizontal: 4, width: 64 },
  switchOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  switchThumb: { alignSelf: 'flex-start', backgroundColor: colors.textMuted, borderRadius: radius.pill, height: 26, width: 26 },
  switchThumbOn: { alignSelf: 'flex-end' },
  pressed: { opacity: 0.78 },
});

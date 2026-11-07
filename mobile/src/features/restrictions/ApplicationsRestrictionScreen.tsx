import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Keyboard, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/Button';
import type { PairedComputer } from '@/features/devices/services/devices';
import { useLanguage } from '@/features/i18n/LanguageProvider';
import {
  applicationsErrorMessage,
  listInstalledApplications,
  type InstalledApplication,
} from '@/features/restrictions/services/applications';
import { fonts, radius, spacing, typography, type ColorPalette } from '@/theme';
import { useTheme, useThemedStyles } from '@/features/theme/ThemeProvider';
import { useSimulation } from './SimulationProvider';
import { ApplicationIcon } from './ApplicationIcon';
import { ApplicationCatalogCard } from '@/features/access/ApplicationCatalogCard';
import { findApplicationBrand } from './services/application-brand';
import { listInstallationHistory, type InstallationRequest } from './services/installation-requests';
import { findApprovedRequest } from './services/application-release';
import { ReleaseDeadline } from '@/features/access/ReleaseDeadline';

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
  const [expandedApp, setExpandedApp] = useState<string | null>(null);
  const [history, setHistory] = useState<InstallationRequest[]>([]);
  const [historyError, setHistoryError] = useState(false);
  const loadRequest = useRef(0);
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const { language, t, localize } = useLanguage();
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { snapshot, save, busy } = useSimulation();

  useFocusEffect(useCallback(() => {
    return () => { setConfirmationOpen(false); };
  }, []));

  const loadApplications = useCallback(async () => {
    const request = ++loadRequest.current;
    setLoadState('loading');
    setErrorMessage('');
    if (!snapshot.appliedAt) return;
    try {
      const [installedApplications, requestHistory] = await Promise.all([
        listInstalledApplications(computer.id),
        listInstallationHistory(computer.id).then((items) => ({ items, failed: false })).catch(() => ({ items: [], failed: true })),
      ]);
      if (request !== loadRequest.current) return;
      setApplications(installedApplications);
      setHistory(requestHistory.items);
      setHistoryError(requestHistory.failed);
      setLoadState('ready');
    } catch (error: unknown) {
      if (request !== loadRequest.current) return;
      setErrorMessage(applicationsErrorMessage(error));
      setLoadState('error');
    }
  }, [computer.id, snapshot.appliedAt]);

  useFocusEffect(useCallback(() => {
    void loadApplications();
    return () => { loadRequest.current += 1; };
  }, [loadApplications]));

  const configuredApplications = applications.map((application) => ({ ...application, approvedRequest: findApprovedRequest(history, application.name), allowed: snapshot.settings.applicationRules[application.id] ?? application.allowed }));
  const visibleApplications = configuredApplications.filter((application) =>
    `${application.name} ${application.category}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
  );
  const allowedCount = configuredApplications.filter((application) => application.allowed).length;

  function toggleApplication(id: string) {
    const application = configuredApplications.find((item) => item.id === id);
    if (application) void save({ applicationRules: { [id]: !application.allowed } });
  }

  function restrictAll() {
    if (!allowedCount || busy || confirmationOpen) return;
    Keyboard.dismiss();
    setConfirmationOpen(true);
  }

  function confirmRestrictAll() {
    if (!confirmationOpen || busy || !allowedCount) return;
    setConfirmationOpen(false);
    void save({ applicationRules: Object.fromEntries(applications.map((application) => [application.id, false])) });
  }

  return (
    <SafeAreaView edges={['left', 'right']} style={styles.safeArea}>
      <View style={styles.container} accessibilityElementsHidden={confirmationOpen} importantForAccessibility={confirmationOpen ? 'no-hide-descendants' : 'auto'}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
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
              <Text accessibilityRole="alert" style={styles.stateText}>{localize(errorMessage)}</Text>
              <Button label={t('common.retry')} onPress={() => void loadApplications()} />
            </View>
          ) : null}

          {loadState === 'ready' ? (
            <>
              {historyError ? <Text accessibilityRole="alert" style={styles.stateText}>{t('access.deadlineUnavailable')}</Text> : null}
              <View style={styles.searchBox}>
                <Text accessible={false} importantForAccessibility="no" style={styles.searchIcon}>⌕</Text>
                <TextInput
                  accessibilityLabel={t('restriction.searchApp')}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="search"
                  onChangeText={setQuery}
                  placeholder={t('restriction.searchApp')}
                  placeholderTextColor={colors.textSecondary}
                  style={styles.searchInput}
                  value={query}
                />
                {query.length > 0 ? <Pressable accessibilityRole="button" accessibilityLabel={t('restriction.clearSearch')} onPress={() => setQuery('')} style={styles.clearSearch}>
                  <Text style={styles.clearText}>×</Text>
                </Pressable> : null}
              </View>

              <View style={styles.summaryRow}>
                <Text style={styles.summaryText}>{t('restriction.allowedApps', { allowed: allowedCount, total: applications.length })}</Text>
                <Pressable accessibilityRole="button" accessibilityState={{ disabled: busy || allowedCount === 0 }} disabled={busy || allowedCount === 0} onPress={restrictAll} style={[styles.restrictButton, (busy || allowedCount === 0) && styles.disabled]}>
                  <Text style={styles.restrictText}>{t('restriction.restrictAll')}</Text>
                </Pressable>
              </View>

              {visibleApplications.length > 0 ? (
                <View style={styles.applicationList}>
                  {visibleApplications.map((application) => {
                    const brand = findApplicationBrand(application.name);
                    const expanded = expandedApp === application.id;
                    return (
                      <View key={application.id} style={styles.applicationItem}>
                        <Pressable
                          accessibilityLabel={`${application.name}, ${t(application.allowed ? 'restriction.allowed' : 'restriction.restricted')}`}
                          accessibilityRole="switch"
                          accessibilityState={{ checked: application.allowed, disabled: busy }}
                          disabled={busy}
                          onPress={() => toggleApplication(application.id)}
                          style={({ pressed }) => [styles.applicationRow, pressed && styles.pressed]}
                        >
                          <ApplicationIcon name={application.name} />
                          <View style={styles.applicationCopy}>
                            <Text style={styles.applicationName}>{application.name}</Text>
                            <Text style={styles.applicationCategory}>{application.category}</Text>
                            {application.approvedRequest ? <ReleaseDeadline computer={computer} requestId={application.approvedRequest.id} /> : null}
                          </View>
                          <SwitchControl value={application.allowed} />
                        </Pressable>
                        {brand ? (
                          <Pressable accessibilityRole="button" accessibilityState={{ expanded }}
                            onPress={() => setExpandedApp(expanded ? null : application.id)} style={styles.detailsButton}>
                            <Text style={styles.restrictText}>{t('access.aboutApplication', { name: application.name })}</Text>
                          </Pressable>
                        ) : null}
                        {brand && expanded ? <ApplicationCatalogCard key={`${brand}-${language}`} brand={brand} name={application.name} /> : null}
                      </View>
                    );
                  })}
                </View>
              ) : (
                <Text style={styles.stateText}>{t(applications.length === 0 ? 'restriction.noApplications' : 'restriction.noAppMatch')}</Text>
              )}
            </>
          ) : null}
        </ScrollView>
      </View>
      <Modal visible={confirmationOpen} transparent animationType="fade" onRequestClose={() => setConfirmationOpen(false)}>
        <SafeAreaView style={styles.modalOverlay}>
          <Pressable accessible={false} importantForAccessibility="no" style={styles.modalBackdrop} onPress={() => setConfirmationOpen(false)} />
          <View accessibilityViewIsModal style={styles.dialog}>
            <ScrollView contentContainerStyle={styles.dialogContent} bounces={false}>
              <View style={styles.dialogAccent} />
              <Text accessibilityRole="header" style={styles.dialogTitle}>{t('restriction.restrictAll')}</Text>
              <Text style={styles.dialogDescription}>{t('restriction.restrictAllDescription', { count: applications.length, name: computer.name })}</Text>
              <View style={styles.dialogActions}>
                <Button label={t('common.cancel')} onPress={() => setConfirmationOpen(false)} />
                <Button label={t('restriction.restrictAll')} disabled={busy || !allowedCount} onPress={confirmRestrictAll} style={styles.dialogConfirm} />
              </View>
            </ScrollView>
          </View>
        </SafeAreaView>
      </Modal>
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
    <View accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={style}>
      {thumb}
    </View>
  );
}

const createStyles = (colors: ColorPalette) => StyleSheet.create({
  modalOverlay: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, backgroundColor: 'rgba(0, 0, 0, 0.65)' },
  modalBackdrop: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 },
  dialog: { width: '100%', maxWidth: 420, maxHeight: '90%', backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: radius.lg, overflow: 'hidden' },
  dialogContent: { padding: spacing.xl, gap: spacing.lg },
  dialogAccent: { width: 36, height: 4, borderRadius: radius.pill, backgroundColor: colors.accent },
  dialogTitle: { color: colors.textPrimary, fontSize: 22, fontFamily: fonts.title, letterSpacing: -0.5 },
  dialogDescription: { color: colors.textSecondary, fontSize: typography.body, lineHeight: 22 },
  dialogActions: { gap: spacing.sm },
  dialogConfirm: { backgroundColor: colors.accentSoft },
  safeArea: { backgroundColor: colors.background, flex: 1 },
  container: { flex: 1 },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  screenTitle: { color: colors.textPrimary, fontSize: 22, fontFamily: fonts.title, letterSpacing: -0.5, marginBottom: spacing.lg },
  centerState: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xxl },
  emptyState: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, gap: spacing.sm, padding: spacing.lg },
  emptyTitle: { color: colors.textPrimary, fontSize: typography.body, fontWeight: '600' },
  stateText: { color: colors.textSecondary, fontSize: typography.label, lineHeight: 18 },
  searchBox: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, flexDirection: 'row', minHeight: 52, paddingHorizontal: spacing.md },
  searchIcon: { color: colors.textSecondary, fontSize: 27, width: 34 },
  searchInput: { color: colors.textPrimary, flex: 1, fontSize: typography.body, paddingVertical: spacing.md, minWidth: 0 },
  clearSearch: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  clearText: { color: colors.textSecondary, fontSize: 26 },
  restrictButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.sm },
  disabled: { opacity: 0.5 },
  summaryRow: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'space-between', marginVertical: spacing.md },
  summaryText: { color: colors.textSecondary, fontSize: typography.body },
  restrictText: { color: colors.accentText, fontSize: typography.body },
  applicationList: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, overflow: 'hidden' },
  applicationItem: { borderBottomColor: colors.border, borderBottomWidth: 1 },
  detailsButton: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.md },
  applicationRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.md, minHeight: 72, paddingHorizontal: spacing.md, paddingVertical: spacing.md },
  applicationCopy: { flex: 1, gap: 2 },
  applicationName: { color: colors.textPrimary, fontSize: typography.body, fontWeight: '600' },
  applicationCategory: { color: colors.textSecondary, fontSize: typography.label },
  switch: { backgroundColor: colors.surfaceRaised, borderColor: colors.textMuted, borderRadius: radius.pill, borderWidth: 2, height: 36, justifyContent: 'center', paddingHorizontal: 4, width: 64 },
  switchOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  switchThumb: { alignSelf: 'flex-start', backgroundColor: colors.textMuted, borderRadius: radius.pill, height: 26, width: 26 },
  switchThumbOn: { alignSelf: 'flex-end' },
  pressed: { opacity: 0.78 },
});

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/Button';
import { PenguinLogo } from '@/components/ui/PenguinLogo';
import { prefetchTeamAvatars } from '@/features/about/AboutScreen';
import { loadPendingRequestsReport, type PendingRequest } from '@/features/access/pendingRequests';
import { RequestCard, useRequestItems } from '@/features/access/RequestCards';
import { useSession } from '@/features/auth/SessionProvider';
import { useLanguage } from '@/features/i18n/LanguageProvider';
import { DeviceCard } from '@/features/devices/DeviceCard';
import { devices, devicesErrorMessage, type PairedComputer } from '@/features/devices/services/devices';
import { fonts, radius, spacing, typography, type ColorPalette } from '@/theme';
import { useTheme, useThemedStyles } from '@/features/theme/ThemeProvider';

type HomeState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'loaded'; computers: PairedComputer[] };

const HOME_REQUEST_LIMIT = 3;

export function HomeScreen() {
  const { busy, clearError, error, guardian, signOut } = useSession();
  const { t, localize } = useLanguage();
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [state, setState] = useState<HomeState>({ status: 'loading' });
  const [pending, setPending] = useState<PendingRequest[]>([]);
  const [requestsFailed, setRequestsFailed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [headerBottom, setHeaderBottom] = useState<number | null>(null);
  const insets = useSafeAreaInsets();
  const requestId = useRef(0);

  function openAboutFromMenu() {
    setMenuOpen(false);
    router.push('/about');
  }

  function openAddComputerFromMenu() {
    setMenuOpen(false);
    router.push('/qr-scan');
  }

  function openRequestsFromMenu() {
    setMenuOpen(false);
    router.push('/access-requests');
  }

  useEffect(() => {
    prefetchTeamAvatars();
  }, []);

  const loadComputers = useCallback((silent = false) => {
    const request = ++requestId.current;
    if (!silent) setState({ status: 'loading' });
    return devices.listPairedComputers()
      .then((computers) => {
        if (request !== requestId.current) return;
        setState({ status: 'loaded', computers });
        return loadPendingRequestsReport(computers).then((items) => {
          if (request === requestId.current) {
            setPending(items.pending);
            setRequestsFailed(items.failures.length > 0);
          }
        });
      })
      .catch((error: unknown) => {
        if (request === requestId.current) {
          setPending([]);
          setRequestsFailed(true);
          setState({ status: 'error', message: devicesErrorMessage(error) });
        }
      });
  }, []);

  useFocusEffect(useCallback(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async (silent = false) => {
      await loadComputers(silent);
      if (!cancelled) timer = setTimeout(() => void poll(true), 5000);
    };
    void poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
      requestId.current += 1;
    };
  }, [loadComputers]));

  function retry() {
    setState({ status: 'loading' });
    loadComputers();
  }

  const computers = state.status === 'loaded' ? state.computers : [];
  const requestItems = useRequestItems(pending);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.topBar} onLayout={({ nativeEvent }) => setHeaderBottom(nativeEvent.layout.y + nativeEvent.layout.height)}>
        <View style={styles.brand}>
          <PenguinLogo size={30} />
          <Text style={styles.brandName}>PIPLUP</Text>
        </View>
        <View style={styles.topActions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('nav.settings')}
            onPress={() => router.push('/settings')}
            style={({ pressed }) => [styles.menuButton, pressed && styles.pressed]}
          >
            <Image accessible={false} source={require('../../../assets/icons/settings.png')} style={styles.settingsIcon} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('menu.open')}
            accessibilityState={{ expanded: menuOpen }}
            onPress={() => setMenuOpen(true)}
            style={({ pressed }) => [styles.menuButton, pressed && styles.pressed]}
          >
            <View style={styles.menuBar} />
            <View style={styles.menuBar} />
            <View style={styles.menuBar} />
          </Pressable>
        </View>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.greeting}>
          <Text style={styles.eyebrow}>{t('home.eyebrow')}</Text>
          <Text style={styles.title}>{t('home.greeting', { name: guardian?.name ?? '' })}</Text>
          <Text style={styles.subtitle}>{t('home.subtitle')}</Text>
          {error ? (
            <Text accessibilityLiveRegion="polite" style={styles.logoutError}>{localize(error)}</Text>
          ) : null}
        </View>

        <View style={styles.requests}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionHeading}>
              <Text style={styles.sectionTitle}>{t('nav.requests')}</Text>
              {requestItems.length > 0 ? <Text style={styles.count}>{requestItems.length}</Text> : null}
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/access-requests')}
              style={({ pressed }) => [styles.linkButton, pressed && styles.pressed]}
            >
              <Text style={styles.link}>{t('common.viewAll')}</Text>
            </Pressable>
          </View>
          {requestsFailed ? <Text accessibilityRole="alert" style={styles.requestsEmpty}>{t('access.partialError')}</Text> : null}
          {state.status === 'loaded' && !requestsFailed && requestItems.length === 0 ? <Text style={styles.requestsEmpty}>{t('access.empty')}</Text> : null}
          {requestItems.slice(0, HOME_REQUEST_LIMIT).map((item) => <RequestCard key={`${item.kind}-${item.id}`} item={item} />)}
        </View>

        <View style={styles.pairingCard}>
          <View style={styles.pairingCopy}>
            <Text style={styles.pairingTitle}>{t('common.addComputer')}</Text>
            <Text style={styles.pairingDescription}>{t('home.addDescription')}</Text>
          </View>
          <Button
            label={t('common.addComputer')}
            onPress={() => router.push('/qr-scan')}
          />
        </View>

        <View style={styles.sectionHeader}>
          <View style={styles.sectionHeading}>
            <Text style={styles.sectionTitle}>{t('common.computers')}</Text>
            {state.status === 'loaded' ? (
              <Text style={styles.count}>{computers.length}</Text>
            ) : null}
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/computers')}
            style={({ pressed }) => [styles.linkButton, pressed && styles.pressed]}
          >
            <Text style={styles.link}>{t('common.viewAll')}</Text>
          </Pressable>
        </View>

        {state.status === 'loading' ? (
          <View style={styles.stateContainer}>
            <ActivityIndicator color={colors.accent} />
            <Text style={styles.stateText}>{t('common.loadingComputers')}</Text>
          </View>
        ) : null}

        {state.status === 'error' ? (
          <View style={styles.stateContainer}>
            <Text style={styles.stateTitle}>{t('common.loadError')}</Text>
            <Text style={styles.stateText}>{localize(state.message)}</Text>
            <Button label={t('common.retry')} onPress={retry} />
          </View>
        ) : null}

        {state.status === 'loaded' && computers.length === 0 ? (
          <View style={styles.stateContainer}>
            <Text style={styles.stateTitle}>{t('home.noneTitle')}</Text>
            <Text style={styles.stateText}>{t('home.noneDescription')}</Text>
          </View>
        ) : null}

        {state.status === 'loaded' && computers.length > 0 ? (
          <View style={styles.deviceList}>
            {computers.map((computer) => (
              <DeviceCard computer={computer} key={computer.id} />
            ))}
          </View>
        ) : null}

        <View style={styles.shortcutsSection}>
          <Text style={styles.shortcutsHeader}>{t('home.shortcuts')}</Text>

          <View style={styles.shortcutsGrid}>
            <View style={styles.shortcutsRow}>
              <Pressable
                accessibilityLabel={`${t('home.browsers')}, ${t('home.manageBrowsers')}`}
                accessibilityRole="button"
                onPress={() => router.push('/restrictions/browsers')}
                style={({ pressed }) => [styles.shortcutCard, pressed && styles.pressed]}
              >
                <View style={styles.shortcutIconBox}>
                  <View style={styles.globeCircle}>
                    <View style={styles.globeLineHorizontal} />
                    <View style={styles.globeLineVertical} />
                  </View>
                </View>
                <View style={styles.shortcutCopy}>
                  <Text style={styles.shortcutTitle}>{t('home.browsers')}</Text>
                  <Text style={styles.shortcutSubtitle}>{t('home.manageBrowsers')}</Text>
                </View>
              </Pressable>

              <Pressable
                accessibilityLabel={`${t('home.apps')}, ${t('home.installed')}`}
                accessibilityRole="button"
                onPress={() => router.push('/restrictions/apps')}
                style={({ pressed }) => [styles.shortcutCard, pressed && styles.pressed]}
              >
                <View style={styles.shortcutIconBox}>
                  <View style={styles.appGridIcon}>
                    <View style={styles.appGridDot} />
                    <View style={styles.appGridDot} />
                    <View style={styles.appGridDot} />
                    <View style={styles.appGridDot} />
                  </View>
                </View>
                <View style={styles.shortcutCopy}>
                  <Text style={styles.shortcutTitle}>{t('home.apps')}</Text>
                  <Text style={styles.shortcutSubtitle}>{t('home.installed')}</Text>
                </View>
              </Pressable>
            </View>

            <View style={styles.shortcutsRow}>
              <Pressable
                accessibilityLabel={`${t('home.installation')}, ${t('home.manageInstall')}`}
                accessibilityRole="button"
                onPress={() => router.push('/restrictions/install')}
                style={({ pressed }) => [styles.shortcutCard, pressed && styles.pressed]}
              >
                <View style={styles.shortcutIconBox}>
                  <View style={styles.installIcon}>
                    <Text style={styles.shortcutSymbolText}>↓</Text>
                    <View style={styles.installTray} />
                  </View>
                </View>
                <View style={styles.shortcutCopy}>
                  <Text style={styles.shortcutTitle}>{t('home.installation')}</Text>
                  <Text style={styles.shortcutSubtitle}>{t('home.manageInstall')}</Text>
                </View>
              </Pressable>

              <Pressable
                accessibilityLabel={`${t('home.age')}, ${t('home.manageAge')}`}
                accessibilityRole="button"
                onPress={() => router.push('/restrictions/age')}
                style={({ pressed }) => [styles.shortcutCard, pressed && styles.pressed]}
              >
                <View style={styles.shortcutIconBox}>
                  <Text style={styles.ageBadgeIconText}>L–18</Text>
                </View>
                <View style={styles.shortcutCopy}>
                  <Text style={styles.shortcutTitle}>{t('home.age')}</Text>
                  <Text style={styles.shortcutSubtitle}>{t('home.manageAge')}</Text>
                </View>
              </Pressable>
            </View>
          </View>
        </View>

      </ScrollView>

      <Modal visible={menuOpen} transparent statusBarTranslucent navigationBarTranslucent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <Pressable accessibilityLabel={t('menu.close')} onPress={() => setMenuOpen(false)} style={styles.menuBackdrop} />
        <View accessibilityViewIsModal style={[styles.menu, { top: Math.max(insets.top, (headerBottom ?? insets.top + 60) - spacing.sm) }]}>
          <Pressable accessibilityRole="menuitem" onPress={openAddComputerFromMenu} style={({ pressed }) => [styles.menuItem, pressed && styles.pressed]}>
            <Text style={styles.menuItemText}>{t('common.addComputer')}</Text>
          </Pressable>
          <Pressable accessibilityRole="menuitem" onPress={openRequestsFromMenu} style={({ pressed }) => [styles.menuItem, pressed && styles.pressed]}>
            <Text style={styles.menuItemText}>{t('nav.requests')}</Text>
          </Pressable>
          <View style={styles.menuDivider} />
          <Pressable accessibilityRole="menuitem" onPress={openAboutFromMenu} style={({ pressed }) => [styles.menuItem, pressed && styles.pressed]}>
            <Text style={styles.menuItemText}>{t('nav.about')}</Text>
          </Pressable>
          <View style={styles.menuDivider} />
          <Pressable
            accessibilityRole="menuitem"
            accessibilityState={{ disabled: busy, busy }}
            disabled={busy}
            onPress={() => {
              setMenuOpen(false);
              clearError();
              void signOut();
            }}
            style={({ pressed }) => [styles.menuItem, pressed && styles.pressed, busy && styles.signOutDisabled]}
          >
            <Image accessible={false} source={require('../../../assets/icons/log-out.png')} style={styles.signOutIcon} />
            <Text style={styles.menuItemText}>{t(busy ? 'common.signingOut' : 'common.signOut')}</Text>
          </Pressable>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const createStyles = (colors: ColorPalette) => StyleSheet.create({
  safeArea: { backgroundColor: colors.background, flex: 1 },
  content: { gap: spacing.xl, padding: spacing.lg, paddingBottom: spacing.xxl },
  greeting: { gap: spacing.sm, paddingTop: spacing.sm },
  topBar: { alignItems: 'center', borderBottomColor: colors.border, borderBottomWidth: 1, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  brand: { alignItems: 'center', flexDirection: 'row', gap: spacing.md },
  brandName: { color: colors.textPrimary, fontSize: 16, fontFamily: fonts.title, letterSpacing: 3 },
  topActions: { alignItems: 'center', flexDirection: 'row' },
  menuButton: { width: 44, height: 44, gap: 4, alignItems: 'center', justifyContent: 'center' },
  menuBar: { width: 18, height: 2, borderRadius: 1, backgroundColor: colors.textPrimary },
  requests: { gap: spacing.md },
  requestsEmpty: { color: colors.textSecondary, fontSize: typography.label },
  menuBackdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(0, 0, 0, 0.35)' },
  menu: { position: 'absolute', right: spacing.lg, minWidth: 220, paddingVertical: spacing.xs, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface },
  menuItem: { minHeight: 48, flexDirection: 'row', gap: spacing.sm, alignItems: 'center', paddingHorizontal: spacing.md },
  menuItemText: { color: colors.textPrimary, fontSize: typography.body, fontWeight: '500' },
  menuDivider: { height: 1, marginVertical: spacing.xs, backgroundColor: colors.border },
  settingsIcon: { width: 24, height: 24, tintColor: colors.textPrimary },
  signOutIcon: { width: 16, height: 16, tintColor: colors.textPrimary },
  signOutDisabled: { opacity: 0.5 },
  eyebrow: {
    color: colors.accentText,
    fontSize: typography.label,
    fontWeight: '700',
    letterSpacing: 1.6,
  },
  title: { color: colors.textPrimary, fontSize: 34, lineHeight: 40, fontFamily: fonts.title, letterSpacing: -0.8 },
  subtitle: { color: colors.textSecondary, fontSize: 13, lineHeight: 19 },
  logoutError: { color: colors.accentText, fontSize: typography.label, lineHeight: 18 },
  pairingCard: {
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.lg,
    padding: spacing.lg,
  },
  pairingCopy: { gap: spacing.xs },
  pairingTitle: { color: colors.textPrimary, fontSize: typography.body, fontWeight: '600' },
  pairingDescription: { color: colors.textSecondary, fontSize: typography.label, lineHeight: 18 },
  sectionHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  sectionHeading: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  sectionTitle: { color: colors.textPrimary, fontSize: 18, fontWeight: '600' },
  count: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.pill,
    color: colors.textSecondary,
    fontSize: typography.label,
    minWidth: 24,
    overflow: 'hidden',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    textAlign: 'center',
  },
  linkButton: { justifyContent: 'center', minHeight: 44, paddingHorizontal: spacing.sm },
  pressed: { opacity: 0.65 },
  link: { color: colors.accentText, fontSize: typography.label, fontWeight: '600' },
  deviceList: { gap: spacing.sm },
  stateContainer: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.xl,
  },
  stateTitle: { color: colors.textPrimary, fontSize: typography.body, fontWeight: '600' },
  stateText: { color: colors.textSecondary, fontSize: typography.label, textAlign: 'center' },
  shortcutsSection: {
    gap: spacing.sm,
  },
  shortcutsHeader: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.8,
  },
  shortcutsGrid: {
    gap: spacing.sm,
  },
  shortcutsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  shortcutCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flex: 1,
    gap: spacing.md,
    justifyContent: 'space-between',
    minHeight: 104,
    padding: spacing.md,
  },
  shortcutIconBox: {
    alignItems: 'center',
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  globeCircle: {
    alignItems: 'center',
    borderColor: colors.textSecondary,
    borderRadius: radius.pill,
    borderWidth: 1.3,
    height: 15,
    justifyContent: 'center',
    width: 15,
  },
  globeLineHorizontal: {
    backgroundColor: colors.textSecondary,
    height: 1.2,
    position: 'absolute',
    width: 13,
  },
  globeLineVertical: {
    backgroundColor: colors.textSecondary,
    height: 13,
    position: 'absolute',
    width: 1.2,
  },
  appGridIcon: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 2.5,
    height: 13,
    width: 13,
  },
  appGridDot: {
    borderColor: colors.textSecondary,
    borderRadius: 1.5,
    borderWidth: 1.2,
    height: 5,
    width: 5,
  },
  installIcon: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  shortcutSymbolText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 13,
  },
  installTray: {
    backgroundColor: colors.textSecondary,
    borderRadius: 1,
    height: 1.5,
    marginTop: 1,
    width: 11,
  },
  ageBadgeIconText: {
    color: colors.textSecondary,
    fontSize: 10,
    fontWeight: '700',
  },
  shortcutCopy: {
    gap: 2,
  },
  shortcutTitle: {
    color: colors.textPrimary,
    fontSize: typography.body,
    fontWeight: '600',
  },
  shortcutSubtitle: {
    color: colors.textSecondary,
    fontSize: typography.label,
  },
});

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/Button';
import { prefetchTeamAvatars } from '@/features/about/AboutScreen';
import { useSession } from '@/features/auth/SessionProvider';
import { useLanguage } from '@/features/i18n/LanguageProvider';
import { DeviceCard } from '@/features/devices/DeviceCard';
import { devices, devicesErrorMessage, type PairedComputer } from '@/features/devices/services/devices';
import { radius, spacing, typography, type ColorPalette } from '@/theme';
import { useTheme, useThemedStyles } from '@/features/theme/ThemeProvider';

type HomeState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'loaded'; computers: PairedComputer[] };

export function HomeScreen() {
  const { busy, clearError, error, guardian, signOut } = useSession();
  const { t, localize } = useLanguage();
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [state, setState] = useState<HomeState>({ status: 'loading' });
  const requestId = useRef(0);

  useEffect(() => {
    prefetchTeamAvatars();
  }, []);

  const loadComputers = useCallback(() => {
    const request = ++requestId.current;
    setState({ status: 'loading' });
    devices.listPairedComputers()
      .then((computers) => {
        if (request === requestId.current) setState({ status: 'loaded', computers });
      })
      .catch((error: unknown) => {
        if (request === requestId.current) setState({ status: 'error', message: devicesErrorMessage(error) });
      });
  }, []);

  useFocusEffect(useCallback(() => {
    loadComputers();
    return () => {
      requestId.current += 1;
    };
  }, [loadComputers]));

  function retry() {
    setState({ status: 'loading' });
    loadComputers();
  }

  const computers = state.status === 'loaded' ? state.computers : [];

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.greeting}>
          <Text style={styles.eyebrow}>{t('home.eyebrow')}</Text>
          <Text style={styles.title}>{t('home.greeting', { name: guardian?.name ?? '' })}</Text>
          <Text style={styles.subtitle}>{t('home.subtitle')}</Text>
          {error ? (
            <Text accessibilityLiveRegion="polite" style={styles.logoutError}>{localize(error)}</Text>
          ) : null}
          <Button
            label={busy ? t('common.signingOut') : t('common.signOut')}
            disabled={busy}
            onPress={() => {
              clearError();
              void signOut();
            }}
          />
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
                accessibilityLabel={`${t('home.browsers')}, ${t('home.blocked')}`}
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
                  <Text style={styles.shortcutSubtitle}>{t('home.blocked')}</Text>
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
                accessibilityLabel={`${t('home.installation')}, ${t('home.blocked')}`}
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
                  <Text style={styles.shortcutSubtitle}>{t('home.blocked')}</Text>
                </View>
              </Pressable>

              <Pressable
                accessibilityLabel={`${t('home.age')}, ${t('home.upTo12')}`}
                accessibilityRole="button"
                onPress={() => router.push('/restrictions/age')}
                style={({ pressed }) => [styles.shortcutCard, pressed && styles.pressed]}
              >
                <View style={styles.shortcutIconBox}>
                  <Text style={styles.ageBadgeIconText}>12+</Text>
                </View>
                <View style={styles.shortcutCopy}>
                  <Text style={styles.shortcutTitle}>{t('home.age')}</Text>
                  <Text style={styles.shortcutSubtitle}>{t('home.upTo12')}</Text>
                </View>
              </Pressable>
            </View>
          </View>
        </View>

        <Button
          label={t('nav.about')}
          onPress={() => router.push('/about')}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: ColorPalette) => StyleSheet.create({
  safeArea: { backgroundColor: colors.background, flex: 1 },
  content: { gap: spacing.xl, padding: spacing.lg, paddingBottom: spacing.xxl },
  greeting: { gap: spacing.sm, paddingTop: spacing.sm },
  eyebrow: {
    color: colors.accentText,
    fontSize: typography.label,
    fontWeight: '600',
    letterSpacing: 1.2,
  },
  title: { color: colors.textPrimary, fontSize: typography.title, fontWeight: '700' },
  subtitle: { color: colors.textSecondary, fontSize: typography.body, lineHeight: 21 },
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

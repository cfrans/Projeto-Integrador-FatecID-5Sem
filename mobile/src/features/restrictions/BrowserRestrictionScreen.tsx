import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { PairedComputer } from '@/features/devices/services/devices';
import { useLanguage } from '@/features/i18n/LanguageProvider';
import { radius, spacing, typography, type ColorPalette } from '@/theme';
import { useTheme, useThemedStyles } from '@/features/theme/ThemeProvider';

type BrowserId = 'firefox' | 'chromium' | 'brave' | 'gnome-web';
type BrowserOption = { id: BrowserId; name: string; icon: string };
type SyncStatus = 'synced' | 'syncing';

const BROWSERS: readonly BrowserOption[] = [
  { id: 'firefox', name: 'Firefox', icon: '◈' },
  { id: 'chromium', name: 'Chromium', icon: '◎' },
  { id: 'brave', name: 'Brave', icon: '▽' },
  { id: 'gnome-web', name: 'GNOME Web', icon: '⌂' },
];

export function BrowserRestrictionScreen({ computer }: { computer: PairedComputer }) {
  const [blockBrowsers, setBlockBrowsers] = useState(true);
  const [allowedBrowsers, setAllowedBrowsers] = useState<Record<BrowserId, boolean>>({
    firefox: true,
    chromium: false,
    brave: false,
    'gnome-web': true,
  });
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('synced');
  const { t } = useLanguage();
  const styles = useThemedStyles(createStyles);

  function updateSetting(update: () => void) {
    update();
    setSyncStatus('syncing');
    setTimeout(() => setSyncStatus('synced'), 900);
  }

  function toggleBrowser(id: BrowserId) {
    updateSetting(() => {
      setAllowedBrowsers((current) => ({ ...current, [id]: !current[id] }));
    });
  }

  const computerName = computer?.name ?? t('nav.browsers');
  const managedUser = computer?.managedUser ? t('restriction.account', { name: computer.managedUser }) : t('nav.browsers');

  return (
    <SafeAreaView edges={['left', 'right']} style={styles.safeArea}>
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>

            <View style={styles.headerCopy}>
              <Text numberOfLines={1} style={styles.computerName}>{computerName}</Text>
              <Text style={styles.screenSubtitle}>{managedUser}</Text>
            </View>

            <View accessibilityLiveRegion="polite" style={styles.syncBadge}>
              <View style={styles.syncDot} />
              <Text style={styles.syncText}>{syncStatus === 'syncing' ? t('restriction.syncing') : t('restriction.sync')}</Text>
            </View>
          </View>

          <View style={[styles.blockCard, blockBrowsers && styles.blockCardActive]}>
            <View style={styles.blockCopy}>
              <Text style={styles.blockTitle}>{t('restriction.blockBrowsers')}</Text>
              <Text style={styles.blockDescription}>{t('restriction.blockBrowsersDescription')}</Text>
            </View>
            <SwitchControl
              accessibilityLabel={t('restriction.blockBrowsers')}
              value={blockBrowsers}
              onPress={() => updateSetting(() => setBlockBrowsers((current) => !current))}
            />
          </View>

          <Text style={styles.sectionTitle}>{t('restriction.allowedExceptions')}</Text>

          <View style={styles.browserList}>
            {BROWSERS.map((browser) => (
              <Pressable
                key={browser.id}
                accessibilityLabel={`${browser.id === 'gnome-web' ? t('restriction.schoolBrowser') : browser.name}, ${t(allowedBrowsers[browser.id] ? 'restriction.allowed' : 'restriction.blocked')}`}
                accessibilityRole="switch"
                accessibilityState={{ checked: allowedBrowsers[browser.id] }}
                onPress={() => toggleBrowser(browser.id)}
                style={({ pressed }) => [styles.browserRow, pressed && styles.pressed]}
              >
                <Text style={styles.browserIcon}>{browser.icon}</Text>
                <Text style={styles.browserName}>{browser.id === 'gnome-web' ? t('restriction.schoolBrowser') : browser.name}</Text>
                <SwitchControl value={allowedBrowsers[browser.id]} />
              </Pressable>
            ))}
          </View>

          <Text style={styles.footerText}>
            {t('restriction.browserFooter')}
          </Text>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

type SwitchControlProps = {
  accessibilityLabel?: string;
  value: boolean;
  onPress?: () => void;
};

function SwitchControl({ accessibilityLabel, value, onPress }: SwitchControlProps) {
  const { colors, scheme } = useTheme();
  const styles = useThemedStyles(createStyles);
  const switchStyle = [styles.switch, value && styles.switchOn];
  const thumbColor = scheme === 'dark' ? colors.textPrimary : colors.backgroundGlow;
  const switchThumb = (
    <View
      style={[
        styles.switchThumb,
        value && styles.switchThumbOn,
        value && { backgroundColor: thumbColor },
      ]}
    />
  );

  if (!onPress) {
    return <View accessibilityLabel={accessibilityLabel} style={switchStyle}>{switchThumb}</View>;
  }

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      hitSlop={4}
      onPress={onPress}
      style={switchStyle}
    >
      {switchThumb}
    </Pressable>
  );
}

const createStyles = (colors: ColorPalette) => StyleSheet.create({
  safeArea: { backgroundColor: colors.background, flex: 1 },
  container: { flex: 1 },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  headerCopy: { flex: 1, gap: 2 },
  computerName: { color: colors.textPrimary, fontSize: 17, fontWeight: '700' },
  screenSubtitle: { color: colors.textSecondary, fontSize: typography.label },
  syncBadge: {
    alignItems: 'center',
    backgroundColor: colors.accentSoft,
    borderRadius: radius.pill,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs + 1,
  },
  syncDot: { backgroundColor: colors.accent, borderRadius: radius.pill, height: 6, width: 6 },
  syncText: { color: colors.accentText, fontSize: 11, fontWeight: '600' },
  blockCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
  },
  blockCardActive: { backgroundColor: colors.accentSoft, borderColor: colors.border },
  blockCopy: { flex: 1, gap: 2 },
  blockTitle: { color: colors.textPrimary, fontSize: typography.body, fontWeight: '600' },
  blockDescription: { color: colors.textSecondary, fontSize: typography.label, lineHeight: 18 },
  sectionTitle: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.8,
    marginBottom: spacing.md,
    marginTop: spacing.xl,
  },
  browserList: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    overflow: 'hidden',
  },
  browserRow: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 64,
    paddingHorizontal: spacing.md,
  },
  browserIcon: { color: colors.textSecondary, fontSize: 22, textAlign: 'center', width: 24 },
  browserName: { color: colors.textPrimary, flex: 1, fontSize: typography.body, fontWeight: '600' },
  switch: {
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.textMuted,
    borderRadius: radius.pill,
    borderWidth: 2,
    height: 36,
    justifyContent: 'center',
    paddingHorizontal: 4,
    width: 64,
  },
  switchOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  switchThumb: {
    alignSelf: 'flex-start',
    backgroundColor: colors.textMuted,
    borderRadius: radius.pill,
    height: 26,
    width: 26,
  },
  switchThumbOn: { alignSelf: 'flex-end' },
  footerText: { color: colors.textSecondary, fontSize: typography.label, lineHeight: 18, marginTop: spacing.md },
  pressed: { opacity: 0.78 },
});

import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLanguage } from '@/features/i18n/LanguageProvider';
import { radius, spacing, typography, type ColorPalette } from '@/theme';
import { useTheme, useThemedStyles } from '@/features/theme/ThemeProvider';
import { useSimulation } from './SimulationProvider';
import { ApplicationIcon } from './ApplicationIcon';

type BrowserId = 'firefox' | 'chromium' | 'brave' | 'gnome-web';
type BrowserOption = { id: BrowserId; name: string };
const BROWSERS: readonly BrowserOption[] = [
  { id: 'firefox', name: 'Firefox' },
  { id: 'chromium', name: 'Chromium' },
  { id: 'brave', name: 'Brave' },
  { id: 'gnome-web', name: 'GNOME Web' },
];

export function BrowserRestrictionScreen() {
  const { snapshot, save } = useSimulation();
  const { blockBrowsers, allowedBrowsers } = snapshot.settings;
  const { t } = useLanguage();
  const styles = useThemedStyles(createStyles);

  function toggleBrowser(id: BrowserId) {
    void save({ allowedBrowsers: { [id]: !allowedBrowsers[id] } });
  }

  return (
    <SafeAreaView edges={['left', 'right']} style={styles.safeArea}>
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text accessibilityRole="header" style={styles.screenTitle}>{t('nav.browsers')}</Text>

          <View style={[styles.blockCard, blockBrowsers && styles.blockCardActive]}>
            <View style={styles.blockCopy}>
              <Text style={styles.blockTitle}>{t('restriction.blockBrowsers')}</Text>
              <Text style={styles.blockDescription}>{t('restriction.blockBrowsersDescription')}</Text>
            </View>
            <SwitchControl
              accessibilityLabel={t('restriction.blockBrowsers')}
              value={blockBrowsers}
              onPress={() => void save({ blockBrowsers: !blockBrowsers })}
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
                <ApplicationIcon name={browser.name} />
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
  screenTitle: { color: colors.textPrimary, fontSize: 22, fontWeight: '700', marginBottom: spacing.lg },
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

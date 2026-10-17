import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { devices, devicesErrorMessage, type PairedComputer } from '@/features/devices/services/devices';
import { colors, radius, spacing, typography } from '@/theme';

type BrowserId = 'firefox' | 'chromium' | 'brave' | 'gnome-web';
type BrowserOption = { id: BrowserId; name: string; icon: string };
type SyncStatus = 'synced' | 'syncing';

const BROWSERS: readonly BrowserOption[] = [
  { id: 'firefox', name: 'Firefox', icon: '◈' },
  { id: 'chromium', name: 'Chromium', icon: '◎' },
  { id: 'brave', name: 'Brave', icon: '▽' },
  { id: 'gnome-web', name: 'GNOME Web (escola)', icon: '⌂' },
];

export function BrowserRestrictionScreen() {
  const [computer, setComputer] = useState<PairedComputer | null>(null);
  const [loadingComputer, setLoadingComputer] = useState(true);
  const [computerError, setComputerError] = useState('');
  const [blockBrowsers, setBlockBrowsers] = useState(true);
  const [allowedBrowsers, setAllowedBrowsers] = useState<Record<BrowserId, boolean>>({
    firefox: true,
    chromium: false,
    brave: false,
    'gnome-web': true,
  });
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('synced');

  useEffect(() => {
    let active = true;

    devices
      .listPairedComputers()
      .then((computers) => {
        if (!active) return;
        setComputer(computers[0] ?? null);
      })
      .catch((error: unknown) => {
        if (!active) return;
        setComputerError(devicesErrorMessage(error));
      })
      .finally(() => {
        if (active) setLoadingComputer(false);
      });

    return () => {
      active = false;
    };
  }, []);

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

  const computerName = computer?.name ?? 'Notebook da Ana';
  const managedUser = computer?.managedUser ? `conta ${computer.managedUser}` : 'Navegadores';

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
              <Text style={styles.screenSubtitle}>{managedUser}</Text>
            </View>

            <View accessibilityLiveRegion="polite" style={styles.syncBadge}>
              <View style={styles.syncDot} />
              <Text style={styles.syncText}>{syncStatus === 'syncing' ? 'Sincronizando' : 'Sincronizado'}</Text>
            </View>
          </View>

          {loadingComputer ? (
            <View style={styles.statusRow}>
              <ActivityIndicator color={colors.accent} size="small" />
              <Text style={styles.statusText}>Carregando computador…</Text>
            </View>
          ) : null}
          {computerError ? <Text style={styles.errorText}>{computerError}</Text> : null}

          <View style={[styles.blockCard, blockBrowsers && styles.blockCardActive]}>
            <View style={styles.blockCopy}>
              <Text style={styles.blockTitle}>Bloquear navegadores</Text>
              <Text style={styles.blockDescription}>
                Impede a abertura de qualquer navegador na conta da criança.
              </Text>
            </View>
            <SwitchControl
              accessibilityLabel="Bloquear navegadores"
              value={blockBrowsers}
              onPress={() => updateSetting(() => setBlockBrowsers((current) => !current))}
            />
          </View>

          <Text style={styles.sectionTitle}>EXCEÇÕES PERMITIDAS</Text>

          <View style={styles.browserList}>
            {BROWSERS.map((browser) => (
              <Pressable
                key={browser.id}
                accessibilityLabel={`${browser.name}, ${allowedBrowsers[browser.id] ? 'permitido' : 'bloqueado'}`}
                accessibilityRole="switch"
                accessibilityState={{ checked: allowedBrowsers[browser.id] }}
                onPress={() => toggleBrowser(browser.id)}
                style={({ pressed }) => [styles.browserRow, pressed && styles.pressed]}
              >
                <Text style={styles.browserIcon}>{browser.icon}</Text>
                <Text style={styles.browserName}>{browser.name}</Text>
                <SwitchControl value={allowedBrowsers[browser.id]} />
              </Pressable>
            ))}
          </View>

          <Text style={styles.footerText}>
            Com o bloqueio geral ativo, apenas os navegadores marcados continuam disponíveis.
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
  const switchStyle = [styles.switch, value && styles.switchOn];
  const switchThumb = <View style={[styles.switchThumb, value && styles.switchThumbOn]} />;

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

const styles = StyleSheet.create({
  safeArea: { backgroundColor: colors.background, flex: 1 },
  container: { flex: 1 },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  backButton: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  backIcon: { color: colors.textPrimary, fontSize: 30, fontWeight: '300', lineHeight: 34 },
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
  statusRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  statusText: { color: colors.textSecondary, fontSize: typography.label },
  errorText: { color: colors.accentText, fontSize: typography.label, marginBottom: spacing.md },
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
  switchThumbOn: { alignSelf: 'flex-end', backgroundColor: '#FFE1DC' },
  footerText: { color: colors.textSecondary, fontSize: typography.label, lineHeight: 18, marginTop: spacing.md },
  pressed: { opacity: 0.78 },
});

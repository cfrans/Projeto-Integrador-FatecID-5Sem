import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/Button';
import { useLanguage } from '@/features/i18n/LanguageProvider';
import { useTheme, useThemedStyles } from '@/features/theme/ThemeProvider';
import { radius, spacing, type ColorPalette } from '@/theme';
import { ComputerIcon } from './ComputerIcon';
import { useComputerAppearance } from './ComputerAppearanceProvider';
import { COMPUTER_ICONS } from './services/computer-icons';

export function ComputerIconPicker({ visible, deviceId, name, onClose }: { visible: boolean; deviceId: string; name: string; onClose: () => void }) {
  const { icons, ready, busy, error, reload, setIcon } = useComputerAppearance();
  const { t } = useLanguage();
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modal}>
        <Pressable style={styles.backdrop} accessibilityLabel={t('common.close')} onPress={onClose} />
        <View accessibilityViewIsModal style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
          <View style={styles.heading}>
            <View style={styles.copy}><Text accessibilityRole="header" style={styles.title}>{t('device.iconTitle')}</Text><Text numberOfLines={1} style={styles.subtitle}>{name}</Text></View>
            <Pressable accessibilityRole="button" accessibilityLabel={t('common.close')} onPress={onClose} style={styles.close}><Text style={styles.closeText}>×</Text></Pressable>
          </View>
          <View style={styles.grid}>
            {COMPUTER_ICONS.map((icon) => {
              const selected = (icons[deviceId] ?? 'desktop') === icon;
              return (
                <Pressable key={icon} disabled={!ready || busy} accessibilityRole="radio" accessibilityState={{ checked: selected, selected, disabled: !ready || busy }} accessibilityLabel={t(`device.icon.${icon}`)} onPress={() => { void setIcon(deviceId, icon).then((saved) => { if (saved) onClose(); }); }} style={[styles.option, selected && styles.selected, (!ready || busy) && styles.disabled]}>
                  <ComputerIcon icon={icon} size={48} selected={selected} />
                  <Text style={styles.optionName}>{t(`device.icon.${icon}`)}</Text>
                  {selected ? <Text style={styles.check}>✓</Text> : null}
                </Pressable>
              );
            })}
          </View>
          {(!ready && !error) || busy ? <ActivityIndicator color={colors.accent} /> : null}
          {error ? <Text accessibilityRole="alert" style={styles.error}>{t(error === 'load' ? 'device.iconLoadError' : 'device.iconSaveError')}</Text> : null}
          {error === 'load' ? <Button label={t('common.retry')} onPress={reload} /> : null}
          <Text style={styles.note}>{t('device.iconLocalNote')}</Text>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (colors: ColorPalette) => StyleSheet.create({
  modal: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0, 0, 0, 0.55)' },
  backdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.lg, gap: spacing.md },
  heading: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  copy: { flex: 1, gap: spacing.xs },
  title: { color: colors.textPrimary, fontSize: 20, fontWeight: '700' },
  subtitle: { color: colors.textSecondary, fontSize: 13 },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  closeText: { fontSize: 28, color: colors.textSecondary },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  option: { width: '48%', flexGrow: 1, minHeight: 112, padding: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  selected: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  optionName: { color: colors.textPrimary, fontSize: 13, fontWeight: '600' },
  check: { position: 'absolute', top: 8, right: 10, color: colors.accentText, fontSize: 16 },
  disabled: { opacity: 0.5 },
  note: { color: colors.textSecondary, fontSize: 12, lineHeight: 18 },
  error: { color: colors.danger, fontSize: 13 },
});

import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { PairedComputer } from '@/features/devices/services/devices';
import { ComputerIcon } from '@/features/devices/ComputerIcon';
import { useLanguage } from '@/features/i18n/LanguageProvider';
import { useThemedStyles } from '@/features/theme/ThemeProvider';
import { radius, spacing, type ColorPalette } from '@/theme';

type Props = {
  computers: PairedComputer[];
  computer: PairedComputer | null;
  onSelect: (id: string) => void;
};

export function RestrictionComputerSelector({ computers, computer, onSelect }: Props) {
  const [open, setOpen] = useState(false);
  const { t } = useLanguage();
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const canChoose = computers.length > 1 || !computer;

  return (
    <>
      <Pressable
        accessibilityRole={canChoose ? 'button' : undefined}
        accessibilityLabel={t('restriction.selectedComputer') + (computer ? `: ${computer.name}` : '')}
        accessibilityHint={canChoose ? t('restriction.changeComputer') : undefined}
        accessibilityState={{ expanded: open, disabled: !canChoose }}
        disabled={!canChoose}
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.selector, pressed && styles.pressed]}
      >
        <ComputerIcon deviceId={computer?.id} size={38} />
        <View style={styles.copy}>
          <Text style={styles.label}>{t('restriction.selectedComputer')}</Text>
          <Text numberOfLines={1} style={styles.name}>{computer?.name ?? t('restriction.chooseComputer')}</Text>
          {computer?.managedUser ? <Text numberOfLines={1} style={styles.account}>{t('restriction.account', { name: computer.managedUser })}</Text> : null}
        </View>
        {canChoose ? <View style={styles.change}><Text style={styles.changeText}>{t('restriction.change')}</Text><View style={styles.chevron} /></View> : null}
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={styles.modal}>
          <Pressable style={styles.backdrop} accessibilityLabel={t('common.close')} onPress={() => setOpen(false)} />
          <View accessibilityViewIsModal style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
            <View style={styles.sheetHeader}>
              <Text accessibilityRole="header" style={styles.sheetTitle}>{t('restriction.changeComputer')}</Text>
              <Pressable accessibilityRole="button" accessibilityLabel={t('common.close')} onPress={() => setOpen(false)} style={styles.close}>
                <Text style={styles.closeText}>×</Text>
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={styles.options}>
              {computers.map((item) => {
                const selected = item.id === computer?.id;
                return (
                  <Pressable
                    key={item.id}
                    accessibilityRole="radio"
                    accessibilityState={{ selected, checked: selected }}
                    accessibilityLabel={item.name}
                    onPress={() => { onSelect(item.id); setOpen(false); }}
                    style={[styles.option, selected && styles.optionSelected]}
                  >
                    <ComputerIcon deviceId={item.id} size={36} selected={selected} />
                    <View style={styles.copy}>
                      <Text style={styles.optionName}>{item.name}</Text>
                      {item.managedUser ? <Text style={styles.account}>{t('restriction.account', { name: item.managedUser })}</Text> : null}
                    </View>
                    {selected ? <Text style={styles.check}>✓</Text> : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

const createStyles = (colors: ColorPalette) => StyleSheet.create({
  selector: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginHorizontal: spacing.lg, marginTop: spacing.md, marginBottom: spacing.sm, padding: spacing.md, minHeight: 72, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface },
  copy: { flex: 1, gap: 2 },
  label: { fontSize: 11, color: colors.textSecondary },
  name: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  account: { fontSize: 12, color: colors.textSecondary },
  change: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 44 },
  changeText: { fontSize: 12, color: colors.accentText, fontWeight: '600' },
  chevron: { width: 7, height: 7, borderRightWidth: 1.5, borderBottomWidth: 1.5, borderColor: colors.accentText, transform: [{ rotate: '45deg' }], marginTop: -3 },
  pressed: { opacity: 0.78 },
  modal: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0, 0, 0, 0.55)' },
  backdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  sheet: { maxHeight: '75%', backgroundColor: colors.surface, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md, marginBottom: spacing.md },
  sheetTitle: { fontSize: 18, fontWeight: '700', color: colors.textPrimary, flex: 1 },
  close: { minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center' },
  closeText: { fontSize: 28, color: colors.textSecondary },
  options: { gap: spacing.sm, paddingBottom: spacing.sm },
  option: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 64, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md },
  optionSelected: { backgroundColor: colors.accentSoft, borderColor: colors.accent },
  optionName: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  check: { fontSize: 20, color: colors.accentText },
});

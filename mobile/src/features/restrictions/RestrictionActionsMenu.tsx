import { useCallback, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLanguage } from '@/features/i18n/LanguageProvider';
import { useThemedStyles } from '@/features/theme/ThemeProvider';
import { radius, spacing, type ColorPalette } from '@/theme';

export function RestrictionActionsMenu({ deviceId, name }: { deviceId: string; name: string }) {
  const anchor = useRef<View>(null);
  const request = useRef(0);
  const [position, setPosition] = useState<{ top: number; right: number; width: number; height: number } | null>(null);
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const styles = useThemedStyles(createStyles);
  const menuWidth = Math.min(288, width - insets.left - insets.right - spacing.lg * 2);
  const visible = position !== null && position.width === width && position.height === height;

  useFocusEffect(useCallback(() => () => { request.current += 1; setPosition(null); }, []));

  function open() {
    const operation = ++request.current;
    anchor.current?.measureInWindow((x, y, anchorWidth, anchorHeight) => {
      if (operation !== request.current) return;
      setPosition({
        top: Math.max(insets.top, Math.min(y + anchorHeight + spacing.xs, height - insets.bottom - 120)),
        right: Math.max(insets.right + spacing.md, Math.min(width - x - anchorWidth, width - menuWidth - insets.left - spacing.md)),
        width,
        height,
      });
    });
  }

  function navigate(pathname: '/sync-failure' | '/restriction-profiles') {
    setPosition(null);
    router.push({ pathname, params: { deviceId } });
  }

  return <>
    <View ref={anchor} collapsable={false}>
      <Pressable accessibilityRole="button" accessibilityLabel={t('restriction.actions', { name })} accessibilityState={{ expanded: visible }} onPress={open} style={({ pressed }) => [styles.trigger, pressed && styles.pressed]}>
        <View accessible={false} style={styles.dots}><View style={styles.dot} /><View style={styles.dot} /><View style={styles.dot} /></View>
      </Pressable>
    </View>
    <Modal visible={visible} transparent statusBarTranslucent navigationBarTranslucent animationType="fade" onRequestClose={() => setPosition(null)}>
      <View style={styles.overlay}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('common.close')} onPress={() => setPosition(null)} style={StyleSheet.absoluteFill} />
        <View accessibilityViewIsModal accessibilityRole="menu" style={[styles.menu, { top: position?.top ?? 0, right: position?.right ?? 0, width: menuWidth, maxHeight: Math.max(48, height - (position?.top ?? 0) - insets.bottom - spacing.md) }]}>
          <ScrollView>
            <Pressable accessibilityRole="menuitem" onPress={() => navigate('/sync-failure')} style={({ pressed }) => [styles.item, pressed && styles.pressed]}>
              <Text accessible={false} style={styles.syncIcon}>⟳</Text>
              <Text style={styles.text}>{t('sync.title')}</Text>
            </Pressable>
            <Pressable accessibilityRole="menuitem" onPress={() => navigate('/restriction-profiles')} style={({ pressed }) => [styles.item, pressed && styles.pressed]}>
              <View accessible={false} style={styles.profileIcon}>
                {[4, 12, 7].map((left, index) => <View key={index} style={styles.slider}><View style={[styles.knob, { left }]} /></View>)}
              </View>
              <Text style={styles.text}>{t('profiles.title')}</Text>
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  </>;
}

const createStyles = (colors: ColorPalette) => StyleSheet.create({
  trigger: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm },
  dots: { gap: 3 },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.textSecondary },
  pressed: { backgroundColor: colors.surfaceRaised },
  overlay: { flex: 1 },
  menu: { position: 'absolute', backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingVertical: spacing.xs, elevation: 8, shadowColor: '#000', shadowOpacity: 0.14, shadowOffset: { width: 0, height: 3 }, shadowRadius: 10 },
  item: { minHeight: 48, paddingVertical: spacing.sm, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  text: { color: colors.accentText, fontSize: 14, fontWeight: '600', flexShrink: 1 },
  syncIcon: { width: 28, fontSize: 30, lineHeight: 34, textAlign: 'center', color: colors.accentText },
  profileIcon: { width: 28, height: 28, justifyContent: 'center', gap: 6, paddingHorizontal: 3 },
  slider: { height: 2, backgroundColor: colors.accentText },
  knob: { position: 'absolute', top: -2, width: 5, height: 6, borderRadius: 2, borderWidth: 1.5, borderColor: colors.accentText, backgroundColor: colors.surface },
});

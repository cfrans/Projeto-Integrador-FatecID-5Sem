import { Image, StyleSheet, View } from 'react-native';
import { useTheme } from '@/features/theme/ThemeProvider';
import { radius } from '@/theme';
import { useComputerAppearance } from './ComputerAppearanceProvider';
import type { ComputerIconId } from './services/computer-icons';
import { computerImages as sources } from '@/lib/image-assets';

export function ComputerIcon({ deviceId, icon, size = 42, selected = false }: { deviceId?: string; icon?: ComputerIconId; size?: number; selected?: boolean }) {
  const { icons } = useComputerAppearance();
  const { colors } = useTheme();
  const chosen = icon ?? (deviceId ? icons[deviceId] : undefined) ?? 'desktop';
  return (
    <View accessible={false} style={[styles.container, { width: size, height: size, backgroundColor: selected ? colors.accentSoft : colors.surfaceRaised }]}>
      <Image source={sources[chosen]} accessible={false} fadeDuration={0} resizeMode="contain" style={{ width: size * 0.6, height: size * 0.6, tintColor: selected ? colors.accentText : colors.textSecondary }} />
    </View>
  );
}

const styles = StyleSheet.create({ container: { alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm } });

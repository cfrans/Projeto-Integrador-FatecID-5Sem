import { Image, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/features/theme/ThemeProvider';
import { radius } from '@/theme';
import { findApplicationBrand } from './services/application-brand';
import { applicationImages as logos } from '@/lib/image-assets';

export function ApplicationIcon({ name, size = 42 }: { name: string; size?: number }) {
  const brand = findApplicationBrand(name);
  const { colors } = useTheme();
  return (
    <View accessible={false} style={[styles.container, { width: size, height: size, backgroundColor: colors.surfaceRaised }]}>
      {brand ? <Image accessible={false} source={logos[brand]} fadeDuration={0} resizeMode="contain" style={{ width: size * 0.76, height: size * 0.76 }} /> : <Text style={{ color: colors.textSecondary, fontSize: size * 0.38, fontWeight: '600' }}>{Array.from(name.trim())[0]?.toUpperCase() ?? '?'}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({ container: { alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm } });

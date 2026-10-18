import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { spacing, type ColorPalette } from '../theme';
import { useThemedStyles } from '@/features/theme/ThemeProvider';

type Props = { title: string; children?: ReactNode };

export function Screen({ title, children }: Props) {
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      {children}
    </View>
  );
}

const createStyles = (colors: ColorPalette) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.lg },
  title: { color: colors.textPrimary, fontSize: 20, fontWeight: '600' },
});

import { StyleSheet, View, type ViewProps } from 'react-native';
import { radius, spacing, type ColorPalette } from '@/theme';
import { useThemedStyles } from '@/features/theme/ThemeProvider';

type CardProps = ViewProps;

export function Card({ style, ...props }: CardProps) {
  const styles = useThemedStyles(createStyles);
  return <View style={[styles.card, style]} {...props} />;
}

const createStyles = (colors: ColorPalette) => StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.lg,
  },
});

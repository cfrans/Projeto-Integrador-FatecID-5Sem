import { ActivityIndicator, Pressable, StyleSheet, Text, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import { radius, spacing, typography, type ColorPalette } from '@/theme';
import { useTheme, useThemedStyles } from '@/features/theme/ThemeProvider';

type ButtonProps = Omit<PressableProps, 'children'> & {
  label: string;
  loading?: boolean;
  variant?: 'outline' | 'solid';
  palette?: ColorPalette;
  style?: StyleProp<ViewStyle>;
};

export function Button({ label, loading = false, palette, style, variant = 'outline', disabled = false, accessibilityState, ...props }: ButtonProps) {
  const isDisabled = loading || disabled || Boolean(accessibilityState?.disabled);
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const activePalette = palette ?? colors;
  const paletteStyle = palette
    ? {
        backgroundColor: variant === 'solid' ? palette.accent : 'transparent',
        borderColor: palette.accent,
      }
    : undefined;
  const paletteLabelStyle = palette
    ? { color: variant === 'solid' ? palette.textPrimary : palette.accentText }
    : undefined;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ ...accessibilityState, disabled: isDisabled, busy: loading || accessibilityState?.busy }}
      disabled={isDisabled}
      style={({ pressed }) => [styles.button, variant === 'solid' && styles.solid, paletteStyle, pressed && styles.pressed, style, isDisabled && !loading && styles.disabled]}
      {...props}
    >
      {loading ? <ActivityIndicator accessible={false} importantForAccessibility="no" size="small" color={variant === 'solid' ? activePalette.textPrimary : activePalette.accentText} /> : null}
      <Text style={[styles.label, variant === 'solid' && styles.solidLabel, paletteLabelStyle]}>{label}</Text>
    </Pressable>
  );
}

const createStyles = (colors: ColorPalette) => StyleSheet.create({
  button: {
    minHeight: 48,
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: radius.md,
    backgroundColor: 'transparent',
  },
  solid: { backgroundColor: colors.accent },
  pressed: { opacity: 0.72 },
  disabled: { opacity: 0.5 },
  label: { color: colors.accentText, fontSize: typography.button, fontWeight: '500', textAlign: 'center', flexShrink: 1 },
  solidLabel: { color: colors.textPrimary },
});

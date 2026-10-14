import { Pressable, StyleSheet, Text, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import { colors, radius, spacing, typography } from '@/theme';

type ButtonProps = Omit<PressableProps, 'children'> & {
  label: string;
  variant?: 'outline' | 'solid';
  style?: StyleProp<ViewStyle>;
};

export function Button({ label, style, variant = 'outline', disabled = false, accessibilityState, ...props }: ButtonProps) {
  const isDisabled = disabled || Boolean(accessibilityState?.disabled);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ ...accessibilityState, disabled: isDisabled }}
      disabled={isDisabled}
      style={({ pressed }) => [styles.button, variant === 'solid' && styles.solid, pressed && styles.pressed, style, isDisabled && styles.disabled]}
      {...props}
    >
      <Text style={[styles.label, variant === 'solid' && styles.solidLabel]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 48,
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
  label: { color: colors.accentText, fontSize: typography.button, fontWeight: '500' },
  solidLabel: { color: colors.textPrimary },
});

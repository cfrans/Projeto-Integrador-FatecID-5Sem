import { forwardRef } from 'react';
import {
  StyleSheet,
  TextInput,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
} from 'react-native';
import { colors, radius, spacing, typography } from '@/theme';

type InputProps = TextInputProps & {
  invalid?: boolean;
  style?: StyleProp<TextStyle>;
};

export const Input = forwardRef<TextInput, InputProps>(function Input(
  { invalid = false, style, ...props },
  ref,
) {
  return (
    <TextInput
      ref={ref}
      underlineColorAndroid="transparent"
      style={[styles.input, invalid && styles.invalid, style]}
      {...props}
    />
  );
});

const styles = StyleSheet.create({
  input: {
    minHeight: 52,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    color: colors.textPrimary,
    fontSize: typography.input,
  },
  invalid: { borderColor: colors.accent },
});

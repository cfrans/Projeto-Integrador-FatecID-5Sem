import { forwardRef } from 'react';
import {
  StyleSheet,
  TextInput,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
} from 'react-native';
import { radius, spacing, typography, type ColorPalette } from '@/theme';
import { useTheme, useThemedStyles } from '@/features/theme/ThemeProvider';

type InputProps = TextInputProps & {
  invalid?: boolean;
  style?: StyleProp<TextStyle>;
};

export const Input = forwardRef<TextInput, InputProps>(function Input(
  { invalid = false, selectionColor, style, ...props },
  ref,
) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  return (
    <TextInput
      ref={ref}
      selectionColor={selectionColor ?? colors.accent}
      underlineColorAndroid="transparent"
      style={[styles.input, invalid && styles.invalid, style]}
      {...props}
    />
  );
});

const createStyles = (colors: ColorPalette) => StyleSheet.create({
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

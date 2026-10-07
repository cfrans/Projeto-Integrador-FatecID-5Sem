import { DarkTheme, type Theme } from 'expo-router/react-navigation';
import { colors } from './colors';

export * from './colors';
export * from './spacing';
export * from './typography';

export const navigationTheme: Theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: colors.accent,
    background: colors.background,
    card: colors.background,
    text: colors.textPrimary,
    border: colors.border,
    notification: colors.accent,
  },
};

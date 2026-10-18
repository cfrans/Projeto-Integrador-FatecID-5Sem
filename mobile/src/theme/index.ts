import { DarkTheme, DefaultTheme, type Theme } from 'expo-router/react-navigation';
import { darkColors, lightColors, type ColorPalette } from './colors';

export * from './colors';
export * from './spacing';
export * from './typography';

export type ThemeScheme = 'light' | 'dark';

export function createNavigationTheme(scheme: ThemeScheme, palette: ColorPalette): Theme {
  const baseTheme = scheme === 'dark' ? DarkTheme : DefaultTheme;

  return {
    ...baseTheme,
    colors: {
      ...baseTheme.colors,
      primary: palette.accent,
      background: palette.background,
      card: palette.background,
      text: palette.textPrimary,
      border: palette.border,
      notification: palette.accent,
    },
  };
}

export const darkNavigationTheme = createNavigationTheme('dark', darkColors);
export const lightNavigationTheme = createNavigationTheme('light', lightColors);

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as SystemUI from 'expo-system-ui';
import { ThemeProvider as NavigationThemeProvider } from 'expo-router/react-navigation';
import { darkColors, darkNavigationTheme, lightColors, lightNavigationTheme, type ColorPalette, type ThemeScheme } from '@/theme';

import { resolveTheme, type ThemePreference } from './preferences';

export type { ThemePreference } from './preferences';

type ThemeContextValue = {
  colors: ColorPalette;
  scheme: ThemeScheme;
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
};

const THEME_STORAGE_KEY = 'piplup.theme-preference';
const ThemeContext = createContext<ThemeContextValue | null>(null);

async function savePreference(preference: ThemePreference) {
  try {
    await SecureStore.setItemAsync(THEME_STORAGE_KEY, preference);
  } catch {
    return;
  }
}

export function AppThemeProvider({ children }: { children: ReactNode }) {
  const systemColorScheme = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>('system');
  const preferenceWasChanged = useRef(false);

  useEffect(() => {
    let isMounted = true;

    async function loadPreference() {
      try {
        const storedPreference = await SecureStore.getItemAsync(THEME_STORAGE_KEY);

        if (!isMounted || preferenceWasChanged.current) return;
        if (storedPreference === 'system' || storedPreference === 'light' || storedPreference === 'dark') {
          setPreferenceState(storedPreference);
        }
      } catch {
        return;
      }
    }

    void loadPreference();

    return () => {
      isMounted = false;
    };
  }, []);

  const setPreference = useCallback((nextPreference: ThemePreference) => {
    preferenceWasChanged.current = true;
    setPreferenceState(nextPreference);
    void savePreference(nextPreference);
  }, []);

  const scheme: ThemeScheme = resolveTheme(preference, systemColorScheme);
  const colors = scheme === 'dark' ? darkColors : lightColors;
  const navigationTheme = scheme === 'dark' ? darkNavigationTheme : lightNavigationTheme;
  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(colors.background).catch(() => {
      console.warn('Não foi possível atualizar o fundo nativo do app.');
    });
  }, [colors.background]);
  const value = useMemo(
    () => ({ colors, scheme, preference, setPreference }),
    [colors, scheme, preference, setPreference],
  );

  return (
    <ThemeContext.Provider value={value}>
      <NavigationThemeProvider value={navigationTheme}>{children}</NavigationThemeProvider>
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used inside AppThemeProvider');
  return context;
}

export function useThemedStyles<Styles>(factory: (colors: ColorPalette) => Styles) {
  const { colors } = useTheme();
  return useMemo(() => factory(colors), [factory, colors]);
}

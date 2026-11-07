import '@/lib/api-runtime';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';
import { useFonts } from 'expo-font';
import { Inter_800ExtraBold } from '@expo-google-fonts/inter/800ExtraBold';
import { Stack } from 'expo-router/js-stack';
import { StatusBar } from 'expo-status-bar';
import { SessionProvider, useSession } from '@/features/auth/SessionProvider';
import { LanguageProvider, useLanguage } from '@/features/i18n/LanguageProvider';
import { AppThemeProvider, useTheme, useThemedStyles } from '@/features/theme/ThemeProvider';
import { type ColorPalette } from '@/theme';
import { ComputerAppearanceProvider } from '@/features/devices/ComputerAppearanceProvider';
import { RequestBanner } from '@/features/access/RequestBanner';
import { preloadImages } from '@/lib/preload-images';

export default function RootLayout() {
  return (
    <AppThemeProvider>
      <SessionProvider>
        <LanguageProvider>
          <ComputerAppearanceProvider>
            <RootNavigator />
          </ComputerAppearanceProvider>
        </LanguageProvider>
      </SessionProvider>
    </AppThemeProvider>
  );
}

function RootNavigator() {
  const { status } = useSession();
  const { t } = useLanguage();
  const { colors, scheme } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [fontsLoaded, fontError] = useFonts({ Inter_800ExtraBold });
  const [imagesReady, setImagesReady] = useState(false);
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const style = document.createElement('style');
    style.textContent = 'html, body { height: 100% !important; }';
    document.head.appendChild(style);
    return () => { style.remove(); };
  }, []);
  useEffect(() => {
    let active = true;
    const timeout = setTimeout(() => { if (active) setImagesReady(true); }, 8000);
    void preloadImages().catch(() => undefined).finally(() => {
      clearTimeout(timeout);
      if (active) setImagesReady(true);
    });
    return () => { active = false; clearTimeout(timeout); };
  }, [status]);

  return (
    <View style={styles.root}>
      {status === 'initializing' || (!fontsLoaded && !fontError) || !imagesReady ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : (
        <Stack
          screenOptions={{
            animation: 'slide_from_right',
            headerStyle: { backgroundColor: colors.background },
            headerTintColor: colors.textPrimary,
            headerTitleStyle: { color: colors.textPrimary },
            cardStyle: { backgroundColor: colors.background, ...(Platform.OS === 'web' && { height: '100%' }) },
          }}
        >
          <Stack.Protected guard={status !== 'authenticated'}>
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="register" options={{ headerShown: false }} />
            <Stack.Screen name="forgot-password" options={{ headerShown: false }} />
          </Stack.Protected>

          <Stack.Protected guard={status === 'authenticated'}>
            <Stack.Screen name="home" options={{ headerShown: false }} />
            <Stack.Screen name="computers" options={{ title: t('nav.computers') }} />
            <Stack.Screen name="qr-scan" options={{ title: t('nav.pairComputer') }} />
            <Stack.Screen name="pairing-done" options={{ headerShown: false }} />
            <Stack.Screen name="restrictions" options={{ title: t('nav.restrictions') }} />
            <Stack.Screen name="access-requests" options={{ title: t('nav.requests') }} />
            <Stack.Screen name="access-request" options={{ title: t('nav.accessRequest') }} />
            <Stack.Screen name="sync-failure" options={{ title: t('sync.title') }} />
            <Stack.Screen name="restriction-profiles" options={{ title: t('profiles.title') }} />
            <Stack.Screen name="settings" options={{ title: t('nav.settings') }} />
            <Stack.Screen name="about"options={{ title: t('nav.about') }} />
          </Stack.Protected>
        </Stack>
      )}
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <RequestBanner />
    </View>
  );
}

const createStyles = (colors: ColorPalette) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  loading: { alignItems: 'center', backgroundColor: colors.background, flex: 1, justifyContent: 'center' },
});

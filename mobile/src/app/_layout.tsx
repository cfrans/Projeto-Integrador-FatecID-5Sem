import '@/lib/api-runtime';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useFonts } from 'expo-font';
import { Inter_800ExtraBold } from '@expo-google-fonts/inter/800ExtraBold';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SessionProvider, useSession } from '@/features/auth/SessionProvider';
import { LanguageProvider, useLanguage } from '@/features/i18n/LanguageProvider';
import { AppThemeProvider, useTheme, useThemedStyles } from '@/features/theme/ThemeProvider';
import { type ColorPalette } from '@/theme';
import { ComputerAppearanceProvider } from '@/features/devices/ComputerAppearanceProvider';
import { RequestBanner } from '@/features/access/RequestBanner';

export default function RootLayout() {
  return (
    <AppThemeProvider>
      <SessionProvider>
        <LanguageProvider>
          <ComputerAppearanceProvider>
            <View style={{ flex: 1 }}>
              <RootNavigator />
              <RequestBanner />
            </View>
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

  return (
    <>
      {status === 'initializing' || (!fontsLoaded && !fontError) ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : (
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: colors.background },
            headerTintColor: colors.textPrimary,
            headerTitleStyle: { color: colors.textPrimary },
            contentStyle: { backgroundColor: colors.background },
          }}
        >
          <Stack.Protected guard={status !== 'authenticated'}>
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="register" options={{ headerShown: false }} />
          </Stack.Protected>

          <Stack.Protected guard={status === 'authenticated'}>
            <Stack.Screen name="home" options={{ headerShown: false }} />
            <Stack.Screen name="computers" options={{ title: t('nav.computers') }} />
            <Stack.Screen name="qr-scan" options={{ title: t('nav.pairComputer') }} />
            <Stack.Screen name="pairing-done" options={{ headerShown: false }} />
            <Stack.Screen name="restrictions" options={{ title: t('nav.restrictions') }} />
            <Stack.Screen name="access-requests" options={{ title: t('nav.requests') }} />
            <Stack.Screen name="access-request" options={{ title: t('nav.accessRequest') }} />
            <Stack.Screen name="sync-failure" options={{ title: t('nav.sync') }} />
            <Stack.Screen name="settings" options={{ title: t('nav.settings') }} />
            <Stack.Screen name="about"options={{ title: t('nav.about') }} />
          </Stack.Protected>
        </Stack>
      )}
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
    </>
  );
}

const createStyles = (colors: ColorPalette) => StyleSheet.create({
  loading: { alignItems: 'center', backgroundColor: colors.background, flex: 1, justifyContent: 'center' },
});

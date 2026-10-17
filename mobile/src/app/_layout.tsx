import '@/lib/api-runtime';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { ThemeProvider } from 'expo-router/react-navigation';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SessionProvider, useSession } from '@/features/auth/SessionProvider';
import { LanguageProvider, useLanguage } from '@/features/i18n/LanguageProvider';
import { colors, navigationTheme } from '@/theme';

export default function RootLayout() {
  return (
    <ThemeProvider value={navigationTheme}>
      <SessionProvider>
        <LanguageProvider>
          <RootNavigator />
        </LanguageProvider>
      </SessionProvider>
    </ThemeProvider>
  );
}

function RootNavigator() {
  const { status } = useSession();
  const { t } = useLanguage();

  return (
    <>
      {status === 'initializing' ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : (
        <Stack>
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
            <Stack.Screen name="access-request" options={{ title: t('nav.accessRequest') }} />
            <Stack.Screen name="sync-failure" options={{ title: t('nav.sync') }} />
            <Stack.Screen name="about" options={{ title: t('nav.about') }} />
          </Stack.Protected>
        </Stack>
      )}
      <StatusBar style="light" />
    </>
  );
}

const styles = StyleSheet.create({
  loading: { alignItems: 'center', backgroundColor: colors.background, flex: 1, justifyContent: 'center' },
});

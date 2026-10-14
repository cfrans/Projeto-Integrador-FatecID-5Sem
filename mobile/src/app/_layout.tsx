import '@/lib/api-runtime';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { ThemeProvider } from 'expo-router/react-navigation';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SessionProvider, useSession } from '@/features/auth/SessionProvider';
import { colors, navigationTheme } from '@/theme';

export default function RootLayout() {
  return (
    <ThemeProvider value={navigationTheme}>
      <SessionProvider>
        <RootNavigator />
      </SessionProvider>
    </ThemeProvider>
  );
}

function RootNavigator() {
  const { status } = useSession();

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
            <Stack.Screen name="computers" options={{ title: 'Computadores' }} />
            <Stack.Screen name="qr-scan" options={{ title: 'Parear computador' }} />
            <Stack.Screen name="pairing-done" options={{ headerShown: false }} />
            <Stack.Screen name="restrictions" options={{ title: 'Restrições' }} />
            <Stack.Screen name="access-request" options={{ title: 'Pedido de liberação' }} />
            <Stack.Screen name="sync-failure" options={{ title: 'Sincronização' }} />
            <Stack.Screen name="about" options={{ title: 'Sobre o projeto' }} />
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

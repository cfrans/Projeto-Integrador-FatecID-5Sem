import { ThemeProvider } from 'expo-router/react-navigation';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { navigationTheme } from '@/theme';

export default function RootLayout() {
  return (
    <ThemeProvider value={navigationTheme}>
      <Stack>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="home" options={{ headerShown: false }} />
        <Stack.Screen name="computers" options={{ title: 'Computadores' }} />
        <Stack.Screen name="qr-scan" options={{ title: 'Parear computador' }} />
        <Stack.Screen name="pairing-done" options={{ headerShown: false }} />
        <Stack.Screen name="restrictions" options={{ title: 'Restrições' }} />
        <Stack.Screen name="access-request" options={{ title: 'Pedido de liberação' }} />
        <Stack.Screen name="sync-failure" options={{ title: 'Sincronização' }} />
        <Stack.Screen name="about" options={{ title: 'Sobre o projeto' }} />
      </Stack>
      <StatusBar style="light" />
    </ThemeProvider>
  );
}

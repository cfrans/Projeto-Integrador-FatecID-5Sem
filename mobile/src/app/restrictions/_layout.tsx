import { Tabs } from 'expo-router';
import { colors } from '@/theme';

export default function RestrictionsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accentText,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.background, borderTopColor: colors.border },
      }}
    >
      <Tabs.Screen name="browsers" options={{ title: 'Navegadores' }} />
      <Tabs.Screen name="apps" options={{ title: 'Aplicativos' }} />
      <Tabs.Screen name="install" options={{ title: 'Instalação' }} />
      <Tabs.Screen name="age" options={{ title: 'Idade' }} />
    </Tabs>
  );
}

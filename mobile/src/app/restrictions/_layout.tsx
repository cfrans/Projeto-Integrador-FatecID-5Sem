import { StyleSheet, Text, View, type ColorValue } from 'react-native';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RestrictionDeviceProvider } from '@/features/restrictions/RestrictionDeviceProvider';
import { useLanguage } from '@/features/i18n/LanguageProvider';
import { radius } from '@/theme';
import { useTheme } from '@/features/theme/ThemeProvider';

function BrowsersTabIcon({ color }: { color: ColorValue }) {
  return (
    <View style={[styles.globeCircle, { borderColor: color }]}>
      <View style={[styles.globeHorizontal, { backgroundColor: color }]} />
      <View style={[styles.globeVertical, { borderColor: color }]} />
    </View>
  );
}

function AppsTabIcon({ color }: { color: ColorValue }) {
  return (
    <View style={styles.appGrid}>
      <View style={[styles.appCell, { borderColor: color }]} />
      <View style={[styles.appCell, { borderColor: color }]} />
      <View style={[styles.appCell, { borderColor: color }]} />
      <View style={[styles.appCell, { borderColor: color }]} />
    </View>
  );
}

function InstallTabIcon({ color }: { color: ColorValue }) {
  return (
    <View style={styles.installBox}>
      <View style={[styles.installStem, { backgroundColor: color }]} />
      <View style={[styles.installArrowHead, { borderBottomColor: color, borderRightColor: color }]} />
      <View style={[styles.installTray, { borderColor: color }]} />
    </View>
  );
}

function AgeTabIcon({ color }: { color: ColorValue }) {
  return (
    <View style={[styles.ageBadge, { borderColor: color }]}>
      <Text style={[styles.ageBadgeText, { color }]}>12+</Text>
    </View>
  );
}

export default function RestrictionsLayout() {
  const { t } = useLanguage();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <RestrictionDeviceProvider>
      <Tabs
        backBehavior="none"
        screenOptions={{
          sceneStyle: { backgroundColor: colors.background },
          headerShown: false,
          tabBarActiveTintColor: colors.accentText,
          tabBarInactiveTintColor: colors.textMuted,
          tabBarStyle: {
            backgroundColor: colors.background,
            borderTopColor: colors.border,
            height: 56 + insets.bottom,
            paddingBottom: Math.max(insets.bottom, 8),
            paddingTop: 8,
          },
          tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        }}
      >
        <Tabs.Screen
          name="browsers"
          options={{
            title: t('nav.browsers'),
            tabBarIcon: ({ color }) => <BrowsersTabIcon color={color} />,
          }}
        />
        <Tabs.Screen
          name="apps"
          options={{
            title: t('nav.apps'),
            tabBarIcon: ({ color }) => <AppsTabIcon color={color} />,
          }}
        />
        <Tabs.Screen
          name="install"
          options={{
            title: t('nav.install'),
            tabBarIcon: ({ color }) => <InstallTabIcon color={color} />,
          }}
        />
        <Tabs.Screen
          name="age"
          options={{
            title: t('nav.age'),
            tabBarIcon: ({ color }) => <AgeTabIcon color={color} />,
          }}
        />
      </Tabs>
    </RestrictionDeviceProvider>
  );
}

const styles = StyleSheet.create({
  globeCircle: {
    alignItems: 'center',
    borderRadius: radius.pill,
    borderWidth: 1.5,
    height: 18,
    justifyContent: 'center',
    width: 18,
  },
  globeHorizontal: {
    height: 1.3,
    position: 'absolute',
    width: 15,
  },
  globeVertical: {
    borderRadius: radius.pill,
    borderWidth: 1.2,
    height: 16,
    position: 'absolute',
    width: 9,
  },
  appGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 3,
    height: 17,
    width: 17,
  },
  appCell: {
    borderRadius: 2,
    borderWidth: 1.5,
    height: 7,
    width: 7,
  },
  installBox: {
    alignItems: 'center',
    height: 18,
    justifyContent: 'center',
    width: 18,
  },
  installStem: {
    height: 9,
    marginTop: -2,
    width: 1.6,
  },
  installArrowHead: {
    borderBottomWidth: 1.6,
    borderRightWidth: 1.6,
    height: 6,
    marginTop: -5,
    transform: [{ rotate: '45deg' }],
    width: 6,
  },
  installTray: {
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3,
    borderBottomWidth: 1.6,
    borderLeftWidth: 1.6,
    borderRightWidth: 1.6,
    height: 5,
    marginTop: 2,
    width: 15,
  },
  ageBadge: {
    alignItems: 'center',
    borderRadius: 5,
    borderWidth: 1.5,
    height: 18,
    justifyContent: 'center',
    paddingHorizontal: 2,
    minWidth: 22,
  },
  ageBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    includeFontPadding: false,
    lineHeight: 11,
  },
});

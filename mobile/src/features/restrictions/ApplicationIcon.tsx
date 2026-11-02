import { Image, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';
import { useTheme } from '@/features/theme/ThemeProvider';
import { radius } from '@/theme';
import { findApplicationBrand, type ApplicationBrand } from './services/application-brand';

const logos: Record<ApplicationBrand, ImageSourcePropType> = {
  firefox: require('../../../assets/browsers/firefox.png'),
  chromium: require('../../../assets/browsers/chromium.png'),
  brave: require('../../../assets/browsers/brave.png'),
  'gnome-web': require('../../../assets/browsers/gnome-web.png'),
  chrome: require('../../../assets/applications/chrome.png'),
  edge: require('../../../assets/applications/edge.png'),
  steam: require('../../../assets/applications/steam.png'),
  libreoffice: require('../../../assets/applications/libreoffice.png'),
  vscode: require('../../../assets/applications/vscode.png'),
  gimp: require('../../../assets/applications/gimp.png'),
  discord: require('../../../assets/applications/discord.png'),
  telegram: require('../../../assets/applications/telegram.png'),
  spotify: require('../../../assets/applications/spotify.png'),
  vlc: require('../../../assets/applications/vlc.png'),
  minecraft: require('../../../assets/applications/minecraft.png'),
};

const prefetched = new Set<string>();
let prefetching: Promise<void> | null = null;

export function prefetchApplicationIcons(): Promise<void> {
  if (prefetching) return prefetching;
  const uris = [...new Set(Object.values(logos).map((source) => Image.resolveAssetSource(source)?.uri))]
    .filter((uri): uri is string => !!uri && !prefetched.has(uri));
  prefetching = Promise.allSettled(uris.map(async (uri) => {
    if (await Image.prefetch(uri)) prefetched.add(uri);
  })).then(() => undefined).finally(() => { prefetching = null; });
  return prefetching;
}

export function ApplicationIcon({ name, size = 42 }: { name: string; size?: number }) {
  const brand = findApplicationBrand(name);
  const { colors } = useTheme();
  return (
    <View accessible={false} style={[styles.container, { width: size, height: size, backgroundColor: colors.surfaceRaised }]}>
      {brand ? <Image accessible={false} source={logos[brand]} fadeDuration={0} resizeMode="contain" style={{ width: size * 0.76, height: size * 0.76 }} /> : <Text style={{ color: colors.textSecondary, fontSize: size * 0.38, fontWeight: '600' }}>{Array.from(name.trim())[0]?.toUpperCase() ?? '?'}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({ container: { alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm } });

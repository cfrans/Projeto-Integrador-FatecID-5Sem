import type { ImageRequireSource } from 'react-native';
import type { ApplicationBrand } from '../features/restrictions/services/application-brand';
import type { ComputerIconId } from '../features/devices/services/computer-icons';

export const applicationImages: Record<ApplicationBrand, ImageRequireSource> = {
  firefox: require('../../assets/browsers/firefox.png'),
  chromium: require('../../assets/browsers/chromium.png'),
  brave: require('../../assets/browsers/brave.png'),
  'gnome-web': require('../../assets/browsers/gnome-web.png'),
  chrome: require('../../assets/applications/chrome.png'),
  edge: require('../../assets/applications/edge.png'),
  steam: require('../../assets/applications/steam.png'),
  libreoffice: require('../../assets/applications/libreoffice.png'),
  vscode: require('../../assets/applications/vscode.png'),
  gimp: require('../../assets/applications/gimp.png'),
  discord: require('../../assets/applications/discord.png'),
  telegram: require('../../assets/applications/telegram.png'),
  spotify: require('../../assets/applications/spotify.png'),
  vlc: require('../../assets/applications/vlc.png'),
  minecraft: require('../../assets/applications/minecraft.png'),
};

export const computerImages: Record<ComputerIconId, ImageRequireSource> = {
  desktop: require('../../assets/computers/monitor.png'),
  laptop: require('../../assets/computers/laptop.png'),
  gaming: require('../../assets/computers/gamepad-2.png'),
  server: require('../../assets/computers/server.png'),
};

export const teamImages = {
  cfrans: require('../../assets/team/cfrans.png'),
  camilabarcaro: require('../../assets/team/camilabarcaro.jpg'),
  TamaGab: require('../../assets/team/TamaGab.jpg'),
  pxdrui: require('../../assets/team/pxdrui.jpg'),
  vitoriafaturi: require('../../assets/team/vitoriafaturi.png'),
};

export const interfaceImages = {
  settings: require('../../assets/icons/settings.png'),
  signOut: require('../../assets/icons/log-out.png'),
  system: require('../../assets/icons/monitor.png'),
  light: require('../../assets/icons/sun.png'),
  dark: require('../../assets/icons/moon.png'),
};

export const startupImages: ImageRequireSource[] = [
  ...Object.values(applicationImages), ...Object.values(computerImages),
  ...Object.values(teamImages), ...Object.values(interfaceImages),
  require('expo-router/assets/react-navigation/elements/back-icon.png'),
  require('expo-router/assets/react-navigation/elements/back-icon-mask.png'),
  require('../../assets/icon.png'), require('../../assets/splash-icon.png'), require('../../assets/favicon.png'),
  require('../../assets/android-icon-foreground.png'), require('../../assets/android-icon-background.png'), require('../../assets/android-icon-monochrome.png'),
];

const aliases = {
  firefox: ['Firefox', 'Mozilla Firefox', 'Firefox ESR'],
  chromium: ['Chromium', 'Chromium Browser'],
  brave: ['Brave', 'Brave Browser'],
  'gnome-web': ['GNOME Web', 'Web', 'Epiphany'],
  chrome: ['Chrome', 'Google Chrome'],
  edge: ['Edge', 'Microsoft Edge'],
  steam: ['Steam'],
  libreoffice: ['LibreOffice', 'LibreOffice Writer', 'LibreOffice Calc', 'LibreOffice Impress'],
  vscode: ['Visual Studio Code', 'VS Code', 'VSCode', 'Code'],
  gimp: ['GIMP', 'GNU Image Manipulation Program'],
  discord: ['Discord'],
  telegram: ['Telegram', 'Telegram Desktop'],
  spotify: ['Spotify'],
  vlc: ['VLC', 'VLC media player'],
  minecraft: ['Minecraft', 'Minecraft Launcher'],
} as const;

export type ApplicationBrand = keyof typeof aliases;

export const flathubIds: Record<ApplicationBrand, string> = {
  firefox: 'org.mozilla.firefox',
  chromium: 'org.chromium.Chromium',
  brave: 'com.brave.Browser',
  'gnome-web': 'org.gnome.Epiphany',
  chrome: 'com.google.Chrome',
  edge: 'com.microsoft.Edge',
  steam: 'com.valvesoftware.Steam',
  libreoffice: 'org.libreoffice.LibreOffice',
  vscode: 'com.visualstudio.code',
  gimp: 'org.gimp.GIMP',
  discord: 'com.discordapp.Discord',
  telegram: 'org.telegram.desktop',
  spotify: 'com.spotify.Client',
  vlc: 'org.videolan.VLC',
  minecraft: 'com.mojang.Minecraft',
};

function normalize(name: string) {
  return name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase().replace(/[\s._-]+/g, ' ');
}

const brands = new Map<string, ApplicationBrand>(
  (Object.entries(aliases) as [ApplicationBrand, readonly string[]][]).flatMap(([brand, names]) => [...names, flathubIds[brand]].map((name) => [normalize(name), brand] as const)),
);

export function findApplicationBrand(name: string): ApplicationBrand | null {
  return brands.get(normalize(name)) ?? null;
}

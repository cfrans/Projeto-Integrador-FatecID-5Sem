const aliases = {
  firefox: ['Firefox', 'Mozilla Firefox', 'Firefox ESR', 'org.mozilla.firefox'],
  chromium: ['Chromium', 'Chromium Browser', 'org.chromium.Chromium'],
  brave: ['Brave', 'Brave Browser', 'com.brave.Browser'],
  'gnome-web': ['GNOME Web', 'Web', 'Epiphany', 'org.gnome.Epiphany'],
  chrome: ['Chrome', 'Google Chrome', 'com.google.Chrome'],
  edge: ['Edge', 'Microsoft Edge', 'com.microsoft.Edge'],
  steam: ['Steam', 'com.valvesoftware.Steam'],
  libreoffice: ['LibreOffice', 'LibreOffice Writer', 'LibreOffice Calc', 'LibreOffice Impress', 'org.libreoffice.LibreOffice'],
  vscode: ['Visual Studio Code', 'VS Code', 'VSCode', 'Code', 'com.visualstudio.code'],
  gimp: ['GIMP', 'GNU Image Manipulation Program', 'org.gimp.GIMP'],
  discord: ['Discord', 'com.discordapp.Discord'],
  telegram: ['Telegram', 'Telegram Desktop', 'org.telegram.desktop'],
  spotify: ['Spotify', 'com.spotify.Client'],
  vlc: ['VLC', 'VLC media player', 'org.videolan.VLC'],
  minecraft: ['Minecraft', 'Minecraft Launcher', 'com.mojang.Minecraft'],
} as const;

export type ApplicationBrand = keyof typeof aliases;

function normalize(name: string) {
  return name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase().replace(/[\s._-]+/g, ' ');
}

const brands = new Map<string, ApplicationBrand>(
  (Object.entries(aliases) as [ApplicationBrand, readonly string[]][]).flatMap(([brand, names]) => names.map((name) => [normalize(name), brand] as const)),
);

export function findApplicationBrand(name: string): ApplicationBrand | null {
  return brands.get(normalize(name)) ?? null;
}

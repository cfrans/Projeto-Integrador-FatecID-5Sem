export const applicationCatalog = [
  { id: 'firefox', name: 'Firefox', category: 'Navegador', ageRating: 'L', asset: 'browsers/firefox.png' },
  { id: 'chromium', name: 'Chromium', category: 'Navegador', ageRating: 'L', asset: 'browsers/chromium.png' },
  { id: 'brave', name: 'Brave', category: 'Navegador', ageRating: 'L', asset: 'browsers/brave.png' },
  { id: 'chrome', name: 'Google Chrome', category: 'Navegador', ageRating: 'L', asset: 'applications/chrome.png' },
  { id: 'edge', name: 'Microsoft Edge', category: 'Navegador', ageRating: 'L', asset: 'applications/edge.png' },
  { id: 'libreoffice', name: 'LibreOffice', category: 'Produtividade', ageRating: 'L', asset: 'applications/libreoffice.png' },
  { id: 'vscode', name: 'Visual Studio Code', category: 'Desenvolvimento', ageRating: 'L', asset: 'applications/vscode.png' },
  { id: 'gimp', name: 'GIMP', category: 'Criação', ageRating: 'L', asset: 'applications/gimp.png' },
  { id: 'vlc', name: 'VLC', category: 'Multimídia', ageRating: 'L', asset: 'applications/vlc.png' },
  { id: 'steam', name: 'Steam', category: 'Jogos', ageRating: '12', asset: 'applications/steam.png' },
  { id: 'minecraft', name: 'Minecraft', category: 'Jogos', ageRating: '10', asset: 'applications/minecraft.png' },
  { id: 'discord', name: 'Discord', category: 'Comunicação', ageRating: '12', asset: 'applications/discord.png' },
  { id: 'telegram', name: 'Telegram', category: 'Comunicação', ageRating: '12', asset: 'applications/telegram.png' },
  { id: 'spotify', name: 'Spotify', category: 'Multimídia', ageRating: '12', asset: 'applications/spotify.png' },
].map((app) => ({ ...app, logo: `/logos/${app.id}.png` }));

export function approvedApplications(applications, requests, decisions) {
  const next = [...applications];
  for (const request of requests) {
    if (decisions[request.id] !== 'APPROVED' || next.some((app) => app.name === request.applicationName)) continue;
    const entry = applicationCatalog.find((app) => app.name === request.applicationName);
    next.push({ id: request.id, name: request.applicationName, category: entry?.category ?? 'Instalado na simulação' });
  }
  return next;
}

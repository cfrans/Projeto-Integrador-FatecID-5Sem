import type { AppFilter } from '../commands/command-types.js';
import type { Settings } from './simulation.contract.js';

export const BROWSER_SOURCE_IDS: Record<string, string[]> = {
  firefox: ['desktop:firefox-esr.desktop', 'desktop:firefox.desktop'],
  chromium: ['desktop:chromium.desktop'],
  brave: ['desktop:brave-browser.desktop'],
  'gnome-web': ['desktop:org.gnome.Epiphany.desktop'],
};

export function deriveAppFilter(
  settings: Settings,
  installed: { id: string; sourceId: string }[],
): AppFilter {
  const reported = new Set(installed.map((app) => app.sourceId));
  const blocked = new Set(
    installed
      .filter((app) => settings.applicationRules[app.id] === false)
      .map((app) => app.sourceId),
  );
  if (settings.blockBrowsers)
    for (const [browser, sourceIds] of Object.entries(BROWSER_SOURCE_IDS))
      if (!settings.allowedBrowsers[browser])
        for (const sourceId of sourceIds)
          if (reported.has(sourceId)) blocked.add(sourceId);
  return {
    blockedApplications: [...blocked].sort(),
    blockInstallation: settings.blockInstallation,
  };
}

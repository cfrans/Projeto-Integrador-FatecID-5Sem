import { BadRequestException } from '@nestjs/common';
import type { AppFilter } from '../commands/command-types.js';
import { invalid, type Settings } from './simulation.contract.js';

export const BROWSER_SOURCE_IDS: Record<string, string[]> = {
  firefox: ['desktop:firefox-esr.desktop', 'desktop:firefox.desktop'],
  chromium: ['desktop:chromium.desktop'],
  brave: ['desktop:brave-browser.desktop'],
  'gnome-web': ['desktop:org.gnome.Epiphany.desktop'],
};

export type ReportedApplication = {
  id: string;
  sourceId: string;
  name: string;
  blockable: boolean;
  executable: string | null;
};

function sameExecutable(
  application: ReportedApplication,
  installed: ReportedApplication[],
): ReportedApplication[] {
  if (application.executable === null) return [application];
  return installed.filter(
    (other) => other.executable === application.executable,
  );
}

export function applyApplicationRules(
  rules: Record<string, boolean>,
  patch: Record<string, boolean>,
  installed: ReportedApplication[],
): Record<string, boolean> {
  const byId = new Map(
    installed.map((application) => [application.id, application]),
  );
  const decided = new Map<string, { allowed: boolean; name: string }>();
  const result = { ...rules };
  for (const [applicationId, allowed] of Object.entries(patch)) {
    const application = byId.get(applicationId);
    if (!application) invalid();
    if (!allowed && !application.blockable)
      throw new BadRequestException(
        `${application.name} não pode ser bloqueado neste computador. Nenhuma alteração foi salva.`,
      );
    for (const member of sameExecutable(application, installed)) {
      const previous = decided.get(member.id);
      if (previous && previous.allowed !== allowed)
        throw new BadRequestException(
          `${previous.name} e ${application.name} são bloqueados juntos e precisam da mesma regra. Nenhuma alteração foi salva.`,
        );
      decided.set(member.id, { allowed, name: application.name });
      result[member.id] = allowed;
    }
  }
  return result;
}

export function deriveAppFilter(
  settings: Settings,
  installed: ReportedApplication[],
): AppFilter {
  const blockable = installed.filter((app) => app.blockable);
  const bySourceId = new Map(blockable.map((app) => [app.sourceId, app]));
  const blocked = blockable.filter(
    (app) => settings.applicationRules[app.id] === false,
  );
  if (settings.blockBrowsers)
    for (const [browser, sourceIds] of Object.entries(BROWSER_SOURCE_IDS))
      if (!settings.allowedBrowsers[browser])
        for (const sourceId of sourceIds) {
          const browserApp = bySourceId.get(sourceId);
          if (browserApp) blocked.push(browserApp);
        }
  const sourceIds = new Set(
    blocked.flatMap((app) =>
      sameExecutable(app, blockable).map((member) => member.sourceId),
    ),
  );
  return {
    blockedApplications: [...sourceIds].sort(),
    blockInstallation: settings.blockInstallation,
  };
}

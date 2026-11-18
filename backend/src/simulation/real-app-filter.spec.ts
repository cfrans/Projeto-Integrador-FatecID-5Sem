import { defaults } from './simulation.contract.js';
import {
  applyApplicationRules,
  BROWSER_SOURCE_IDS,
  deriveAppFilter,
  type ReportedApplication,
} from './real-app-filter.js';

const app = (
  id: string,
  sourceId: string,
  executable: string | null = `/usr/bin/${id}`,
): ReportedApplication => ({
  id,
  sourceId,
  name: id,
  blockable: executable !== null,
  executable,
});

describe('deriveAppFilter', () => {
  const installed = [
    app('gimp', 'desktop:gimp.desktop'),
    app('zed', 'desktop:zed.desktop'),
    app('ff', 'desktop:firefox-esr.desktop'),
    app('chromium', 'desktop:chromium.desktop'),
    app('epiphany', 'desktop:org.gnome.Epiphany.desktop'),
  ];

  it('blocks denied apps and disallowed reported browsers, sorted and without repetition', () => {
    const settings = {
      ...defaults(),
      allowedBrowsers: { ...defaults().allowedBrowsers, firefox: false },
      applicationRules: { zed: false, gimp: true, chromium: false },
    };
    expect(deriveAppFilter(settings, installed)).toEqual({
      blockedApplications: [
        'desktop:chromium.desktop',
        'desktop:firefox-esr.desktop',
        'desktop:zed.desktop',
      ],
      blockInstallation: true,
    });
  });

  it('ignores browser rules when browsers are not blocked and rules for unreported apps', () => {
    const settings = {
      ...defaults(),
      blockBrowsers: false,
      blockInstallation: false,
      applicationRules: { removed: false },
    };
    expect(deriveAppFilter(settings, installed)).toEqual({
      blockedApplications: [],
      blockInstallation: false,
    });
  });

  it('blocks every app that shares the executable of a blocked app or browser', () => {
    const settings = {
      ...defaults(),
      allowedBrowsers: { ...defaults().allowedBrowsers, firefox: false },
      applicationRules: { writer: false },
    };
    expect(
      deriveAppFilter(settings, [
        app('writer', 'desktop:writer.desktop', '/usr/bin/libreoffice'),
        app('calc', 'desktop:calc.desktop', '/usr/bin/libreoffice'),
        app('ff', 'desktop:firefox-esr.desktop', '/usr/bin/firefox-esr'),
        app('ffp', 'desktop:firefox-private.desktop', '/usr/bin/firefox-esr'),
        app('gimp', 'desktop:gimp.desktop'),
      ]).blockedApplications,
    ).toEqual([
      'desktop:calc.desktop',
      'desktop:firefox-esr.desktop',
      'desktop:firefox-private.desktop',
      'desktop:writer.desktop',
    ]);
  });

  it('leaves out apps that are no longer blockable, including browsers', () => {
    const settings = {
      ...defaults(),
      allowedBrowsers: { ...defaults().allowedBrowsers, chromium: false },
      applicationRules: { guides: false, gimp: false },
    };
    expect(
      deriveAppFilter(settings, [
        app('guides', 'desktop:guides.desktop', null),
        app('chromium', 'desktop:chromium.desktop', null),
        app('gimp', 'desktop:gimp.desktop'),
      ]).blockedApplications,
    ).toEqual(['desktop:gimp.desktop']);
  });

  it('keeps legacy inventory without executable as one app per rule', () => {
    const settings = { ...defaults(), applicationRules: { a: false } };
    expect(
      deriveAppFilter(settings, [
        { ...app('a', 'desktop:a.desktop', null), blockable: true },
        { ...app('b', 'desktop:b.desktop', null), blockable: true },
      ]).blockedApplications,
    ).toEqual(['desktop:a.desktop']);
  });

  it('maps every browser key accepted by the settings contract', () => {
    expect(Object.keys(BROWSER_SOURCE_IDS).sort()).toEqual(
      Object.keys(defaults().allowedBrowsers).sort(),
    );
  });
});

describe('applyApplicationRules', () => {
  const installed = [
    app('writer', 'desktop:writer.desktop', '/usr/bin/libreoffice'),
    app('calc', 'desktop:calc.desktop', '/usr/bin/libreoffice'),
    app('guides', 'desktop:guides.desktop', null),
    app('gimp', 'desktop:gimp.desktop'),
  ];

  it('applies a rule to the whole executable group and keeps other rules', () => {
    expect(
      applyApplicationRules({ gimp: false }, { writer: false }, installed),
    ).toEqual({ gimp: false, writer: false, calc: false });
    expect(
      applyApplicationRules(
        { writer: false, calc: false },
        { calc: true },
        installed,
      ),
    ).toEqual({ writer: true, calc: true });
  });

  it('refuses to block an app that cannot be blocked, saying nothing was saved', () => {
    expect(() =>
      applyApplicationRules({}, { gimp: false, guides: false }, installed),
    ).toThrow(
      expect.objectContaining({
        status: 400,
        message:
          'guides não pode ser bloqueado neste computador. Nenhuma alteração foi salva.',
      }),
    );
  });

  it('allows clearing a stale block on an app that cannot be blocked', () => {
    expect(
      applyApplicationRules({ guides: false }, { guides: true }, installed),
    ).toEqual({ guides: true });
  });

  it('refuses different rules for apps of the same group in one patch', () => {
    expect(() =>
      applyApplicationRules({}, { writer: false, calc: true }, installed),
    ).toThrow(
      expect.objectContaining({
        status: 400,
        message:
          'writer e calc são bloqueados juntos e precisam da mesma regra. Nenhuma alteração foi salva.',
      }),
    );
  });

  it('refuses unknown apps', () => {
    expect(() =>
      applyApplicationRules({}, { removed: false }, installed),
    ).toThrow(expect.objectContaining({ status: 400 }));
  });
});

import { defaults } from './simulation.contract.js';
import { BROWSER_SOURCE_IDS, deriveAppFilter } from './real-app-filter.js';

describe('deriveAppFilter', () => {
  const installed = [
    { id: 'gimp', sourceId: 'desktop:gimp.desktop' },
    { id: 'zed', sourceId: 'desktop:zed.desktop' },
    { id: 'ff', sourceId: 'desktop:firefox-esr.desktop' },
    { id: 'chromium', sourceId: 'desktop:chromium.desktop' },
    { id: 'epiphany', sourceId: 'desktop:org.gnome.Epiphany.desktop' },
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

  it('maps every browser key accepted by the settings contract', () => {
    expect(Object.keys(BROWSER_SOURCE_IDS).sort()).toEqual(
      Object.keys(defaults().allowedBrowsers).sort(),
    );
  });
});

import { BadRequestException } from '@nestjs/common';

export type Settings = {
  blockBrowsers: boolean;
  allowedBrowsers: Record<string, boolean>;
  blockInstallation: boolean;
  ageRating: string;
  applicationRules: Record<string, boolean>;
  installationDecisions: Record<string, 'APPROVED' | 'DENIED'>;
};

const browsers = ['firefox', 'chromium', 'brave', 'gnome-web'];
const ages = ['L', '10', '12', '16', '18'];
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function defaults(): Settings {
  return {
    blockBrowsers: true,
    allowedBrowsers: {
      firefox: true,
      chromium: false,
      brave: false,
      'gnome-web': true,
    },
    blockInstallation: true,
    ageRating: '12',
    applicationRules: {},
    installationDecisions: {},
  };
}

export function object(
  value: unknown,
  keys: string[],
): Record<string, unknown> {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.keys(value).some((key) => !keys.includes(key))
  )
    invalid();
  return value as Record<string, unknown>;
}

export function invalid(): never {
  throw new BadRequestException('Dados de simulação inválidos.');
}

export function text(value: unknown, max: number): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max)
    invalid();
  return value.trim();
}

export function id(value: unknown): string {
  if (typeof value !== 'string' || !uuid.test(value)) invalid();
  return value;
}

export function revision(value: unknown): number {
  if (
    typeof value !== 'number' ||
    !Number.isSafeInteger(value) ||
    value < 1 ||
    value > 2147483646
  )
    invalid();
  return value;
}

export function settingsPatch(value: unknown): Partial<Settings> {
  const input = object(value, Object.keys(defaults()));
  if (!Object.keys(input).length) invalid();
  for (const [key, entry] of Object.entries(input)) {
    if (key === 'blockBrowsers' || key === 'blockInstallation') {
      if (typeof entry !== 'boolean') invalid();
    } else if (key === 'ageRating') {
      if (typeof entry !== 'string' || !ages.includes(entry)) invalid();
    } else {
      if (
        !entry ||
        typeof entry !== 'object' ||
        Array.isArray(entry) ||
        Object.keys(entry).length > 100
      )
        invalid();
      for (const [item, setting] of Object.entries(entry)) {
        if (
          key === 'allowedBrowsers'
            ? !browsers.includes(item)
            : !uuid.test(item)
        )
          invalid();
        if (
          key === 'installationDecisions'
            ? !['APPROVED', 'DENIED'].includes(setting as string)
            : typeof setting !== 'boolean'
        )
          invalid();
      }
    }
  }
  return input as Partial<Settings>;
}

export function mergeSettings(
  current: Settings,
  patch: Partial<Settings>,
): Settings {
  return {
    ...current,
    ...patch,
    allowedBrowsers: { ...current.allowedBrowsers, ...patch.allowedBrowsers },
    applicationRules: {
      ...current.applicationRules,
      ...patch.applicationRules,
    },
    installationDecisions: {
      ...current.installationDecisions,
      ...patch.installationDecisions,
    },
  };
}

export function report(value: unknown) {
  const input = object(value, [
    'associationId',
    'revision',
    'applications',
    'installationRequests',
  ]);
  const applications = array(input.applications).map((entry) => {
    const app = object(entry, ['id', 'name', 'category']);
    return {
      id: id(app.id),
      name: text(app.name, 200),
      category: text(app.category, 100),
    };
  });
  const installationRequests = array(input.installationRequests).map(
    (entry) => {
      const request = object(entry, [
        'id',
        'applicationName',
        'requesterName',
        'requestedAt',
        'ageRating',
      ]);
      if (
        typeof request.requestedAt !== 'string' ||
        !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(
          request.requestedAt,
        ) ||
        !Number.isFinite(Date.parse(request.requestedAt))
      )
        invalid();
      if (
        typeof request.ageRating !== 'string' ||
        !ages.includes(request.ageRating)
      )
        invalid();
      return {
        id: id(request.id),
        applicationName: text(request.applicationName, 200),
        requesterName: text(request.requesterName, 100),
        requestedAt: new Date(request.requestedAt),
        ageRating: request.ageRating,
      };
    },
  );
  for (const entries of [applications, installationRequests]) {
    if (new Set(entries.map((entry) => entry.id)).size !== entries.length)
      invalid();
  }
  return {
    associationId: id(input.associationId),
    revision: revision(input.revision),
    applications,
    installationRequests,
  };
}

function array(value: unknown): unknown[] {
  if (!Array.isArray(value) || value.length > 100) invalid();
  return value;
}

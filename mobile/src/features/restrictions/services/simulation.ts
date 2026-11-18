import { api } from '../../../lib/api.ts';

export type SimulationSettings = {
  blockBrowsers: boolean;
  allowedBrowsers: Record<string, boolean>;
  blockInstallation: boolean;
  ageRating: 'L' | '10' | '12' | '16' | '18';
  applicationRules: Record<string, boolean>;
  installationDecisions: Record<string, 'APPROVED' | 'DENIED'>;
};

export type SimulationSnapshot = {
  associationId: string;
  revision: number;
  appliedRevision: number | null;
  appliedAt: string | null;
  connection: { status: 'online' | 'offline' | 'unverified'; lastSeen: string | null };
  settings: SimulationSettings;
  error?: { code: string; at: string | null } | null;
  enforcement?: 'enabled' | 'disabled';
};

export type RealPolicyStatus = 'applied' | 'disabled' | 'failed' | 'idle' | 'pending';

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseSimulation(value: unknown): SimulationSnapshot {
  if (!record(value) || typeof value.associationId !== 'string' || !uuid.test(value.associationId)
    || !Number.isSafeInteger(value.revision) || (value.revision as number) < 1
    || !(value.appliedRevision === null || (Number.isSafeInteger(value.appliedRevision) && (value.appliedRevision as number) >= 1 && (value.appliedRevision as number) <= (value.revision as number)))
    || !(value.appliedAt === null || (typeof value.appliedAt === 'string' && Number.isFinite(Date.parse(value.appliedAt))))) throw new Error('Resposta de simulação inválida.');
  const settings = value.settings;
  const connection = value.connection;
  if (!record(connection) || !(connection.status === 'unverified' ? connection.lastSeen === null
    : ['online', 'offline'].includes(connection.status as string) && typeof connection.lastSeen === 'string'
      && Number.isFinite(Date.parse(connection.lastSeen)))) throw new Error('Resposta de simulação inválida.');
  if (!record(settings) || typeof settings.blockBrowsers !== 'boolean' || typeof settings.blockInstallation !== 'boolean'
    || !['L', '10', '12', '16', '18'].includes(settings.ageRating as string)
    || !record(settings.allowedBrowsers) || !['firefox', 'chromium', 'brave', 'gnome-web'].every((key) => typeof (settings.allowedBrowsers as Record<string, unknown>)[key] === 'boolean')
    || !record(settings.applicationRules) || !Object.entries(settings.applicationRules).every(([key, rule]) => uuid.test(key) && typeof rule === 'boolean')
    || !record(settings.installationDecisions) || !Object.entries(settings.installationDecisions).every(([key, rule]) => uuid.test(key) && ['APPROVED', 'DENIED'].includes(rule as string))) throw new Error('Resposta de simulação inválida.');
  const error = value.error;
  if (!(error === undefined || error === null || (record(error) && typeof error.code === 'string' && error.code.length > 0
    && (error.at === null || (typeof error.at === 'string' && Number.isFinite(Date.parse(error.at))))))
    || !(value.enforcement === undefined || value.enforcement === 'enabled' || value.enforcement === 'disabled')) throw new Error('Resposta de simulação inválida.');
  return value as unknown as SimulationSnapshot;
}

export function realPolicyStatus(snapshot: SimulationSnapshot): RealPolicyStatus {
  if (snapshot.appliedRevision === snapshot.revision) return 'applied';
  if (snapshot.enforcement === 'disabled') return 'disabled';
  if (snapshot.error) return 'failed';
  if (snapshot.appliedRevision === null && snapshot.revision === 1) return 'idle';
  return 'pending';
}

export async function readSimulation(deviceId: string) {
  return parseSimulation(await api.request<unknown>(`/simulation/devices/${encodeURIComponent(deviceId)}`, { method: 'GET' }));
}

export async function updateSimulation(deviceId: string, revision: number, settings: Partial<SimulationSettings>) {
  return parseSimulation(await api.request<unknown>(`/simulation/devices/${encodeURIComponent(deviceId)}`, { method: 'PATCH', body: { revision, settings } }));
}

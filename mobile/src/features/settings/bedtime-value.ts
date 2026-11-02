export type Bedtime = { hour: number; minute: number };

export const DEFAULT_BEDTIME: Bedtime = { hour: 21, minute: 30 };

export function parseBedtime(value: string): Bedtime | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value.trim());
  return match ? { hour: Number(match[1]), minute: Number(match[2]) } : null;
}

export function formatBedtime({ hour, minute }: Bedtime) {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export const COMPUTER_ICONS = ['desktop', 'laptop', 'gaming', 'server'] as const;
export type ComputerIconId = typeof COMPUTER_ICONS[number];
export type ComputerIcons = Record<string, ComputerIconId>;

export function isComputerIcon(value: unknown): value is ComputerIconId {
  return typeof value === 'string' && COMPUTER_ICONS.some((icon) => icon === value);
}

export function parseComputerIcons(raw: string | null): ComputerIcons {
  if (!raw) return {};
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return Object.fromEntries(Object.entries(value).filter(([id, icon]) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) && isComputerIcon(icon))) as ComputerIcons;
  } catch {
    return {};
  }
}

export function computerIconsStorageKey(guardianId: string) {
  return `piplup.computer-icons.v1.${guardianId}`;
}

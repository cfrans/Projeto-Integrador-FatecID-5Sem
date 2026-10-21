export type ThemePreference = 'system' | 'light' | 'dark';

export function resolveTheme(preference: ThemePreference, systemScheme: string | null | undefined): 'light' | 'dark' {
  return preference === 'system' ? systemScheme === 'light' ? 'light' : 'dark' : preference;
}

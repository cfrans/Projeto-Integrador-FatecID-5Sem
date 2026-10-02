export const colors = {
  background: '#0F1118',
  surface: '#1A1C25',
  surfaceRaised: '#232631',
  border: '#2E313D',
  textPrimary: '#ECEDF2',
  textSecondary: '#9A9DAB',
  textMuted: '#6B6E7C',
  accent: '#E5483D',
  accentSoft: '#3A1814',
  accentText: '#FF8A80',
  success: '#4CAF7A',
  danger: '#E5483D',
} as const;

export type ColorName = keyof typeof colors;

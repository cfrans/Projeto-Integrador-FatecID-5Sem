export type ColorPalette = {
  background: string;
  backgroundGlow: string;
  backgroundTint: string;
  surface: string;
  surfaceRaised: string;
  border: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  accent: string;
  accentSoft: string;
  accentText: string;
  success: string;
  danger: string;
};

export const darkColors: ColorPalette = {
  background: '#0F1118',
  backgroundGlow: '#1B1E2A',
  backgroundTint: '#161925',
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
};

export const lightColors: ColorPalette = {
  background: '#ECEFF9',
  backgroundGlow: '#F8F9FE',
  backgroundTint: '#E7EAF6',
  surface: '#F8F9FE',
  surfaceRaised: '#E7EAF6',
  border: '#CFD3E5',
  textPrimary: '#292B31',
  textSecondary: '#6C7183',
  textMuted: '#75798C',
  accent: '#E5483D',
  accentSoft: '#FBD9D3',
  accentText: '#8E2C23',
  success: '#2E8B5C',
  danger: '#E5483D',
};

export type ColorName = keyof ColorPalette;

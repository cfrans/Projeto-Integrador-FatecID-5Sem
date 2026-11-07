import type { Language } from '../../i18n/translations.ts';

import { flathubIds, type ApplicationBrand } from '../../restrictions/services/application-brand.ts';
import { catalogPortuguese } from './flathub-pt.ts';

export type CatalogDetails = {
  summary: string;
  description: string[];
  version: string | null;
  rating: { label: string | null; system: string | null; indicators: string[] } | null;
  screenshot: { uri: string; caption: string } | null;
};

function catalogText(value: string, language: Language) {
  const text = value.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, ' ').replace(/\*\*/g, '').trim().replace(/\s+/g, ' ');
  return language === 'pt-BR' ? catalogPortuguese.get(text) ?? text : text;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object';
}

function firstScreenshot(value: unknown, language: Language): CatalogDetails['screenshot'] {
  if (!Array.isArray(value)) return null;
  for (const shot of value) {
    if (!isRecord(shot) || !Array.isArray(shot.sizes)) continue;
    const sizes = shot.sizes.filter((size): size is { src: string; width: string | number } =>
      isRecord(size) && typeof size.src === 'string' && size.src.startsWith('https://dl.flathub.org/media/')
      && Number(size.width) > 0);
    sizes.sort((a, b) => Number(a.width) - Number(b.width));
    const size = sizes.find((item) => Number(item.width) >= 600) ?? sizes.at(-1);
    if (size) return { uri: size.src, caption: typeof shot.caption === 'string' ? catalogText(shot.caption, language) : '' };
  }
  return null;
}

const ratingLocales: Record<Language, string> = { 'pt-BR': 'pt_BR', en: 'en_US', es: 'es_ES' };

function parseRating(value: unknown, language: Language): CatalogDetails['rating'] {
  if (!isRecord(value)) return null;
  const rating = value[ratingLocales[language]];
  if (!isRecord(rating)) return null;
  const label = typeof rating.minimumAgeText === 'string' ? rating.minimumAgeText.trim() || null : null;
  const system = typeof rating.contentRatingSystem === 'string' ? rating.contentRatingSystem.trim() || null : null;
  const indicators: string[] = [];
  if (Array.isArray(rating.categories)) {
    for (const category of rating.categories) {
      if (isRecord(category) && typeof category.description === 'string' && category.description.trim()) {
        indicators.push(category.description.trim());
      }
    }
  }
  return label || indicators.length ? { label, system, indicators } : null;
}

export async function fetchCatalogDetails(brand: ApplicationBrand, language: Language, signal: AbortSignal): Promise<CatalogDetails> {
  const id = flathubIds[brand];
  const response = await fetch(`https://flathub.org/api/v2/appstream/${id}?locale=${language}`, {
    credentials: 'omit',
    signal,
  });
  if (!response.ok) throw new Error('Flathub unavailable');
  const data: unknown = await response.json();
  if (!isRecord(data) || data.id !== id || typeof data.summary !== 'string' || !data.summary.trim()) {
    throw new Error('Invalid Flathub catalog entry');
  }
  const description = typeof data.description === 'string' ? data.description
    .split(/<\/(?:p|li)\s*>|<br\s*\/?>/i)
    .map((part) => catalogText(part.replace(/<[^>]*>/g, ' '), language))
    .filter(Boolean) : [];
  const stable = Array.isArray(data.releases) ? data.releases.find((release: unknown) =>
    isRecord(release) && release.type === 'stable' && typeof release.version === 'string' && release.version.trim()) : null;
  return {
    summary: catalogText(data.summary, language),
    description: [...new Set(description)],
    version: stable?.version ?? null,
    rating: parseRating(data.content_rating_details, language),
    screenshot: firstScreenshot(data.screenshots, language),
  };
}

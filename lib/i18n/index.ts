/**
 * Locale handling for GdzieKibel.pl.
 *
 * Polish is the default and the brand's own language. English exists because
 * the research found tourists underserved by the city's own app, which has no
 * English (`docs/research/2026-09-13-warsaw-toilet-sources.md`, section 3.5).
 *
 * Language lives in the URL, not in component state, so that `/en` can be
 * shared, indexed and rendered on the server with a correct `lang` attribute.
 */

export const LOCALES = ['pl', 'en'] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'pl';

/** Narrows an unknown path segment to a supported locale. */
export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}

/** The locale a switch should offer from the given one. */
export function otherLocale(locale: Locale): Locale {
  return locale === 'pl' ? 'en' : 'pl';
}

/** How each locale names itself, for the language switch. */
export const LOCALE_NAMES: Record<Locale, string> = {
  pl: 'Polski',
  en: 'English',
};

/** Short label used on the switch itself, where space is tight. */
export const LOCALE_SHORT: Record<Locale, string> = {
  pl: 'PL',
  en: 'EN',
};

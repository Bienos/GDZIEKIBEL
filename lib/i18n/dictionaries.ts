import type { Locale } from './index';

/**
 * User-facing copy, keyed by locale.
 *
 * Every key must exist in every locale. `tests/unit/i18n.test.ts` enforces that,
 * so a missing translation fails the build rather than falling back silently to
 * Polish in front of an English reader.
 *
 * `BRAND.md` section 3 keeps strong language for hero and campaign copy and
 * requires factual labels to stay literal. The English side is written as
 * direct English, not a word-for-word translation of Polish profanity, which is
 * the rule in `docs/research/...`, section 3.5.
 */
export interface Dictionary {
  /** Small label above the wordmark. */
  stage: string;
  /** The one placeholder line the foundation shell is allowed to show. */
  placeholder: string;
  /** Accessible name for the language switch. */
  languageSwitchLabel: string;
  /** Page title and description. */
  metaTitle: string;
  metaDescription: string;
}

export const DICTIONARIES: Record<Locale, Dictionary> = {
  pl: {
    stage: 'Fundament projektu',
    placeholder: 'Aplikacja jest w budowie. Mapa i wyszukiwanie toalet jeszcze nie działają.',
    languageSwitchLabel: 'Zmień język',
    metaTitle: 'GdzieKibel.pl',
    metaDescription: 'GdzieKibel.pl — publiczne toalety w Warszawie. Wersja fundamentowa.',
  },
  en: {
    stage: 'Project foundation',
    placeholder: 'This app is still being built. The map and toilet search do not work yet.',
    languageSwitchLabel: 'Change language',
    metaTitle: 'GdzieKibel.pl',
    metaDescription: 'GdzieKibel.pl — public toilets in Warsaw. Foundation build.',
  },
};

export function getDictionary(locale: Locale): Dictionary {
  return DICTIONARIES[locale];
}

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
  /** Accessible name for the language switch. */
  languageSwitchLabel: string;
  /** Accessible name for the map region, read by screen readers. */
  mapAccessibleLabel: string;
  /**
   * Fallback state shown when the tile provider key is absent or the map
   * fails to initialise. `BRAND.md`'s "API/network error" copy, two layers:
   * a punchline and a literal explanation naming the map specifically.
   */
  mapUnavailablePunchline: string;
  mapUnavailableExplanation: string;
  mapUnavailableRetry: string;
  /** Page title and description. */
  metaTitle: string;
  metaDescription: string;
}

export const DICTIONARIES: Record<Locale, Dictionary> = {
  pl: {
    stage: 'Fundament projektu',
    languageSwitchLabel: 'Zmień język',
    mapAccessibleLabel: 'Interaktywna mapa Warszawy',
    mapUnavailablePunchline: 'COŚ SIĘ WYSRAŁO.',
    mapUnavailableExplanation: 'Nie udało się załadować mapy.',
    mapUnavailableRetry: 'SPRÓBUJ JESZCZE RAZ',
    metaTitle: 'GdzieKibel.pl',
    metaDescription: 'GdzieKibel.pl — publiczne toalety w Warszawie. Wersja fundamentowa.',
  },
  en: {
    stage: 'Project foundation',
    languageSwitchLabel: 'Change language',
    mapAccessibleLabel: 'Interactive map of Warsaw',
    mapUnavailablePunchline: 'Something went wrong.',
    mapUnavailableExplanation: 'The map could not load.',
    mapUnavailableRetry: 'TRY AGAIN',
    metaTitle: 'GdzieKibel.pl',
    metaDescription: 'GdzieKibel.pl — public toilets in Warsaw. Foundation build.',
  },
};

export function getDictionary(locale: Locale): Dictionary {
  return DICTIONARIES[locale];
}

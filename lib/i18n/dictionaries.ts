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
  /**
   * The permission-ask screen, shown once the map has loaded, before the
   * browser's own permission prompt. `BRAND.md`'s "Location permission"
   * copy. `locationAskPrivacyHint` is that section's second body option,
   * used as the distinct privacy hint `DESIGN.md` section 9.2 asks for.
   */
  locationAskHeadline: string;
  locationAskBody: string;
  locationAskPrivacyHint: string;
  locationAskAllow: string;
  locationAskSkip: string;
  /**
   * One shared screen for every outcome that is not a grant: denied by the
   * user, unavailable on this device, or timed out. `BRAND.md`'s
   * "Location denied" copy and `DESIGN.md` section 9.9.
   */
  locationDeniedHeadline: string;
  locationDeniedBody: string;
  locationDeniedRetry: string;
  locationDeniedOpenMap: string;
  /** Accessible label for the user's own position marker on the map. */
  userLocationLabel: string;
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
    locationAskHeadline: 'POZWÓL NAM ZNALEŹĆ KIBEL.',
    locationAskBody: 'Bez lokalizacji pokażemy Ci Warszawę. Z lokalizacją pokażemy Ci kibel.',
    locationAskPrivacyHint:
      'Używamy lokalizacji tylko po to, żeby znaleźć coś blisko. Nie zapisujemy jej w bazie.',
    locationAskAllow: 'UDOSTĘPNIJ LOKALIZACJĘ',
    locationAskSkip: 'NIE TERAZ',
    locationDeniedHeadline: 'NIE WIEMY, GDZIE JESTEŚ.',
    locationDeniedBody: 'Bez lokalizacji możemy pokazać tylko ogólną mapę Warszawy.',
    locationDeniedRetry: 'SPRÓBUJ PONOWNIE',
    locationDeniedOpenMap: 'OTWÓRZ MAPĘ WARSZAWY',
    userLocationLabel: 'Twoja lokalizacja',
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
    locationAskHeadline: 'Let us find you a toilet.',
    locationAskBody:
      'Without location we can show you Warsaw. With location we can show you a toilet.',
    locationAskPrivacyHint: "We only use your location to find something nearby. We don't save it.",
    locationAskAllow: 'SHARE LOCATION',
    locationAskSkip: 'NOT NOW',
    locationDeniedHeadline: "We don't know where you are.",
    locationDeniedBody: 'Without location we can only show a general map of Warsaw.',
    locationDeniedRetry: 'TRY AGAIN',
    locationDeniedOpenMap: 'OPEN THE WARSAW MAP',
    userLocationLabel: 'Your location',
    metaTitle: 'GdzieKibel.pl',
    metaDescription: 'GdzieKibel.pl — public toilets in Warsaw. Foundation build.',
  },
};

export function getDictionary(locale: Locale): Dictionary {
  return DICTIONARIES[locale];
}

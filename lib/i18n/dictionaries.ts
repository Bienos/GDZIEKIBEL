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
  /**
   * The collapsed "nearest sensible toilet" preview (TASK-010).
   * `DESIGN.md` section 9.3's label and example distance/time formatting;
   * `BRAND.md`'s "Open / closed / uncertain" and "Free / paid" copy for the
   * two badges.
   */
  previewLabel: string;
  previewDistanceUnit: string;
  previewWalkingUnit: string;
  previewStatusUnknown: string;
  previewPriceFree: string;
  previewPricePaid: string;
  previewPriceUnknown: string;
  /** Accessible label prefix for the preview's tap-to-expand affordance. */
  previewOpenDetailsLabel: string;
  /**
   * The toilet detail sheet (TASK-011). `DESIGN.md` section 9.4's
   * information order: name, distance/ETA and status/price reuse the
   * preview's own copy; these are the feature and confidence labels it
   * adds, plus the close control's accessible name.
   */
  detailClose: string;
  detailFeatureWheelchair: string;
  detailFeatureChangingTable: string;
  detailFeatureUnisex: string;
  detailFeatureYes: string;
  detailFeatureNo: string;
  detailFeatureLimited: string;
  detailFeatureUnknown: string;
  detailConfidenceHigh: string;
  detailConfidenceMedium: string;
  detailConfidenceLow: string;
  /**
   * The detail sheet's primary CTA (TASK-012): `BRAND.md`'s recommended
   * production navigation copy and `DESIGN.md` section 9.4's own example
   * supporting punchline.
   */
  detailNavigateCta: string;
  detailNavigatePunchline: string;
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
    previewLabel: 'NAJBLIŻSZY SENSOWNY KIBEL',
    previewDistanceUnit: 'M',
    previewWalkingUnit: 'MIN PIESZO',
    previewStatusUnknown: 'STATUS NIEPEWNY',
    previewPriceFree: 'ZA DARMO',
    previewPricePaid: 'PŁATNY',
    previewPriceUnknown: 'CENA NIEZNANA',
    previewOpenDetailsLabel: 'Otwórz szczegóły toalety',
    detailClose: 'ZAMKNIJ',
    detailFeatureWheelchair: 'DOSTĘP DLA WÓZKÓW',
    detailFeatureChangingTable: 'PRZEWIJAK',
    detailFeatureUnisex: 'TOALETA UNISEX',
    detailFeatureYes: 'TAK',
    detailFeatureNo: 'NIE',
    detailFeatureLimited: 'OGRANICZONE',
    detailFeatureUnknown: 'NIEZNANE',
    detailConfidenceHigh: 'PEWNOŚĆ DANYCH: WYSOKA',
    detailConfidenceMedium: 'PEWNOŚĆ DANYCH: ŚREDNIA',
    detailConfidenceLow: 'PEWNOŚĆ DANYCH: NISKA',
    detailNavigateCta: 'PROWADŹ MNIE',
    detailNavigatePunchline: 'ZANIM BĘDZIE ZA PÓŹNO.',
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
    previewLabel: 'THE NEAREST TOILET WORTH USING',
    previewDistanceUnit: 'm',
    previewWalkingUnit: 'min walk',
    previewStatusUnknown: 'STATUS UNKNOWN',
    previewPriceFree: 'FREE',
    previewPricePaid: 'PAID',
    previewPriceUnknown: 'PRICE UNKNOWN',
    previewOpenDetailsLabel: 'Open toilet details',
    detailClose: 'CLOSE',
    detailFeatureWheelchair: 'WHEELCHAIR ACCESS',
    detailFeatureChangingTable: 'BABY CHANGING',
    detailFeatureUnisex: 'UNISEX TOILET',
    detailFeatureYes: 'YES',
    detailFeatureNo: 'NO',
    detailFeatureLimited: 'LIMITED',
    detailFeatureUnknown: 'UNKNOWN',
    detailConfidenceHigh: 'DATA CONFIDENCE: HIGH',
    detailConfidenceMedium: 'DATA CONFIDENCE: MEDIUM',
    detailConfidenceLow: 'DATA CONFIDENCE: LOW',
    detailNavigateCta: 'TAKE ME THERE',
    detailNavigatePunchline: "BEFORE IT'S TOO LATE.",
    metaTitle: 'GdzieKibel.pl',
    metaDescription: 'GdzieKibel.pl — public toilets in Warsaw. Foundation build.',
  },
};

export function getDictionary(locale: Locale): Dictionary {
  return DICTIONARIES[locale];
}

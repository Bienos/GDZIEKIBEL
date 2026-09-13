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
   * The map/list toggle (TASK-015, DESIGN.md 9.5/14): plain text button
   * labels, and the list's own accessible landmark name.
   */
  viewToggleToList: string;
  viewToggleToMap: string;
  listAccessibleLabel: string;
  /**
   * The filter sheet (TASK-016, DESIGN.md 9.6): the button that opens it,
   * its own heading, the four section titles, the five toggle labels (two
   * reuse existing feature-name copy), and its two CTAs. No live result
   * count — see `tasks/016-core-filters.md` for why.
   */
  filtersToggleLabel: string;
  filtersSectionStatus: string;
  filtersSectionPrice: string;
  filtersSectionAccessibility: string;
  filtersSectionAmenities: string;
  filterOpenNow: string;
  filterFree: string;
  filterOpen24h: string;
  filtersApply: string;
  filtersClear: string;
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
  /**
   * A real grant from outside `WARSAW_BBOX` (TASK-018,
   * `docs/adr/0013-outside-warsaw-behaviour.md`): distinct from
   * `locationDenied*` above because the app does know where the user is,
   * just not somewhere it covers. One action only, reusing
   * `locationDeniedOpenMap` above — no retry, since being outside Warsaw
   * will not change on a second attempt.
   */
  outsideWarsawHeadline: string;
  outsideWarsawBody: string;
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
  previewStatusOpen: string;
  previewStatusClosed: string;
  previewStatusLikelyOpen: string;
  previewStatusLikelyClosed: string;
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
  /** The three payment facts TASK-014 normalises (ADR 0010), sharing the
   * same yes/no/limited/unknown value labels above. */
  detailPaymentCash: string;
  detailPaymentCards: string;
  detailPaymentCoins: string;
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
  /**
   * The detail sheet's report control (TASK-020, position 8 of `DESIGN.md`
   * section 9.4), and the sheet it opens: a headline distinct from the
   * button (the ask/denied screens' own pattern), the seven `BRAND.md`
   * "Reporting" reasons in their documented order, the optional note
   * field, submit, and success/failure states. Failure reuses no existing
   * key: retrying a report is a different action from retrying location or
   * the map, even where the Polish text happens to coincide.
   */
  reportControlLabel: string;
  reportHeadline: string;
  reportReasonClosed: string;
  reportReasonDoesNotExist: string;
  reportReasonWrongHours: string;
  reportReasonWrongPrice: string;
  reportReasonAccessDenied: string;
  reportReasonWrongAccessibility: string;
  reportReasonOther: string;
  reportNoteLabel: string;
  reportSubmit: string;
  reportSuccess: string;
  reportFailure: string;
  reportRetry: string;
  /**
   * The no-results overlay (TASK-017, `docs/adr/0012-no-results-diagnosis.md`).
   * One shared headline; the body and action are picked from three states —
   * a filter is active (its action reuses `filtersClear` above, no new key),
   * the radius can still expand, or the radius is already at its maximum.
   * `DESIGN.md` section 9.8 and `BRAND.md`'s "No results" copy.
   */
  noResultsHeadline: string;
  noResultsFilteredBody: string;
  noResultsRadiusBody: string;
  noResultsRadiusAction: string;
  noResultsExhaustedBody: string;
  noResultsExhaustedAction: string;
  /** Page title and description. */
  metaTitle: string;
  metaDescription: string;
}

export const DICTIONARIES: Record<Locale, Dictionary> = {
  pl: {
    stage: 'Fundament projektu',
    languageSwitchLabel: 'Zmień język',
    mapAccessibleLabel: 'Interaktywna mapa Warszawy',
    viewToggleToList: 'LISTA',
    viewToggleToMap: 'MAPA',
    listAccessibleLabel: 'Lista toalet w pobliżu',
    filtersToggleLabel: 'FILTRY',
    filtersSectionStatus: 'STATUS',
    filtersSectionPrice: 'CENA',
    filtersSectionAccessibility: 'DOSTĘPNOŚĆ',
    filtersSectionAmenities: 'UDOGODNIENIA',
    filterOpenNow: 'OTWARTE TERAZ',
    filterFree: 'DARMOWE',
    filterOpen24h: 'CZYNNE CAŁĄ DOBĘ',
    filtersApply: 'POKAŻ WYNIKI',
    filtersClear: 'WYCZYŚĆ',
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
    outsideWarsawHeadline: 'JESTEŚ POZA WARSZAWĄ.',
    outsideWarsawBody: 'Szukamy kibli tylko w Warszawie — nie mamy nic w Twojej okolicy.',
    userLocationLabel: 'Twoja lokalizacja',
    previewLabel: 'NAJBLIŻSZY SENSOWNY KIBEL',
    previewDistanceUnit: 'M',
    previewWalkingUnit: 'MIN PIESZO',
    previewStatusOpen: 'OTWARTY',
    previewStatusClosed: 'ZAMKNIĘTY',
    previewStatusLikelyOpen: 'RACZEJ OTWARTY',
    previewStatusLikelyClosed: 'RACZEJ ZAMKNIĘTY',
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
    detailPaymentCash: 'GOTÓWKA',
    detailPaymentCards: 'KARTA',
    detailPaymentCoins: 'MONETY',
    detailConfidenceHigh: 'PEWNOŚĆ DANYCH: WYSOKA',
    detailConfidenceMedium: 'PEWNOŚĆ DANYCH: ŚREDNIA',
    detailConfidenceLow: 'PEWNOŚĆ DANYCH: NISKA',
    detailNavigateCta: 'PROWADŹ MNIE',
    detailNavigatePunchline: 'ZANIM BĘDZIE ZA PÓŹNO.',
    reportControlLabel: 'ZGŁOŚ PROBLEM',
    reportHeadline: 'CO JEST NIE TAK?',
    reportReasonClosed: 'Jest zamknięty',
    reportReasonDoesNotExist: 'Nie istnieje',
    reportReasonWrongHours: 'Godziny są złe',
    reportReasonWrongPrice: 'Cena jest inna',
    reportReasonAccessDenied: 'Nie wpuszczają bez zakupu',
    reportReasonWrongAccessibility: 'Dostępność jest błędna',
    reportReasonOther: 'Inny problem',
    reportNoteLabel: 'Szczegóły (opcjonalnie)',
    reportSubmit: 'WYŚLIJ ZGŁOSZENIE',
    reportSuccess: 'DZIĘKI. SPRAWDZIMY.',
    reportFailure: 'Nie udało się wysłać zgłoszenia.',
    reportRetry: 'SPRÓBUJ PONOWNIE',
    noResultsHeadline: 'NIC BLISKO.',
    noResultsFilteredBody: 'Żaden kibel nie spełnia wybranych filtrów.',
    noResultsRadiusBody: 'W tym promieniu nie mamy nic sensownego.',
    noResultsRadiusAction: 'SZUKAJ DALEJ',
    noResultsExhaustedBody: 'Nic nie znaleźliśmy nawet w najszerszym promieniu wyszukiwania.',
    noResultsExhaustedAction: 'ROZUMIEM',
    metaTitle: 'GdzieKibel.pl',
    metaDescription: 'GdzieKibel.pl — publiczne toalety w Warszawie. Wersja fundamentowa.',
  },
  en: {
    stage: 'Project foundation',
    languageSwitchLabel: 'Change language',
    mapAccessibleLabel: 'Interactive map of Warsaw',
    viewToggleToList: 'LIST',
    viewToggleToMap: 'MAP',
    listAccessibleLabel: 'List of nearby toilets',
    filtersToggleLabel: 'FILTERS',
    filtersSectionStatus: 'AVAILABILITY',
    filtersSectionPrice: 'PRICE',
    filtersSectionAccessibility: 'ACCESSIBILITY',
    filtersSectionAmenities: 'AMENITIES',
    filterOpenNow: 'OPEN NOW',
    filterFree: 'FREE',
    filterOpen24h: 'OPEN 24 HOURS',
    filtersApply: 'SHOW RESULTS',
    filtersClear: 'CLEAR',
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
    outsideWarsawHeadline: "YOU'RE OUTSIDE WARSAW.",
    outsideWarsawBody: 'We only look for toilets in Warsaw — we have nothing near you.',
    userLocationLabel: 'Your location',
    previewLabel: 'THE NEAREST TOILET WORTH USING',
    previewDistanceUnit: 'm',
    previewWalkingUnit: 'min walk',
    previewStatusOpen: 'OPEN NOW',
    previewStatusClosed: 'CLOSED',
    previewStatusLikelyOpen: 'LIKELY OPEN',
    previewStatusLikelyClosed: 'LIKELY CLOSED',
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
    detailPaymentCash: 'CASH',
    detailPaymentCards: 'CARD',
    detailPaymentCoins: 'COINS',
    detailConfidenceHigh: 'DATA CONFIDENCE: HIGH',
    detailConfidenceMedium: 'DATA CONFIDENCE: MEDIUM',
    detailConfidenceLow: 'DATA CONFIDENCE: LOW',
    detailNavigateCta: 'TAKE ME THERE',
    detailNavigatePunchline: "BEFORE IT'S TOO LATE.",
    reportControlLabel: 'REPORT AN ISSUE',
    reportHeadline: "WHAT'S WRONG?",
    reportReasonClosed: "It's closed",
    reportReasonDoesNotExist: "It doesn't exist",
    reportReasonWrongHours: 'Hours are wrong',
    reportReasonWrongPrice: 'Price is wrong',
    reportReasonAccessDenied: "Won't let you in without buying something",
    reportReasonWrongAccessibility: 'Accessibility info is wrong',
    reportReasonOther: 'Something else',
    reportNoteLabel: 'Details (optional)',
    reportSubmit: 'SEND REPORT',
    reportSuccess: "THANKS. WE'LL CHECK.",
    reportFailure: "Couldn't send the report.",
    reportRetry: 'TRY AGAIN',
    noResultsHeadline: 'NOTHING NEARBY.',
    noResultsFilteredBody: 'No toilet matches your filters.',
    noResultsRadiusBody: 'Nothing decent within this radius yet.',
    noResultsRadiusAction: 'SEARCH FARTHER',
    noResultsExhaustedBody: 'Nothing here, even at our widest search radius.',
    noResultsExhaustedAction: 'GOT IT',
    metaTitle: 'GdzieKibel.pl',
    metaDescription: 'GdzieKibel.pl — public toilets in Warsaw. Foundation build.',
  },
};

export function getDictionary(locale: Locale): Dictionary {
  return DICTIONARIES[locale];
}

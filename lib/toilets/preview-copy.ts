import type { Dictionary } from '@/lib/i18n/dictionaries';
import type { NearbyToiletResult } from './nearby-response';
import type { PriceState } from './types';

/**
 * Pure copy-mapping for the nearest-toilet preview (TASK-010). Kept apart
 * from `NearestToiletPreview.tsx` so the mapping rules are unit-testable
 * without React or the DOM.
 */

/**
 * `openingStatus` is computed by `computeOpeningStatus` (TASK-013,
 * `docs/adr/0009-opening-hours-status.md`). `BRAND.md`'s "Open / closed /
 * uncertain" copy library, one literal variant per state.
 */
export function openingStatusLabel(
  openingStatus: NearbyToiletResult['openingStatus'],
  dictionary: Dictionary,
): string {
  switch (openingStatus) {
    case 'OPEN':
      return dictionary.previewStatusOpen;
    case 'CLOSED':
      return dictionary.previewStatusClosed;
    case 'LIKELY_OPEN':
      return dictionary.previewStatusLikelyOpen;
    case 'LIKELY_CLOSED':
      return dictionary.previewStatusLikelyClosed;
    case 'UNKNOWN':
      return dictionary.previewStatusUnknown;
  }
}

/**
 * Which status-colour token (`DESIGN.md` section 8: green/red/orange, never
 * colour alone) a status badge should use. `LIKELY_*` and `UNKNOWN` share
 * the uncertain colour: both mean "not confidently one or the other,"
 * which is exactly what that colour already signals for markers.
 */
export function openingStatusVariant(
  openingStatus: NearbyToiletResult['openingStatus'],
): 'open' | 'closed' | 'uncertain' {
  switch (openingStatus) {
    case 'OPEN':
      return 'open';
    case 'CLOSED':
      return 'closed';
    case 'LIKELY_OPEN':
    case 'LIKELY_CLOSED':
    case 'UNKNOWN':
      return 'uncertain';
  }
}

/** Unlike opening status, `price_state` already varies in ingested data. */
export function priceLabel(priceState: PriceState, dictionary: Dictionary): string {
  switch (priceState) {
    case 'free':
      return dictionary.previewPriceFree;
    case 'paid':
      return dictionary.previewPricePaid;
    case 'unknown':
      return dictionary.previewPriceUnknown;
  }
}

/**
 * `240 M · ~3 MIN PIESZO` (DESIGN.md 9.4's own example format). Distance is
 * rounded for display; `approxWalkingMinutes` is already an integer
 * (`lib/toilets/walking-time.ts`).
 */
export function distanceLine(
  distanceMeters: number,
  approxWalkingMinutes: number,
  dictionary: Dictionary,
): string {
  return `${Math.round(distanceMeters)} ${dictionary.previewDistanceUnit} · ~${approxWalkingMinutes} ${dictionary.previewWalkingUnit}`;
}

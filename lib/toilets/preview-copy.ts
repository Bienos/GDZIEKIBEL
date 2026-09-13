import type { Dictionary } from '@/lib/i18n/dictionaries';
import type { NearbyToiletResult } from './nearby-response';
import type { PriceState } from './types';

/**
 * Pure copy-mapping for the nearest-toilet preview (TASK-010). Kept apart
 * from `NearestToiletPreview.tsx` so the mapping rules are unit-testable
 * without React or the DOM.
 */

/**
 * `openingStatus` is currently the literal type `'UNKNOWN'`
 * (`lib/toilets/nearby-response.ts`, ADR 0006): nothing computes a real
 * value until TASK-013. A `switch` here, rather than a single hard-coded
 * string, is the structure TASK-013 extends when it adds real states.
 */
export function openingStatusLabel(
  openingStatus: NearbyToiletResult['openingStatus'],
  dictionary: Dictionary,
): string {
  switch (openingStatus) {
    case 'UNKNOWN':
      return dictionary.previewStatusUnknown;
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

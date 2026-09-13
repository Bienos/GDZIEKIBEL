import type { NearbyToiletResult } from './nearby-response';

/**
 * Accessible name for a toilet marker: "<name>, <distance> m". Not sourced
 * from `BRAND.md`, since it is read by assistive technology only, never
 * shown visually, and BRAND.md's copy library covers visible UI text. The
 * metre abbreviation is identical in Polish and English, so this needs no
 * per-locale translation the way visible copy does.
 */
export function buildMarkerLabel(
  toilet: Pick<NearbyToiletResult, 'name' | 'distanceMeters'>,
): string {
  return `${toilet.name}, ${Math.round(toilet.distanceMeters)} m`;
}

import { computeConfidenceLevel } from './compute-confidence';
import { computeOpeningStatus } from '../opening-hours/compute-status';
import type { NearbyToiletRow } from './nearby-response';
import type { FeatureState, PriceState } from './types';

/**
 * The five MVP filters (`PRODUCT.md` section 6.3). Every key is optional;
 * an omitted or `false` key applies no restriction on that dimension.
 */
export interface NearbyFilters {
  openNow?: boolean;
  free?: boolean;
  wheelchairAccessible?: boolean;
  babyChanging?: boolean;
  open24h?: boolean;
}

/** The minimal shape `matchesFilters` needs from either a DB row or an API result. */
export interface FilterableToilet {
  priceState: PriceState;
  wheelchair: FeatureState;
  changingTable: FeatureState;
  open24h: boolean | null;
  openNow: boolean;
}

/**
 * `docs/adr/0011-filter-semantics.md`: a filter only keeps a toilet whose
 * relevant fact is positively confirmed to satisfy it. `'unknown'` never
 * matches; `'limited'` never satisfies the two `FeatureState` filters
 * either — the filter promises confident accessibility, not a partial or
 * uncertain one.
 */
export function matchesFilters(toilet: FilterableToilet, filters: NearbyFilters): boolean {
  if (filters.free && toilet.priceState !== 'free') return false;
  if (filters.wheelchairAccessible && toilet.wheelchair !== 'yes') return false;
  if (filters.babyChanging && toilet.changingTable !== 'yes') return false;
  if (filters.open24h && toilet.open24h !== true) return false;
  if (filters.openNow && !toilet.openNow) return false;
  return true;
}

/**
 * Server-side filtering (TASK-016): applied to the same nearest-30
 * candidates `db/queries/nearby.ts` already returns, before ranking
 * (ADR 0007), so ranking always runs against the actual filtered set.
 * `openNow` cannot be evaluated in SQL — it depends on `now` and the
 * bounded-grammar opening-hours evaluation — so every filter is applied
 * here, uniformly, in one pass.
 */
export function filterNearbyToilets(
  rows: NearbyToiletRow[],
  filters: NearbyFilters,
  now: Date,
): NearbyToiletRow[] {
  return rows.filter((row) => {
    const confidenceLevel = computeConfidenceLevel(
      { verifiedAt: row.verifiedAt, accessRaw: row.accessRaw },
      now,
    );
    const status = computeOpeningStatus(
      { open24h: row.open24h, openingHoursNormalized: row.openingHoursNormalized },
      confidenceLevel,
      now,
    );
    return matchesFilters(
      {
        priceState: row.priceState,
        wheelchair: row.wheelchair,
        changingTable: row.changingTable,
        open24h: row.open24h,
        openNow: status === 'OPEN' || status === 'LIKELY_OPEN',
      },
      filters,
    );
  });
}

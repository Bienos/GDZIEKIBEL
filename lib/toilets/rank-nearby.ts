import type { AccessType } from './types';

/**
 * How much less confident each `access_type` is that a member of the public
 * can simply walk in and use the toilet right now, expressed as an
 * equivalent distance penalty in metres rather than an abstract score. See
 * `docs/adr/0007-recommendation-ranking-formula.md` for the reasoning behind
 * each value.
 *
 * Typed as `Record<AccessType, number>` so adding a new access type to
 * `lib/toilets/types.ts` without adding it here is a TypeScript error, not a
 * silent fallback.
 */
export const ACCESS_CONFIDENCE_PENALTY_METERS: Record<AccessType, number> = {
  public_unconditional: 0,
  public_paid: 0,
  unknown: 150,
  customers_only: 300,
  purchase_required: 300,
  ask_staff: 300,
  key_required: 400,
  code_required: 400,
  ticket_required: 400,
  not_public: 1000,
};

export interface RankableToilet {
  distanceMeters: number;
  accessType: AccessType;
}

/**
 * `distanceMeters + ACCESS_CONFIDENCE_PENALTY_METERS[accessType]`. The only
 * two real, differentiating PRODUCT.md section 11 signals today; see
 * `tasks/009-recommendation-ranking.md` for why the other four are inert.
 */
export function rankingScore(toilet: RankableToilet): number {
  return toilet.distanceMeters + ACCESS_CONFIDENCE_PENALTY_METERS[toilet.accessType];
}

/**
 * Reorders toilets by `rankingScore` ascending (lowest first), breaking ties
 * on real `distanceMeters` so that between two equally-scored options the
 * physically nearer one sorts first. Never removes an item: `not_public`
 * sorts last in almost every realistic radius, per ADR 0007, but is never
 * excluded, per PRODUCT.md section 11's "still allow the user to see nearby
 * alternatives."
 *
 * Pure and database-free: consumed by the API route after
 * `db/queries/nearby.ts` returns its own plain-distance-ordered rows, which
 * this function re-sorts rather than relies on.
 */
export function rankNearbyToilets<T extends RankableToilet>(toilets: readonly T[]): T[] {
  return [...toilets].sort((a, b) => {
    const scoreDifference = rankingScore(a) - rankingScore(b);
    if (scoreDifference !== 0) return scoreDifference;
    return a.distanceMeters - b.distanceMeters;
  });
}

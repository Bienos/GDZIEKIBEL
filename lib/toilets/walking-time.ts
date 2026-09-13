/**
 * Approximate walking time from a straight-line distance.
 *
 * `PRODUCT.md` section 12 requires the estimate be labelled approximate and
 * derived conservatively from distance, without fixing a formula. See
 * `docs/adr/0006-nearby-api-contract.md` for why this specific constant was
 * chosen. This is a placeholder for real routing, not a claim about actual
 * streets, crossings, or elevation.
 */

/** A deliberately unhurried pace, in metres per minute (4.5 km/h). */
export const CONSERVATIVE_WALKING_METERS_PER_MINUTE = 75;

/**
 * Rounds up, never down, so the app never promises a shorter walk than it
 * delivers. A distance of exactly 0 still returns 1: "you are there" is a
 * distinct, later product decision this function does not make.
 */
export function approxWalkingMinutes(distanceMeters: number): number {
  return Math.max(1, Math.ceil(distanceMeters / CONSERVATIVE_WALKING_METERS_PER_MINUTE));
}

/**
 * User-facing opening-status states (`PRODUCT.md` section 10). Widened from
 * the literal `'UNKNOWN'` the nearby API returned before `TASK-013`
 * computed a real value (`docs/adr/0006-nearby-api-contract.md`).
 */
export const OPENING_STATUSES = [
  'OPEN',
  'CLOSED',
  'LIKELY_OPEN',
  'LIKELY_CLOSED',
  'UNKNOWN',
] as const;
export type OpeningStatus = (typeof OPENING_STATUSES)[number];

/**
 * One weekly recurrence rule parsed from an `opening_hours` string
 * (`lib/opening-hours/parse-opening-hours.ts`). `docs/adr/0009-opening-hours-status.md`
 * records the bounded grammar this represents.
 */
export interface OpeningHoursRule {
  /** 0 = Monday ... 6 = Sunday, matching OSM's Mo..Su week order. */
  days: number[];
  /** `true` for an explicit "off"/"closed" rule; `ranges` is empty when true. */
  closed: boolean;
  /**
   * Minutes since local midnight. `end` may exceed 1440 for a range that
   * crosses midnight (`22:00-02:00` is stored as `start: 1320, end: 1560`).
   */
  ranges: { start: number; end: number }[];
}

/** The stored shape of `toilets.opening_hours_normalized`. */
export interface NormalizedOpeningHours {
  rules: OpeningHoursRule[];
}

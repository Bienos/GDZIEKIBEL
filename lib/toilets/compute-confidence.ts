import type { ConfidenceLevel } from './types';

/**
 * Computes `confidence_level` from raw stored facts (TASK-019,
 * `docs/adr/0014-computed-confidence-level.md`), the same shape of decision
 * already made for `openingStatus` (`docs/adr/0009-opening-hours-status.md`):
 * nothing is trusted from a stale precomputed column, everything is derived
 * fresh against an explicit `now`.
 */

/**
 * A source's own re-verification is treated as stale after this many days —
 * OSM's own community convention for when unverified data should be
 * questioned. A first, defensible pass, not calibrated against real usage
 * (see the ADR's "Not decided here").
 */
export const VERIFICATION_FRESHNESS_DAYS = 365;

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Raw access values the contract already keeps distinct from a genuinely
 * public one. `permissive` means the owner tolerates public use, not that
 * they guarantee it (`lib/ingest/osm/normalize.ts`'s `accessType` mapping) —
 * a weaker basis than `access=yes`/`public`, independent of how recently
 * anyone verified it.
 */
const UNCERTAIN_ACCESS_RAW_VALUES = new Set(['permissive']);

export interface ConfidenceInput {
  verifiedAt: Date | null;
  accessRaw: string | null;
}

/**
 * Never returns `'high'`: `PRODUCT.md` section 9 also allows that level for
 * "strong cross-source agreement", which needs a second source (`TASK-022`)
 * this project does not have yet. A single source, however recently
 * verified, is still LOW's own description — "single ... not yet
 * corroborated" — until then.
 *
 * `now` is explicit, never read internally, so a verification's freshness is
 * judged against the same moment as the rest of one API response, and so
 * this stays testable against fixed instants.
 */
export function computeConfidenceLevel(input: ConfidenceInput, now: Date): ConfidenceLevel {
  if (input.accessRaw !== null && UNCERTAIN_ACCESS_RAW_VALUES.has(input.accessRaw)) {
    return 'low';
  }

  if (input.verifiedAt === null) return 'low';

  const ageDays = (now.getTime() - input.verifiedAt.getTime()) / MILLISECONDS_PER_DAY;
  // A future verification date is not trustworthy evidence, not "extra fresh".
  if (ageDays < 0 || ageDays > VERIFICATION_FRESHNESS_DAYS) return 'low';

  return 'medium';
}

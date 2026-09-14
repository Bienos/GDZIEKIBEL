import { NextResponse } from 'next/server';
import { insertAnalyticsEvent } from '@/db/queries/analytics';
import { getPool } from '@/db/client';
import { findNearbyToilets } from '@/db/queries/nearby';
import { logRuntimeError } from '@/lib/observability/log-runtime-error';
import { filterNearbyToilets } from '@/lib/toilets/filter-nearby';
import { parseNearbyRequest } from '@/lib/toilets/nearby-request';
import { toNearbyResult } from '@/lib/toilets/nearby-response';
import { rankNearbyToilets } from '@/lib/toilets/rank-nearby';

/**
 * `POST /api/toilets/nearby` — bounded nearby active toilets, filtered
 * (TASK-016: `docs/adr/0011-filter-semantics.md`) and reordered by
 * `rankNearbyToilets` (TASK-009: distance + access-type confidence; see
 * `docs/adr/0007-recommendation-ranking-formula.md`). See
 * `docs/adr/0006-nearby-api-contract.md`.
 *
 * `findNearbyToilets` itself still returns plain distance order over every
 * active candidate within the radius, capped; filtering and ranking are
 * layered on afterward here, so the query's own contract (active-only,
 * radius-bounded, capped, nearest-first) stays independently true and
 * independently testable. A filtered response can be smaller than an
 * unfiltered one even when more matching toilets exist farther away —
 * expanding the radius to compensate is `TASK-017`'s job, not this route's.
 *
 * `openingStatus` (and the `openNow` filter) are computed here, once per
 * request (`now`), so every result in the same response reflects one
 * consistent evaluated moment (TASK-013, `docs/adr/0009-opening-hours-status.md`).
 *
 * Never logs the request body or the parsed coordinates, on either the
 * success or the failure path, per `ARCHITECTURE.md` section 8.
 *
 * Also logs `results_loaded`/`no_results` and, when any filter is active,
 * `filter_applied` (TASK-023: `docs/adr/0018-first-party-analytics.md`) —
 * this route already computes the ranked count and already receives
 * `filters`, so no separate client round trip is needed for either event.
 *
 * An unexpected failure past this point (TASK-024,
 * `docs/adr/0019-runtime-error-logging.md`) is caught, logged with no
 * request body or coordinate in scope, and answered with one generic
 * `500` — never the framework default.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 });
  }

  const validation = parseNearbyRequest(body);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.message }, { status: 400 });
  }

  try {
    const now = new Date();
    const rows = await findNearbyToilets(getPool(), validation.params);
    const filtered = filterNearbyToilets(rows, validation.params.filters, now);
    const ranked = rankNearbyToilets(filtered);

    const pool = getPool();
    await insertAnalyticsEvent(pool, ranked.length > 0 ? 'results_loaded' : 'no_results');
    if (Object.keys(validation.params.filters).length > 0) {
      await insertAnalyticsEvent(pool, 'filter_applied');
    }

    return NextResponse.json({ results: ranked.map((row) => toNearbyResult(row, now)) });
  } catch (error) {
    logRuntimeError('POST /api/toilets/nearby', error);
    return NextResponse.json({ error: 'Unexpected server error.' }, { status: 500 });
  }
}

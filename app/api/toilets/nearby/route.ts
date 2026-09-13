import { NextResponse } from 'next/server';
import { getPool } from '@/db/client';
import { findNearbyToilets } from '@/db/queries/nearby';
import { parseNearbyRequest } from '@/lib/toilets/nearby-request';
import { toNearbyResult } from '@/lib/toilets/nearby-response';
import { rankNearbyToilets } from '@/lib/toilets/rank-nearby';

/**
 * `POST /api/toilets/nearby` — bounded nearby active toilets, reordered by
 * `rankNearbyToilets` (TASK-009: distance + access-type confidence; see
 * `docs/adr/0007-recommendation-ranking-formula.md`). No filters yet. See
 * `docs/adr/0006-nearby-api-contract.md`.
 *
 * `findNearbyToilets` itself still returns plain distance order; ranking is
 * layered on afterward here rather than inside the query, so the query's own
 * contract (active-only, radius-bounded, capped, nearest-first) stays
 * independently true and independently testable.
 *
 * `openingStatus` is computed here, once per request (`now`), so every
 * result in the same response reflects one consistent evaluated moment
 * (TASK-013, `docs/adr/0009-opening-hours-status.md`).
 *
 * Never logs the request body or the parsed coordinates, on either the
 * success or the failure path, per `ARCHITECTURE.md` section 8.
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

  const rows = await findNearbyToilets(getPool(), validation.params);
  const ranked = rankNearbyToilets(rows);
  const now = new Date();

  return NextResponse.json({ results: ranked.map((row) => toNearbyResult(row, now)) });
}

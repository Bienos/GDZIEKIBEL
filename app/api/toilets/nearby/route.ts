import { NextResponse } from 'next/server';
import { getPool } from '@/db/client';
import { findNearbyToilets } from '@/db/queries/nearby';
import { parseNearbyRequest } from '@/lib/toilets/nearby-request';
import { toNearbyResult } from '@/lib/toilets/nearby-response';

/**
 * `POST /api/toilets/nearby` — TASK-007 scope only: bounded nearby active
 * toilets, plain distance order. No filters, no ranking, no opening-hours
 * evaluation. See `docs/adr/0006-nearby-api-contract.md`.
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

  return NextResponse.json({ results: rows.map(toNearbyResult) });
}

import { NextResponse } from 'next/server';
import { getPool } from '@/db/client';
import { insertAnalyticsEvent } from '@/db/queries/analytics';
import { parseAnalyticsRequest } from '@/lib/analytics/analytics-request';

/**
 * `POST /api/analytics/events` — the five client-only funnel events
 * (TASK-023: `docs/adr/0018-first-party-analytics.md`). The other four
 * are logged directly from the routes that already see them
 * (`/api/toilets/nearby`, `/api/toilets/:id/reports`).
 *
 * Deliberately not rate-limited (see the ADR's "Not decided here"): a
 * named gap, not a silent one. The stored row is `event_name` and a
 * server-assigned timestamp only — no location, session, or device data.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 });
  }

  const validation = parseAnalyticsRequest(body);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.message }, { status: 400 });
  }

  await insertAnalyticsEvent(getPool(), validation.eventName);

  return NextResponse.json({ ok: true }, { status: 201 });
}

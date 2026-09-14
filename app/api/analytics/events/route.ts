import { NextResponse } from 'next/server';
import { getPool } from '@/db/client';
import { insertAnalyticsEvent } from '@/db/queries/analytics';
import { parseAnalyticsRequest } from '@/lib/analytics/analytics-request';
import { logRuntimeError } from '@/lib/observability/log-runtime-error';

/**
 * `POST /api/analytics/events` — the five client-only funnel events
 * (TASK-023: `docs/adr/0018-first-party-analytics.md`). The other four
 * are logged directly from the routes that already see them
 * (`/api/toilets/nearby`, `/api/toilets/:id/reports`).
 *
 * Deliberately not rate-limited (see the ADR's "Not decided here"): a
 * named gap, not a silent one. The stored row is `event_name` and a
 * server-assigned timestamp only — no location, session, or device data.
 *
 * An unexpected failure (TASK-024, `docs/adr/0019-runtime-error-logging.md`)
 * is caught, logged with no request body in scope, and answered with one
 * generic `500` — never the framework default.
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

  try {
    await insertAnalyticsEvent(getPool(), validation.eventName);
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    logRuntimeError('POST /api/analytics/events', error);
    return NextResponse.json({ error: 'Unexpected server error.' }, { status: 500 });
  }
}

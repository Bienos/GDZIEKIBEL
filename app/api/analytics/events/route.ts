import { NextResponse } from 'next/server';
import { getPool } from '@/db/client';
import { checkAndIncrementAnalyticsRateLimit } from '@/db/queries/analytics-rate-limit';
import { insertAnalyticsEvent } from '@/db/queries/analytics';
import { parseAnalyticsRequest } from '@/lib/analytics/analytics-request';
import {
  ANALYTICS_RATE_LIMIT_MAX_REQUESTS_PER_WINDOW,
  extractClientIp,
  hashClientKey,
  rateLimitRetentionCutoff,
  rateLimitWindowStart,
  secondsUntilWindowEnds,
} from '@/lib/analytics/rate-limit';
import { exceedsMaxRequestBodyBytes } from '@/lib/http/content-length';
import { logRuntimeError } from '@/lib/observability/log-runtime-error';

/**
 * `POST /api/analytics/events` — the five client-only funnel events
 * (TASK-023: `docs/adr/0018-first-party-analytics.md`). The other four
 * are logged directly from the routes that already see them
 * (`/api/toilets/nearby`, `/api/toilets/:id/reports`).
 *
 * Rate-limited (TASK-029, `docs/adr/0023-analytics-rate-limiting.md`),
 * closing the gap TASK-023 named and deferred. An oversized body is
 * rejected first (`lib/http/content-length.ts`), then the rate limit is
 * checked before the body is parsed, matching
 * `/api/toilets/[id]/reports`'s existing order. The stored row is still
 * `event_name` and a server-assigned timestamp only — no location,
 * session, or device data.
 *
 * An unexpected failure (TASK-024, `docs/adr/0019-runtime-error-logging.md`)
 * is caught, logged with no request body in scope, and answered with one
 * generic `500` — never the framework default.
 */
export async function POST(request: Request) {
  if (exceedsMaxRequestBodyBytes(request)) {
    return NextResponse.json({ error: 'Request body too large.' }, { status: 413 });
  }

  try {
    const pool = getPool();
    const now = new Date();
    const clientKey = hashClientKey(extractClientIp(request) ?? 'unknown');
    const { count } = await checkAndIncrementAnalyticsRateLimit(pool, {
      clientKey,
      windowStart: rateLimitWindowStart(now),
      retentionCutoff: rateLimitRetentionCutoff(now),
    });
    if (count > ANALYTICS_RATE_LIMIT_MAX_REQUESTS_PER_WINDOW) {
      return NextResponse.json(
        { error: 'Too many events. Try again later.' },
        { status: 429, headers: { 'Retry-After': String(secondsUntilWindowEnds(now)) } },
      );
    }

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

    await insertAnalyticsEvent(pool, validation.eventName);
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    logRuntimeError('POST /api/analytics/events', error);
    return NextResponse.json({ error: 'Unexpected server error.' }, { status: 500 });
  }
}

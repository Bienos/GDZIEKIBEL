import { NextResponse } from 'next/server';
import { insertAnalyticsEvent } from '@/db/queries/analytics';
import { getPool } from '@/db/client';
import { checkAndIncrementRateLimit } from '@/db/queries/report-rate-limit';
import { insertReport, toiletExists } from '@/db/queries/reports';
import { parseReportRequest, parseToiletId } from '@/lib/reports/report-request';
import {
  extractClientIp,
  hashClientKey,
  RATE_LIMIT_MAX_REQUESTS_PER_WINDOW,
  rateLimitRetentionCutoff,
  rateLimitWindowStart,
  secondsUntilWindowEnds,
} from '@/lib/reports/rate-limit';

/**
 * `POST /api/toilets/:id/reports` — a validated, anonymous, rate-limited
 * report against one toilet (TASK-020: `docs/adr/0015-toilet-reports.md`;
 * TASK-021: `docs/adr/0016-report-rate-limiting.md`). `ARCHITECTURE.md`
 * section 6.
 *
 * The rate limit is checked first, before the id or body are even parsed,
 * so a client already over the limit cannot spend the endpoint's other
 * validation work either. Never stores location, an IP, or any device
 * identifier: the rate limiter stores a one-way hash and a count, the
 * report itself carries only `issueType` and an optional `note`.
 *
 * Also logs `report_submitted` (TASK-023:
 * `docs/adr/0018-first-party-analytics.md`) once `insertReport` actually
 * succeeds — this route already knows that instant, so no separate
 * client round trip is needed for the event either.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const pool = getPool();
  const now = new Date();
  const clientKey = hashClientKey(extractClientIp(request) ?? 'unknown');
  const { count } = await checkAndIncrementRateLimit(pool, {
    clientKey,
    windowStart: rateLimitWindowStart(now),
    retentionCutoff: rateLimitRetentionCutoff(now),
  });
  if (count > RATE_LIMIT_MAX_REQUESTS_PER_WINDOW) {
    return NextResponse.json(
      { error: 'Too many reports. Try again later.' },
      { status: 429, headers: { 'Retry-After': String(secondsUntilWindowEnds(now)) } },
    );
  }

  const { id } = await params;
  const idValidation = parseToiletId(id);
  if (!idValidation.ok) {
    return NextResponse.json({ error: idValidation.message }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 });
  }

  const validation = parseReportRequest(body);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.message }, { status: 400 });
  }

  if (!(await toiletExists(pool, idValidation.id))) {
    return NextResponse.json({ error: 'Toilet not found.' }, { status: 404 });
  }

  const report = await insertReport(pool, { toiletId: idValidation.id, ...validation.params });
  await insertAnalyticsEvent(pool, 'report_submitted');

  return NextResponse.json({ ok: true, reportId: report.id }, { status: 201 });
}

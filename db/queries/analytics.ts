import type { Pool, PoolClient } from 'pg';
import type { EventName } from '@/lib/analytics/types';
import { logRuntimeError } from '@/lib/observability/log-runtime-error';

/**
 * The one place that writes `analytics_events` (TASK-023,
 * `docs/adr/0018-first-party-analytics.md`) — every event source, server
 * or client-reported, calls this, so a future provider swap touches one
 * file, not every call site. Thin, like `db/queries/reports.ts`.
 *
 * Never throws: a write failure here must never turn a successful nearby
 * search or report submission into a failed response
 * (`docs/adr/0018-first-party-analytics.md`, "analytics logging never
 * fails the request it is attached to"). The failure is not silent,
 * though: it is logged via `logRuntimeError` (TASK-024,
 * `docs/adr/0019-runtime-error-logging.md`) — only `eventName`, never a
 * request body, was ever in scope here to leak.
 */
export async function insertAnalyticsEvent(
  pool: Pool | PoolClient,
  eventName: EventName,
): Promise<void> {
  try {
    await pool.query('INSERT INTO analytics_events (event_name) VALUES ($1)', [eventName]);
  } catch (error) {
    logRuntimeError('db/queries/analytics.ts:insertAnalyticsEvent', error);
  }
}

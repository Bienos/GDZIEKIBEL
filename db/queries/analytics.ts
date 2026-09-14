import type { Pool, PoolClient } from 'pg';
import type { EventName } from '@/lib/analytics/types';

/**
 * The one place that writes `analytics_events` (TASK-023,
 * `docs/adr/0018-first-party-analytics.md`) — every event source, server
 * or client-reported, calls this, so a future provider swap touches one
 * file, not every call site. Thin, like `db/queries/reports.ts`.
 *
 * Never throws: a write failure here must never turn a successful nearby
 * search or report submission into a failed response
 * (`docs/adr/0018-first-party-analytics.md`, "analytics logging never
 * fails the request it is attached to"). `error tracking` for a failure
 * like this is `TASK-024`'s job, not this function's.
 */
export async function insertAnalyticsEvent(
  pool: Pool | PoolClient,
  eventName: EventName,
): Promise<void> {
  try {
    await pool.query('INSERT INTO analytics_events (event_name) VALUES ($1)', [eventName]);
  } catch {
    // Deliberately swallowed — see the doc comment above.
  }
}

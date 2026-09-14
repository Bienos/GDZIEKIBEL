import type { Pool } from 'pg';

/**
 * The analytics rate limiter's database round trip (TASK-029,
 * `docs/adr/0023-analytics-rate-limiting.md`). Mirrors
 * `db/queries/report-rate-limit.ts` exactly, against its own table, so
 * the two endpoints' very different limits never share one counter.
 */

export interface CheckAndIncrementParams {
  clientKey: string;
  windowStart: Date;
  /** Windows starting before this instant are deleted before the count for
   * this request is read, so the table never accumulates more than about
   * a day's worth of counters. */
  retentionCutoff: Date;
}

/**
 * Atomically increments (or creates) the current window's count and
 * returns the new total in one round trip — `INSERT ... ON CONFLICT ...
 * RETURNING`, not a separate read-then-write, so concurrent requests from
 * the same client cannot both read a count under the limit and both
 * proceed.
 */
export async function checkAndIncrementAnalyticsRateLimit(
  pool: Pool,
  params: CheckAndIncrementParams,
): Promise<{ count: number }> {
  await pool.query('DELETE FROM analytics_rate_limit_windows WHERE window_start < $1', [
    params.retentionCutoff,
  ]);

  const result = await pool.query<{ request_count: number }>(
    `INSERT INTO analytics_rate_limit_windows (client_key, window_start, request_count)
     VALUES ($1, $2, 1)
     ON CONFLICT (client_key, window_start)
     DO UPDATE SET request_count = analytics_rate_limit_windows.request_count + 1
     RETURNING request_count`,
    [params.clientKey, params.windowStart],
  );

  const row = result.rows[0];
  if (!row) throw new Error('checkAndIncrementAnalyticsRateLimit: upsert returned no row');
  return { count: row.request_count };
}

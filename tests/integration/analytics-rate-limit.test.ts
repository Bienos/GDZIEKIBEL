import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { closePool, getPool } from '@/db/client';
import { checkAndIncrementAnalyticsRateLimit } from '@/db/queries/analytics-rate-limit';
import {
  ANALYTICS_RATE_LIMIT_MAX_REQUESTS_PER_WINDOW,
  hashClientKey,
  rateLimitRetentionCutoff,
  rateLimitWindowStart,
} from '@/lib/analytics/rate-limit';

/**
 * Proves the analytics rate limiter against a real Postgres database
 * (TASK-029, `docs/adr/0023-analytics-rate-limiting.md`): the count is
 * atomic and cumulative within one window, a different client key gets
 * its own count, and pruning actually deletes rows older than the
 * retention cutoff rather than merely ignoring them. Mirrors
 * `tests/integration/report-rate-limit.test.ts` against the separate
 * `analytics_rate_limit_windows` table.
 */
const hasDatabaseUrl = Boolean(process.env.DATABASE_URL);

const TEST_KEY_PREFIX = 'analytics-rate-limit-test-';

function testKey(name: string): string {
  return hashClientKey(`${TEST_KEY_PREFIX}${name}`);
}

describe.skipIf(!hasDatabaseUrl)('checkAndIncrementAnalyticsRateLimit', () => {
  afterEach(async () => {
    await getPool().query(`DELETE FROM analytics_rate_limit_windows WHERE client_key = ANY($1)`, [
      [testKey('sequence'), testKey('other-client'), testKey('pruning')],
    ]);
  });

  afterAll(async () => {
    await closePool();
  });

  it('increments cumulatively within one window, and a write past the documented limit exceeds it', async () => {
    const now = new Date('2026-09-14T10:00:00Z');
    const clientKey = testKey('sequence');
    const windowStart = rateLimitWindowStart(now);
    const retentionCutoff = rateLimitRetentionCutoff(now);

    const counts: number[] = [];
    for (let i = 0; i < ANALYTICS_RATE_LIMIT_MAX_REQUESTS_PER_WINDOW + 1; i += 1) {
      const { count } = await checkAndIncrementAnalyticsRateLimit(getPool(), {
        clientKey,
        windowStart,
        retentionCutoff,
      });
      counts.push(count);
    }

    expect(counts.at(-1)).toBe(ANALYTICS_RATE_LIMIT_MAX_REQUESTS_PER_WINDOW + 1);
    expect(counts.at(-1)).toBeGreaterThan(ANALYTICS_RATE_LIMIT_MAX_REQUESTS_PER_WINDOW);
  });

  it('gives a different client key its own independent count', async () => {
    const now = new Date('2026-09-14T10:00:00Z');
    const windowStart = rateLimitWindowStart(now);
    const retentionCutoff = rateLimitRetentionCutoff(now);

    await checkAndIncrementAnalyticsRateLimit(getPool(), {
      clientKey: testKey('sequence'),
      windowStart,
      retentionCutoff,
    });
    await checkAndIncrementAnalyticsRateLimit(getPool(), {
      clientKey: testKey('sequence'),
      windowStart,
      retentionCutoff,
    });
    const { count } = await checkAndIncrementAnalyticsRateLimit(getPool(), {
      clientKey: testKey('other-client'),
      windowStart,
      retentionCutoff,
    });

    expect(count).toBe(1);
  });

  it('deletes windows older than the retention cutoff rather than only ignoring them', async () => {
    const clientKey = testKey('pruning');
    const staleWindow = new Date('2020-01-01T00:00:00Z');

    await getPool().query(
      `INSERT INTO analytics_rate_limit_windows (client_key, window_start, request_count)
       VALUES ($1, $2, 9999)`,
      [clientKey, staleWindow],
    );

    const now = new Date('2026-09-14T10:00:00Z');
    await checkAndIncrementAnalyticsRateLimit(getPool(), {
      clientKey: testKey('sequence'),
      windowStart: rateLimitWindowStart(now),
      retentionCutoff: rateLimitRetentionCutoff(now),
    });

    const stale = await getPool().query(
      `SELECT 1 FROM analytics_rate_limit_windows WHERE client_key = $1 AND window_start = $2`,
      [clientKey, staleWindow],
    );
    expect(stale.rowCount).toBe(0);
  });
});

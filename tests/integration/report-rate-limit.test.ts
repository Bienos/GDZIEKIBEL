import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { closePool, getPool } from '@/db/client';
import { checkAndIncrementRateLimit } from '@/db/queries/report-rate-limit';
import {
  hashClientKey,
  RATE_LIMIT_MAX_REQUESTS_PER_WINDOW,
  rateLimitRetentionCutoff,
  rateLimitWindowStart,
} from '@/lib/reports/rate-limit';

/**
 * Proves the rate limiter against a real Postgres database (TASK-021,
 * `docs/adr/0016-report-rate-limiting.md`): the count is atomic and
 * cumulative within one window, a different client key gets its own
 * count, and pruning actually deletes rows older than the retention
 * cutoff rather than merely ignoring them.
 */
const hasDatabaseUrl = Boolean(process.env.DATABASE_URL);

const TEST_KEY_PREFIX = 'report-rate-limit-test-';

function testKey(name: string): string {
  return hashClientKey(`${TEST_KEY_PREFIX}${name}`);
}

describe.skipIf(!hasDatabaseUrl)('checkAndIncrementRateLimit', () => {
  afterEach(async () => {
    // Cleans up by re-computing the same hashed keys this file's own tests
    // use, rather than assuming the table holds nothing else — the same
    // discipline tests/integration/nearby.test.ts already applies with its
    // own name prefix.
    await getPool().query(`DELETE FROM report_rate_limit_windows WHERE client_key = ANY($1)`, [
      [testKey('sequence'), testKey('other-client'), testKey('pruning')],
    ]);
  });

  afterAll(async () => {
    await closePool();
  });

  it('increments cumulatively within one window, and a sixth write exceeds the documented limit', async () => {
    const now = new Date('2026-09-14T10:00:00Z');
    const clientKey = testKey('sequence');
    const windowStart = rateLimitWindowStart(now);
    const retentionCutoff = rateLimitRetentionCutoff(now);

    const counts: number[] = [];
    for (let i = 0; i < RATE_LIMIT_MAX_REQUESTS_PER_WINDOW + 1; i += 1) {
      const { count } = await checkAndIncrementRateLimit(getPool(), {
        clientKey,
        windowStart,
        retentionCutoff,
      });
      counts.push(count);
    }

    expect(counts).toEqual([1, 2, 3, 4, 5, 6]);
    expect(counts.at(-1)).toBeGreaterThan(RATE_LIMIT_MAX_REQUESTS_PER_WINDOW);
  });

  it('gives a different client key its own independent count', async () => {
    const now = new Date('2026-09-14T10:00:00Z');
    const windowStart = rateLimitWindowStart(now);
    const retentionCutoff = rateLimitRetentionCutoff(now);

    await checkAndIncrementRateLimit(getPool(), {
      clientKey: testKey('sequence'),
      windowStart,
      retentionCutoff,
    });
    await checkAndIncrementRateLimit(getPool(), {
      clientKey: testKey('sequence'),
      windowStart,
      retentionCutoff,
    });
    const { count } = await checkAndIncrementRateLimit(getPool(), {
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
      `INSERT INTO report_rate_limit_windows (client_key, window_start, request_count)
       VALUES ($1, $2, 9999)`,
      [clientKey, staleWindow],
    );

    const now = new Date('2026-09-14T10:00:00Z');
    await checkAndIncrementRateLimit(getPool(), {
      clientKey: testKey('sequence'),
      windowStart: rateLimitWindowStart(now),
      retentionCutoff: rateLimitRetentionCutoff(now),
    });

    const stale = await getPool().query(
      `SELECT 1 FROM report_rate_limit_windows WHERE client_key = $1 AND window_start = $2`,
      [clientKey, staleWindow],
    );
    expect(stale.rowCount).toBe(0);
  });
});

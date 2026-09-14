import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { closePool, getPool } from '@/db/client';
import { insertAnalyticsEvent } from '@/db/queries/analytics';
import type { EventName } from '@/lib/analytics/types';

/**
 * Proves the analytics write path against a real Postgres database
 * (TASK-023, `docs/adr/0018-first-party-analytics.md`): a real event
 * lands with no location/session/device columns, and a write failure
 * never throws — the whole point of the function's own contract.
 */
const hasDatabaseUrl = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDatabaseUrl)('insertAnalyticsEvent', () => {
  afterEach(async () => {
    await getPool().query(`DELETE FROM analytics_events`);
  });

  afterAll(async () => {
    await closePool();
  });

  it('writes a real row with the given event name and a server-assigned timestamp', async () => {
    const before = new Date();
    await insertAnalyticsEvent(getPool(), 'app_opened');

    const rows = await getPool().query<{ event_name: string; occurred_at: Date }>(
      `SELECT event_name, occurred_at FROM analytics_events`,
    );

    expect(rows.rows).toHaveLength(1);
    expect(rows.rows[0]?.event_name).toBe('app_opened');
    expect(rows.rows[0]?.occurred_at.getTime()).toBeGreaterThanOrEqual(before.getTime());
  });

  it('stores no coordinate, session, or device column — the row has exactly two fields plus its id', async () => {
    await insertAnalyticsEvent(getPool(), 'results_loaded');

    const columns = await getPool().query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'analytics_events'`,
    );

    expect(columns.rows.map((row) => row.column_name).sort()).toEqual([
      'event_name',
      'id',
      'occurred_at',
    ]);
  });

  it('never throws, even when the write itself fails', async () => {
    const invalidEventName = 'not_a_real_event' as EventName;

    await expect(insertAnalyticsEvent(getPool(), invalidEventName)).resolves.toBeUndefined();

    const rows = await getPool().query(`SELECT 1 FROM analytics_events`);
    expect(rows.rowCount).toBe(0);
  });
});

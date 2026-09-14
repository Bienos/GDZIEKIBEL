import { Pool } from 'pg';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { attachPoolErrorLogging } from '@/db/client';

describe('attachPoolErrorLogging', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("logs an idle client's error instead of letting it become an uncaught exception", () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    // Never connected, so this is safe to construct without a real database.
    const pool = new Pool({ connectionString: 'postgres://unused/unused' });
    attachPoolErrorLogging(pool);

    pool.emit('error', new Error('terminating connection due to administrator command'));

    expect(spy).toHaveBeenCalledTimes(1);
    const entry = JSON.parse(String(spy.mock.calls[0]?.[0])) as Record<string, unknown>;
    expect(entry).toMatchObject({ level: 'error', source: 'db/client.ts:pool', name: 'Error' });
  });
});

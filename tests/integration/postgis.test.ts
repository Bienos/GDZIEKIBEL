import { afterAll, describe, expect, it } from 'vitest';
import { closePool, getPool } from '@/db/client';
import { readPostgisStatus } from '@/db/postgis';

/**
 * Database-semantics verification for the TASK-001 baseline.
 *
 * Runs against a real Postgres/PostGIS database, as AGENTS.md requires when
 * database behaviour is the behaviour under test. Skipped when DATABASE_URL is
 * absent so the unit suite stays runnable without a database.
 */
const hasDatabaseUrl = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDatabaseUrl)('PostGIS baseline', () => {
  afterAll(async () => {
    await closePool();
  });

  it('reports PostGIS as available and installed', async () => {
    const status = await readPostgisStatus(getPool());

    expect(status.available).toBe(true);
    expect(status.installed).toBe(true);
    expect(status.installedVersion).not.toBeNull();
  });

  it('can evaluate a PostGIS geography expression', async () => {
    const result = await getPool().query<{ meters: number }>(
      `SELECT ST_Distance(
                ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
                ST_SetSRID(ST_MakePoint($3, $4), 4326)::geography
              ) AS meters`,
      [21.0122, 52.2297, 21.0122, 52.2387],
    );

    const meters = Number(result.rows[0]?.meters);

    // Roughly one kilometre of latitude difference in Warsaw.
    expect(meters).toBeGreaterThan(950);
    expect(meters).toBeLessThan(1050);
  });
});

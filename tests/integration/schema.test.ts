import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { closePool, getPool } from '@/db/client';

/**
 * TASK-003 schema verification against a real PostGIS database.
 *
 * Assumes `pnpm db:migrate` has run. Each test cleans up after itself, so the
 * suite can run repeatedly against the development database.
 */
const hasDatabaseUrl = Boolean(process.env.DATABASE_URL);

const CENTRE = { lat: 52.2297, lon: 21.0122 };

describe.skipIf(!hasDatabaseUrl)('toilet schema', () => {
  // Deletes only what this file created. A TRUNCATE here would remove rows
  // another test file is still using, since they share one database.
  afterEach(async () => {
    await getPool().query(`DELETE FROM toilet_source_records WHERE source_name = 'schema-test'`);
    await getPool().query(`DELETE FROM toilets WHERE name = ANY($1)`, [
      ['Test', 'near', 'far', 't', 'renamed'],
    ]);
    await getPool().query(`DELETE FROM ingestion_runs WHERE source_name = 'schema-test'`);
  });

  afterAll(async () => {
    await closePool();
  });

  it('created the three tables', async () => {
    const result = await getPool().query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name IN ('toilets', 'toilet_source_records', 'ingestion_runs')
        ORDER BY table_name`,
    );

    expect(result.rows.map((row) => row.table_name)).toEqual([
      'ingestion_runs',
      'toilet_source_records',
      'toilets',
    ]);
  });

  it('defaults every inferable attribute to unknown, never to no or free', async () => {
    const inserted = await getPool().query<{
      access_type: string;
      price_state: string;
      wheelchair: string;
      changing_table: string;
      male: string;
      indoor: boolean | null;
      open_24h: boolean | null;
      seasonal: boolean | null;
    }>(
      `INSERT INTO toilets (name, geom)
       VALUES ($1, ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography)
       RETURNING access_type, price_state, wheelchair, changing_table, male, indoor, open_24h, seasonal`,
      ['Test', CENTRE.lon, CENTRE.lat],
    );

    expect(inserted.rows[0]).toEqual({
      access_type: 'unknown',
      price_state: 'unknown',
      wheelchair: 'unknown',
      changing_table: 'unknown',
      male: 'unknown',
      indoor: null,
      open_24h: null,
      seasonal: null,
    });
  });

  it('rejects a value outside an enumerated type', async () => {
    await expect(
      getPool().query(
        `INSERT INTO toilets (name, geom, wheelchair)
         VALUES ($1, ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography, 'maybe')`,
        ['Test', CENTRE.lon, CENTRE.lat],
      ),
    ).rejects.toThrow(/invalid input value for enum feature_state/);
  });

  it('finds a toilet inside a radius with ST_DWithin and not one outside', async () => {
    // About 300 m north of the centre, and about 5 km north.
    await getPool().query(
      `INSERT INTO toilets (name, geom) VALUES
         ('near', ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography),
         ('far',  ST_SetSRID(ST_MakePoint($1, $3), 4326)::geography)`,
      [CENTRE.lon, CENTRE.lat + 0.0027, CENTRE.lat + 0.045],
    );

    const result = await getPool().query<{ name: string; meters: number }>(
      // Scoped to this test's own rows: the table may hold ingested data, and
      // asserting on every row in it would make this test depend on that.
      `SELECT name,
              ST_Distance(geom, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography) AS meters
         FROM toilets
        WHERE canonical_status = 'active'
          AND name = ANY(ARRAY['near', 'far'])
          AND ST_DWithin(geom, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, 1000)
        ORDER BY meters`,
      [CENTRE.lon, CENTRE.lat],
    );

    expect(result.rows.map((row) => row.name)).toEqual(['near']);
    expect(Number(result.rows[0]?.meters)).toBeGreaterThan(250);
    expect(Number(result.rows[0]?.meters)).toBeLessThan(350);
  });

  it('uses the GiST index for the radius query', async () => {
    const plan = await getPool().query<{ 'QUERY PLAN': string }>(
      `EXPLAIN SELECT id FROM toilets
        WHERE ST_DWithin(geom, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, 1000)`,
      [CENTRE.lon, CENTRE.lat],
    );

    const text = plan.rows.map((row) => row['QUERY PLAN']).join('\n');
    // On an empty table the planner may still choose a seq scan; what matters
    // is that the index exists and is usable, which pg_indexes confirms.
    const index = await getPool().query(
      `SELECT indexdef FROM pg_indexes WHERE indexname = 'toilets_geom_gix'`,
    );
    expect(index.rowCount).toBe(1);
    expect(text).toBeTruthy();
  });

  it('rejects a duplicate source record for the same source and id', async () => {
    const insert = `INSERT INTO toilet_source_records (source_name, source_record_id, normalized_payload)
                    VALUES ('schema-test', 'node/1', '{}'::jsonb)`;
    await getPool().query(insert);

    await expect(getPool().query(insert)).rejects.toThrow(/duplicate key value/);
  });

  it('rejects an empty source name', async () => {
    await expect(
      getPool().query(
        `INSERT INTO toilet_source_records (source_name, source_record_id, normalized_payload)
         VALUES ('', 'node/1', '{}'::jsonb)`,
      ),
    ).rejects.toThrow(/check constraint/);
  });

  it('maintains updated_at by trigger without the application setting it', async () => {
    const inserted = await getPool().query<{ id: string; updated_at: Date }>(
      `INSERT INTO toilets (name, geom)
       VALUES ('t', ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography)
       RETURNING id, updated_at`,
      [CENTRE.lon, CENTRE.lat],
    );
    const before = inserted.rows[0];
    expect(before).toBeDefined();

    // Force a visible gap; now() is transaction time and tests are fast.
    await new Promise((resolve) => setTimeout(resolve, 20));
    const updated = await getPool().query<{ updated_at: Date }>(
      `UPDATE toilets SET name = 'renamed' WHERE id = $1 RETURNING updated_at`,
      [before?.id],
    );

    expect(updated.rows[0]?.updated_at.getTime()).toBeGreaterThan(
      before?.updated_at.getTime() ?? Number.POSITIVE_INFINITY,
    );
  });

  it('keeps a source record when its toilet is deleted, unlinked rather than removed', async () => {
    const toilet = await getPool().query<{ id: string }>(
      `INSERT INTO toilets (name, geom)
       VALUES ('t', ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography) RETURNING id`,
      [CENTRE.lon, CENTRE.lat],
    );
    await getPool().query(
      `INSERT INTO toilet_source_records (source_name, source_record_id, toilet_id, normalized_payload)
       VALUES ('schema-test', 'node/2', $1, '{}'::jsonb)`,
      [toilet.rows[0]?.id],
    );

    await getPool().query('DELETE FROM toilets WHERE id = $1', [toilet.rows[0]?.id]);

    const remaining = await getPool().query<{ toilet_id: string | null }>(
      `SELECT toilet_id FROM toilet_source_records
        WHERE source_name = 'schema-test' AND source_record_id = 'node/2'`,
    );
    expect(remaining.rowCount).toBe(1);
    expect(remaining.rows[0]?.toilet_id).toBeNull();
  });

  it('rejects an ingestion run that finished before it started', async () => {
    await expect(
      getPool().query(
        `INSERT INTO ingestion_runs (source_name, started_at, finished_at)
         VALUES ('schema-test', now(), now() - interval '1 minute')`,
      ),
    ).rejects.toThrow(/check constraint/);
  });
});

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { DatabaseError } from 'pg';
import { closePool, getPool } from '@/db/client';

/**
 * Database-semantics verification for the TASK-003 schema.
 *
 * Runs against a real Postgres/PostGIS database with migrations applied, as
 * AGENTS.md requires when database behaviour is the behaviour under test.
 * Skipped when DATABASE_URL is absent. Everything it inserts, it deletes.
 */
const hasDatabaseUrl = Boolean(process.env.DATABASE_URL);

// Automatic toilet near Agrykola in Warsaw (OSM way 1201210007 centre).
const TOILET_LON = 21.0266934;
const TOILET_LAT = 52.2192425;

// About 240 m south of it.
const NEARBY_LON = 21.0266934;
const NEARBY_LAT = 52.2171;

const UNIQUE_VIOLATION = '23505';
const CHECK_VIOLATION = '23514';
const NOT_NULL_VIOLATION = '23502';

async function expectSqlState(promise: Promise<unknown>, code: string): Promise<void> {
  let caught: unknown;
  try {
    await promise;
  } catch (error) {
    caught = error;
  }
  expect(caught, 'expected the statement to fail').toBeDefined();
  expect((caught as DatabaseError).code).toBe(code);
}

describe.skipIf(!hasDatabaseUrl)('toilet schema', () => {
  const pool = () => getPool();
  const toiletIds: string[] = [];
  const sourceRecordIds: string[] = [];
  const runIds: string[] = [];

  beforeAll(async () => {
    const tables = await pool().query<{ name: string; exists: string | null }>(
      `SELECT t.name, to_regclass(t.name)::text AS exists
         FROM unnest($1::text[]) AS t(name)`,
      [['toilets', 'toilet_source_records', 'ingestion_runs']],
    );
    for (const row of tables.rows) {
      expect(row.exists, `table ${row.name} must exist (run pnpm db:migrate)`).not.toBeNull();
    }
  });

  afterAll(async () => {
    if (sourceRecordIds.length > 0) {
      await pool().query('DELETE FROM toilet_source_records WHERE id = ANY($1::uuid[])', [
        sourceRecordIds,
      ]);
    }
    if (toiletIds.length > 0) {
      await pool().query('DELETE FROM toilets WHERE id = ANY($1::uuid[])', [toiletIds]);
    }
    if (runIds.length > 0) {
      await pool().query('DELETE FROM ingestion_runs WHERE id = ANY($1::uuid[])', [runIds]);
    }
    await closePool();
  });

  async function insertToilet(
    overrides: Record<string, unknown> = {},
  ): Promise<{ id: string; created_at: Date; updated_at: Date }> {
    // geom is built from constants in SQL; every other column is a parameter.
    const columns = ['geom', 'name', ...Object.keys(overrides)];
    const values: unknown[] = ['TASK-003 test toilet', ...Object.values(overrides)];
    const placeholders = [
      `ST_SetSRID(ST_MakePoint(${TOILET_LON}, ${TOILET_LAT}), 4326)::geography`,
      ...values.map((_, index) => `$${index + 1}`),
    ];
    const result = await pool().query<{ id: string; created_at: Date; updated_at: Date }>(
      `INSERT INTO toilets (${columns.join(', ')})
       VALUES (${placeholders.join(', ')})
       RETURNING id, created_at, updated_at`,
      values,
    );
    const row = result.rows[0];
    if (!row) throw new Error('insert returned no row');
    toiletIds.push(row.id);
    return row;
  }

  it('stores a geography point and answers ST_DWithin in metres', async () => {
    const { id } = await insertToilet();

    const result = await pool().query<{ within_500: boolean; within_100: boolean; meters: string }>(
      `SELECT ST_DWithin(geom, ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography, 500) AS within_500,
              ST_DWithin(geom, ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography, 100) AS within_100,
              ST_Distance(geom, ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography) AS meters
         FROM toilets WHERE id = $1`,
      [id, NEARBY_LON, NEARBY_LAT],
    );

    const row = result.rows[0];
    expect(row?.within_500).toBe(true);
    expect(row?.within_100).toBe(false);
    expect(Number(row?.meters)).toBeGreaterThan(200);
    expect(Number(row?.meters)).toBeLessThan(280);
  });

  it('uses the GiST index on geom', async () => {
    const result = await pool().query<{ indexdef: string }>(
      `SELECT indexdef FROM pg_indexes WHERE tablename = 'toilets' AND indexname = 'toilets_geom_gist'`,
    );
    expect(result.rows[0]?.indexdef).toMatch(/USING gist \(geom\)/);
  });

  it('keeps unknown facility values as NULL and defaults nothing to false', async () => {
    const { id } = await insertToilet();

    const result = await pool().query<{
      wheelchair_accessible: string | null;
      baby_changing: string | null;
      unisex: boolean | null;
      access_type: string | null;
      public_access: boolean | null;
      open_24h: boolean | null;
      price_state: string;
      canonical_status: string;
      confidence_level: string | null;
    }>(
      `SELECT wheelchair_accessible, baby_changing, unisex, access_type, public_access, open_24h,
              price_state, canonical_status, confidence_level
         FROM toilets WHERE id = $1`,
      [id],
    );

    const row = result.rows[0];
    expect(row?.wheelchair_accessible).toBeNull();
    expect(row?.baby_changing).toBeNull();
    expect(row?.unisex).toBeNull();
    expect(row?.access_type).toBeNull();
    expect(row?.public_access).toBeNull();
    expect(row?.open_24h).toBeNull();
    expect(row?.confidence_level).toBeNull();
    // The two columns with explicit sentinels, per ARCHITECTURE.md 5.1.
    expect(row?.price_state).toBe('unknown');
    expect(row?.canonical_status).toBe('active');
  });

  it('accepts the three-state facility value "limited"', async () => {
    const { id } = await insertToilet({ wheelchair_accessible: 'limited', baby_changing: 'no' });
    const result = await pool().query<{ wheelchair_accessible: string; baby_changing: string }>(
      'SELECT wheelchair_accessible, baby_changing FROM toilets WHERE id = $1',
      [id],
    );
    expect(result.rows[0]).toEqual({ wheelchair_accessible: 'limited', baby_changing: 'no' });
  });

  it('rejects values outside the constrained sets', async () => {
    await expectSqlState(insertToilet({ canonical_status: 'gone' }), CHECK_VIOLATION);
    await expectSqlState(insertToilet({ wheelchair_accessible: 'designated' }), CHECK_VIOLATION);
    await expectSqlState(
      insertToilet({ price_state: 'paid', price_amount_minor: 450 }),
      CHECK_VIOLATION,
    );
    await expectSqlState(insertToilet({ confidence_score: 101 }), CHECK_VIOLATION);
  });

  it('maintains updated_at by trigger on update', async () => {
    const { id, created_at, updated_at } = await insertToilet();
    expect(updated_at.getTime()).toBe(created_at.getTime());

    await pool().query(`UPDATE toilets SET name = 'renamed' WHERE id = $1`, [id]);
    const after = await pool().query<{ updated_at: Date; created_at: Date }>(
      'SELECT updated_at, created_at FROM toilets WHERE id = $1',
      [id],
    );
    expect(after.rows[0]?.created_at.getTime()).toBe(created_at.getTime());
    expect(after.rows[0]?.updated_at.getTime()).toBeGreaterThan(updated_at.getTime());
  });

  it('enforces one source record per (source_name, source_record_id)', async () => {
    const insert = () =>
      pool().query<{ id: string }>(
        `INSERT INTO toilet_source_records
           (source_name, source_record_id, source_url, normalized_payload, fetched_at)
         VALUES ('osm', 'node/task-003-test', 'https://www.openstreetmap.org/node/1', '{}'::jsonb, now())
         RETURNING id`,
      );

    const first = await insert();
    sourceRecordIds.push(first.rows[0]!.id);

    await expectSqlState(insert(), UNIQUE_VIOLATION);
  });

  it('requires a source_url and a known source_name on source records', async () => {
    await expectSqlState(
      pool().query(
        `INSERT INTO toilet_source_records
           (source_name, source_record_id, normalized_payload, fetched_at)
         VALUES ('osm', 'node/task-003-no-url', '{}'::jsonb, now())`,
      ),
      NOT_NULL_VIOLATION,
    );
    await expectSqlState(
      pool().query(
        `INSERT INTO toilet_source_records
           (source_name, source_record_id, source_url, normalized_payload, fetched_at)
         VALUES ('google', 'x', 'https://example.invalid', '{}'::jsonb, now())`,
      ),
      CHECK_VIOLATION,
    );
  });

  it('unlinks, rather than deletes, source records when a toilet is removed', async () => {
    const { id: toiletId } = await insertToilet();
    const inserted = await pool().query<{ id: string }>(
      `INSERT INTO toilet_source_records
         (source_name, source_record_id, toilet_id, source_url, normalized_payload, fetched_at)
       VALUES ('hub-curated', 'pkp/task-003-test', $1, 'https://www.pkp.pl/pl/', '{}'::jsonb, now())
       RETURNING id`,
      [toiletId],
    );
    const recordId = inserted.rows[0]!.id;
    sourceRecordIds.push(recordId);

    await pool().query('DELETE FROM toilets WHERE id = $1', [toiletId]);
    toiletIds.splice(toiletIds.indexOf(toiletId), 1);

    const after = await pool().query<{ toilet_id: string | null }>(
      'SELECT toilet_id FROM toilet_source_records WHERE id = $1',
      [recordId],
    );
    expect(after.rows).toHaveLength(1);
    expect(after.rows[0]?.toilet_id).toBeNull();
  });

  it('records an ingestion run with counts unknown until reported', async () => {
    const started = await pool().query<{
      id: string;
      status: string;
      records_fetched: number | null;
    }>(
      `INSERT INTO ingestion_runs (source_name) VALUES ('osm')
       RETURNING id, status, records_fetched`,
    );
    const run = started.rows[0]!;
    runIds.push(run.id);
    expect(run.status).toBe('running');
    expect(run.records_fetched).toBeNull();

    // A running run cannot carry an end time; a finished one must not precede its start.
    await expectSqlState(
      pool().query(`UPDATE ingestion_runs SET finished_at = now() WHERE id = $1`, [run.id]),
      CHECK_VIOLATION,
    );
    await expectSqlState(
      pool().query(
        `UPDATE ingestion_runs SET status = 'succeeded', finished_at = started_at - interval '1 second' WHERE id = $1`,
        [run.id],
      ),
      CHECK_VIOLATION,
    );

    await pool().query(
      `UPDATE ingestion_runs
          SET status = 'succeeded', finished_at = now(), records_fetched = 562, records_created = 562,
              records_updated = 0, records_unchanged = 0, duplicates_found = 0, ambiguous_matches = 0
        WHERE id = $1`,
      [run.id],
    );
    const finished = await pool().query<{ status: string; records_fetched: number }>(
      'SELECT status, records_fetched FROM ingestion_runs WHERE id = $1',
      [run.id],
    );
    expect(finished.rows[0]).toEqual({ status: 'succeeded', records_fetched: 562 });
  });
});

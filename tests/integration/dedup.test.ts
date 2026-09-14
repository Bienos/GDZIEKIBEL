import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { closePool, getPool } from '@/db/client';
import { normalizeElement } from '@/lib/ingest/osm/normalize';
import { validateElement } from '@/lib/ingest/osm/validate';
import { upsertSourceRecords } from '@/lib/ingest/upsert';
import type { NormalizedSourceRecord } from '@/lib/toilets/normalized-source-record';

/**
 * Proves cross-source matching against a real PostGIS database (TASK-022,
 * `docs/adr/0017-cross-source-deduplication.md`): a confident match links
 * to the existing toilet without touching its columns, an ambiguous match
 * is left unlinked and flagged, a far-away record still creates a new
 * toilet, and — the most important guarantee — two same-source records
 * are never matched against each other, however close.
 */
const hasDatabaseUrl = Boolean(process.env.DATABASE_URL);

const OSM_SOURCE = 'test-osm';
const SECOND_SOURCE = 'fixture-second-source';
const CENTRE = { lat: 52.2297, lon: 21.0122 };

let nodeId = 1;

function record(
  overrides: Partial<NormalizedSourceRecord> & { sourceRecordId: string },
): NormalizedSourceRecord {
  nodeId += 1;
  const element = validateElement({
    type: 'node',
    id: nodeId,
    version: 1,
    lat: overrides.position?.lat ?? CENTRE.lat,
    lon: overrides.position?.lon ?? CENTRE.lon,
    tags: { amenity: 'toilets', name: 'Toaleta Miejska' },
    timestamp: '2026-08-01T10:00:00Z',
  });
  if (!element.ok) throw new Error('fixture element should validate');
  return { ...normalizeElement(element.element), sourceName: OSM_SOURCE, ...overrides };
}

/** Offsets `CENTRE` by roughly `meters` to the east — small enough that
 * the approximation error is negligible at the distances these tests use. */
function offsetLonMeters(meters: number): number {
  const metersPerDegreeLon = 111_320 * Math.cos((CENTRE.lat * Math.PI) / 180);
  return CENTRE.lon + meters / metersPerDegreeLon;
}

async function withTransaction<T>(fn: (client: Awaited<ReturnType<typeof connect>>) => Promise<T>) {
  const client = await connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

function connect() {
  return getPool().connect();
}

describe.skipIf(!hasDatabaseUrl)('cross-source deduplication', () => {
  afterEach(async () => {
    await getPool().query(
      `DELETE FROM dedup_candidates WHERE source_record_id IN (
         SELECT id FROM toilet_source_records WHERE source_name IN ($1, $2))`,
      [OSM_SOURCE, SECOND_SOURCE],
    );
    await getPool().query(
      `DELETE FROM toilets WHERE id IN (
         SELECT toilet_id FROM toilet_source_records
          WHERE source_name IN ($1, $2) AND toilet_id IS NOT NULL)`,
      [OSM_SOURCE, SECOND_SOURCE],
    );
    await getPool().query(`DELETE FROM toilet_source_records WHERE source_name IN ($1, $2)`, [
      OSM_SOURCE,
      SECOND_SOURCE,
    ]);
  });

  afterAll(async () => {
    await closePool();
  });

  it('auto-merges a close, name-similar second-source record and never touches the existing toilet columns', async () => {
    await withTransaction((client) =>
      upsertSourceRecords(
        client,
        OSM_SOURCE,
        [
          record({
            sourceRecordId: 'osm/1',
            wheelchair: 'yes',
            position: { lat: CENTRE.lat, lon: CENTRE.lon },
          }),
        ],
        new Date(),
      ),
    );

    const counts = await withTransaction((client) =>
      upsertSourceRecords(
        client,
        SECOND_SOURCE,
        [
          record({
            sourceRecordId: 'second/1',
            sourceName: SECOND_SOURCE,
            name: 'Toaleta Miejska',
            wheelchair: 'no', // deliberately conflicting with the first source
            position: { lat: CENTRE.lat, lon: offsetLonMeters(5) },
          }),
        ],
        new Date(),
      ),
    );

    expect(counts).toMatchObject({ created: 0, merged: 1, flaggedForReview: 0 });

    const toilets = await getPool().query<{ n: number }>(
      `SELECT count(DISTINCT toilet_id)::int AS n FROM toilet_source_records
        WHERE source_name IN ($1, $2)`,
      [OSM_SOURCE, SECOND_SOURCE],
    );
    expect(toilets.rows[0]?.n).toBe(1);

    // The original toilet's own columns are untouched by the merge: still
    // the first source's 'yes', never overwritten by the second source's
    // conflicting 'no' (docs/adr/0017, "conflict surfaced, not silently
    // resolved").
    const canonical = await getPool().query<{ wheelchair: string }>(
      `SELECT t.wheelchair FROM toilets t
         JOIN toilet_source_records s ON s.toilet_id = t.id
        WHERE s.source_name = $1`,
      [OSM_SOURCE],
    );
    expect(canonical.rows[0]?.wheelchair).toBe('yes');
  });

  it('leaves an ambiguous match unlinked and flags it for review, creating no new toilet', async () => {
    await withTransaction((client) =>
      upsertSourceRecords(
        client,
        OSM_SOURCE,
        [record({ sourceRecordId: 'osm/2', position: { lat: CENTRE.lat, lon: CENTRE.lon } })],
        new Date(),
      ),
    );

    const counts = await withTransaction((client) =>
      upsertSourceRecords(
        client,
        SECOND_SOURCE,
        [
          record({
            sourceRecordId: 'second/2',
            sourceName: SECOND_SOURCE,
            name: 'Zupełnie Inna Nazwa',
            // within the spatial radius (30 m) but past the auto-merge
            // distance (15 m), so distance alone cannot force a merge either
            position: { lat: CENTRE.lat, lon: offsetLonMeters(22) },
          }),
        ],
        new Date(),
      ),
    );

    expect(counts).toMatchObject({ created: 0, merged: 0, flaggedForReview: 1 });

    const unlinked = await getPool().query<{ toilet_id: string | null }>(
      `SELECT toilet_id FROM toilet_source_records WHERE source_name = $1 AND source_record_id = $2`,
      [SECOND_SOURCE, 'second/2'],
    );
    expect(unlinked.rows[0]?.toilet_id).toBeNull();

    const candidate = await getPool().query<{ match_score: number; status: string }>(
      `SELECT dc.match_score, dc.status FROM dedup_candidates dc
         JOIN toilet_source_records s ON s.id = dc.source_record_id
        WHERE s.source_name = $1 AND s.source_record_id = $2`,
      [SECOND_SOURCE, 'second/2'],
    );
    expect(candidate.rows[0]?.status).toBe('pending');
    expect(candidate.rows[0]?.match_score).toBeGreaterThanOrEqual(0);
  });

  it('creates a new toilet for a second-source record far from anything else', async () => {
    await withTransaction((client) =>
      upsertSourceRecords(
        client,
        OSM_SOURCE,
        [record({ sourceRecordId: 'osm/3', position: { lat: CENTRE.lat, lon: CENTRE.lon } })],
        new Date(),
      ),
    );

    const counts = await withTransaction((client) =>
      upsertSourceRecords(
        client,
        SECOND_SOURCE,
        [
          record({
            sourceRecordId: 'second/3',
            sourceName: SECOND_SOURCE,
            position: { lat: CENTRE.lat, lon: offsetLonMeters(5000) },
          }),
        ],
        new Date(),
      ),
    );

    expect(counts).toMatchObject({ created: 1, merged: 0, flaggedForReview: 0 });
  });

  it('never matches two same-source records against each other, however close — a real second run of the existing single-source path', async () => {
    const counts = await withTransaction((client) =>
      upsertSourceRecords(
        client,
        OSM_SOURCE,
        [
          record({
            sourceRecordId: 'osm/4a',
            position: { lat: CENTRE.lat, lon: CENTRE.lon },
          }),
          record({
            sourceRecordId: 'osm/4b',
            // 2 metres away — well within both the spatial and auto-merge
            // radii, but same-source candidates are never even queried.
            position: { lat: CENTRE.lat, lon: offsetLonMeters(2) },
          }),
        ],
        new Date(),
      ),
    );

    expect(counts).toMatchObject({ created: 2, merged: 0, flaggedForReview: 0 });
  });
});

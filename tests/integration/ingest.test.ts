import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { closePool, getPool } from '@/db/client';
import { normalizeElement } from '@/lib/ingest/osm/normalize';
import { validateElement } from '@/lib/ingest/osm/validate';
import { FALLBACK_TOILET_NAME, upsertSourceRecords } from '@/lib/ingest/upsert';
import type { NormalizedSourceRecord } from '@/lib/toilets/normalized-source-record';

/**
 * Proves the ingestion write path against a real PostGIS database: a second
 * run changes nothing, a version bump updates, and an element that disappears
 * is marked rather than deleted.
 */
const hasDatabaseUrl = Boolean(process.env.DATABASE_URL);

const SOURCE = 'test-source';

function record(overrides: Partial<NormalizedSourceRecord> & { sourceRecordId: string }) {
  const element = validateElement({
    type: 'node',
    id: 1,
    version: 1,
    lat: 52.2297,
    lon: 21.0122,
    tags: { amenity: 'toilets' },
    timestamp: '2026-08-01T10:00:00Z',
  });
  if (!element.ok) throw new Error('fixture element should validate');
  return { ...normalizeElement(element.element), sourceName: SOURCE, ...overrides };
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

describe.skipIf(!hasDatabaseUrl)('ingestion upsert', () => {
  // Deletes only the rows this file created. Deleting every unlinked toilet
  // would remove rows another test file is still using.
  afterEach(async () => {
    await getPool().query(
      `DELETE FROM toilets WHERE id IN (
         SELECT toilet_id FROM toilet_source_records
          WHERE source_name = $1 AND toilet_id IS NOT NULL)`,
      [SOURCE],
    );
    await getPool().query(`DELETE FROM toilet_source_records WHERE source_name = $1`, [SOURCE]);
  });

  afterAll(async () => {
    await closePool();
  });

  it('creates one canonical toilet per new source record', async () => {
    const records = [record({ sourceRecordId: 'node/1' }), record({ sourceRecordId: 'node/2' })];

    const counts = await withTransaction((client) =>
      upsertSourceRecords(client, SOURCE, records, new Date()),
    );

    expect(counts).toMatchObject({ fetched: 2, created: 2, updated: 0, unchanged: 0, notSeen: 0 });

    const toilets = await getPool().query(
      `SELECT t.name FROM toilets t
         JOIN toilet_source_records s ON s.toilet_id = t.id
        WHERE s.source_name = $1`,
      [SOURCE],
    );
    expect(toilets.rowCount).toBe(2);
  });

  it('labels a nameless facility without claiming anything about it', async () => {
    await withTransaction((client) =>
      upsertSourceRecords(client, SOURCE, [record({ sourceRecordId: 'node/1' })], new Date()),
    );

    const result = await getPool().query<{
      name: string;
      access_type: string;
      price_state: string;
    }>(
      `SELECT t.name, t.access_type, t.price_state FROM toilets t
         JOIN toilet_source_records s ON s.toilet_id = t.id
        WHERE s.source_name = $1`,
      [SOURCE],
    );

    expect(result.rows[0]?.name).toBe(FALLBACK_TOILET_NAME);
    expect(result.rows[0]?.access_type).toBe('unknown');
    expect(result.rows[0]?.price_state).toBe('unknown');
  });

  it('reports a second identical run as unchanged and creates nothing', async () => {
    const records = [record({ sourceRecordId: 'node/1' }), record({ sourceRecordId: 'node/2' })];
    await withTransaction((client) => upsertSourceRecords(client, SOURCE, records, new Date()));

    const second = await withTransaction((client) =>
      upsertSourceRecords(client, SOURCE, records, new Date()),
    );

    expect(second).toMatchObject({ created: 0, updated: 0, unchanged: 2, notSeen: 0 });

    const toilets = await getPool().query(
      `SELECT count(*)::int AS n FROM toilet_source_records WHERE source_name = $1`,
      [SOURCE],
    );
    expect(toilets.rows[0]).toEqual({ n: 2 });
  });

  it('updates the canonical toilet when the source version changes', async () => {
    await withTransaction((client) =>
      upsertSourceRecords(
        client,
        SOURCE,
        [record({ sourceRecordId: 'node/1', name: 'Old', sourceVersion: '1' })],
        new Date(),
      ),
    );

    const counts = await withTransaction((client) =>
      upsertSourceRecords(
        client,
        SOURCE,
        [
          record({
            sourceRecordId: 'node/1',
            name: 'New',
            sourceVersion: '2',
            wheelchair: 'yes',
          }),
        ],
        new Date(),
      ),
    );

    expect(counts).toMatchObject({ created: 0, updated: 1, unchanged: 0 });

    const toilet = await getPool().query<{ name: string; wheelchair: string }>(
      `SELECT t.name, t.wheelchair FROM toilets t
         JOIN toilet_source_records s ON s.toilet_id = t.id
        WHERE s.source_name = $1`,
      [SOURCE],
    );
    expect(toilet.rows[0]).toEqual({ name: 'New', wheelchair: 'yes' });
  });

  it('marks a vanished element not_seen_since and deletes nothing', async () => {
    await withTransaction((client) =>
      upsertSourceRecords(
        client,
        SOURCE,
        [record({ sourceRecordId: 'node/1' }), record({ sourceRecordId: 'node/2' })],
        new Date(Date.now() - 60_000),
      ),
    );

    const counts = await withTransaction((client) =>
      upsertSourceRecords(client, SOURCE, [record({ sourceRecordId: 'node/1' })], new Date()),
    );

    expect(counts).toMatchObject({ unchanged: 1, notSeen: 1 });

    const rows = await getPool().query<{ source_record_id: string; not_seen_since: Date | null }>(
      `SELECT source_record_id, not_seen_since FROM toilet_source_records
        WHERE source_name = $1 ORDER BY source_record_id`,
      [SOURCE],
    );
    expect(rows.rowCount).toBe(2);
    expect(rows.rows[0]?.not_seen_since).toBeNull();
    expect(rows.rows[1]?.not_seen_since).not.toBeNull();

    // The canonical toilet survives. Deciding a facility is gone needs more
    // evidence than one absent row.
    const toilets = await getPool().query<{ n: number }>(
      `SELECT count(*)::int AS n FROM toilets t
         JOIN toilet_source_records s ON s.toilet_id = t.id WHERE s.source_name = $1`,
      [SOURCE],
    );
    expect(toilets.rows[0]?.n).toBe(2);
  });

  it('clears not_seen_since when an element comes back', async () => {
    await withTransaction((client) =>
      upsertSourceRecords(
        client,
        SOURCE,
        [record({ sourceRecordId: 'node/1' })],
        new Date(Date.now() - 120_000),
      ),
    );
    await withTransaction((client) =>
      upsertSourceRecords(client, SOURCE, [], new Date(Date.now() - 60_000)),
    );

    await withTransaction((client) =>
      upsertSourceRecords(client, SOURCE, [record({ sourceRecordId: 'node/1' })], new Date()),
    );

    const row = await getPool().query<{ not_seen_since: Date | null }>(
      `SELECT not_seen_since FROM toilet_source_records WHERE source_name = $1`,
      [SOURCE],
    );
    expect(row.rows[0]?.not_seen_since).toBeNull();
  });

  it('writes open_24h and opening_hours_normalized (TASK-013) to the canonical toilet', async () => {
    await withTransaction((client) =>
      upsertSourceRecords(
        client,
        SOURCE,
        [
          record({
            sourceRecordId: 'node/1',
            open24h: null,
            openingHoursNormalized: {
              rules: [{ days: [0, 1, 2, 3, 4], closed: false, ranges: [{ start: 480, end: 960 }] }],
            },
          }),
        ],
        new Date(),
      ),
    );

    const toilet = await getPool().query<{
      open_24h: boolean | null;
      opening_hours_normalized: unknown;
    }>(
      `SELECT t.open_24h, t.opening_hours_normalized FROM toilets t
         JOIN toilet_source_records s ON s.toilet_id = t.id
        WHERE s.source_name = $1`,
      [SOURCE],
    );

    expect(toilet.rows[0]?.open_24h).toBeNull();
    expect(toilet.rows[0]?.opening_hours_normalized).toEqual({
      rules: [{ days: [0, 1, 2, 3, 4], closed: false, ranges: [{ start: 480, end: 960 }] }],
    });
  });

  it('writes price_amount_minor, currency, and normalised payment_methods (TASK-014) to the canonical toilet', async () => {
    await withTransaction((client) =>
      upsertSourceRecords(
        client,
        SOURCE,
        [
          record({
            sourceRecordId: 'node/1',
            priceState: 'paid',
            chargeRaw: '4.50 PLN',
            priceAmountMinor: 450,
            currency: 'PLN',
            paymentMethods: { cash: 'no', cards: 'yes', coins: 'unknown' },
          }),
        ],
        new Date(),
      ),
    );

    const toilet = await getPool().query<{
      price_amount_minor: number | null;
      currency: string | null;
      payment_methods: unknown;
    }>(
      `SELECT t.price_amount_minor, t.currency, t.payment_methods FROM toilets t
         JOIN toilet_source_records s ON s.toilet_id = t.id
        WHERE s.source_name = $1`,
      [SOURCE],
    );

    expect(toilet.rows[0]?.price_amount_minor).toBe(450);
    expect(toilet.rows[0]?.currency).toBe('PLN');
    expect(toilet.rows[0]?.payment_methods).toEqual({ cash: 'no', cards: 'yes', coins: 'unknown' });
  });

  it('stores the normalised payload and never an OSM username', async () => {
    await withTransaction((client) =>
      upsertSourceRecords(client, SOURCE, [record({ sourceRecordId: 'node/1' })], new Date()),
    );

    const row = await getPool().query<{ normalized_payload: Record<string, unknown> }>(
      `SELECT normalized_payload FROM toilet_source_records WHERE source_name = $1`,
      [SOURCE],
    );
    const payload = row.rows[0]?.normalized_payload ?? {};

    expect(payload.sourceRecordId).toBe('node/1');
    expect(JSON.stringify(payload)).not.toMatch(/"u(ser|id)"/);
  });
});

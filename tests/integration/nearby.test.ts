import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { closePool, getPool } from '@/db/client';
import { findNearbyToilets, MAX_NEARBY_RESULTS } from '@/db/queries/nearby';
import { toNearbyResult, type NearbyToiletRow } from '@/lib/toilets/nearby-response';

/**
 * Proves the nearby query against a real PostGIS database: the radius bound,
 * the active-only filter, distance ordering, and the result cap.
 *
 * Assertions filter to this file's own `nearby-test-` rows rather than
 * assuming the table holds nothing else. The table is shared with other
 * test files and with manual verification runs against the same database;
 * asserting on the full result set made these tests fragile against
 * whatever else happened to exist nearby, which is exactly what happened
 * once during development.
 */
const hasDatabaseUrl = Boolean(process.env.DATABASE_URL);

const CENTRE = { lat: 52.2297, lng: 21.0122 };
const PREFIX = 'nearby-test-';

function ownRows(rows: NearbyToiletRow[]): NearbyToiletRow[] {
  return rows.filter((row) => row.name.startsWith(PREFIX));
}

async function insertToilet(
  name: string,
  offsetLat: number,
  overrides: { canonicalStatus?: string } = {},
): Promise<void> {
  await getPool().query(
    `INSERT INTO toilets (name, geom, canonical_status)
     VALUES ($1, ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography, $4)`,
    [name, CENTRE.lng, CENTRE.lat + offsetLat, overrides.canonicalStatus ?? 'active'],
  );
}

describe.skipIf(!hasDatabaseUrl)('findNearbyToilets', () => {
  afterEach(async () => {
    await getPool().query(`DELETE FROM toilets WHERE name LIKE '${PREFIX}%'`);
  });

  afterAll(async () => {
    await closePool();
  });

  it('finds a toilet inside the radius and excludes one outside it', async () => {
    await insertToilet(`${PREFIX}near`, 0.0027); // ~300 m
    await insertToilet(`${PREFIX}far`, 0.045); // ~5 km

    const rows = ownRows(await findNearbyToilets(getPool(), { ...CENTRE, radiusMeters: 1000 }));

    expect(rows.map((row) => row.name)).toEqual([`${PREFIX}near`]);
  });

  it('orders results by distance ascending, nearest first', async () => {
    await insertToilet(`${PREFIX}b`, 0.006); // further
    await insertToilet(`${PREFIX}a`, 0.002); // nearer

    const rows = ownRows(await findNearbyToilets(getPool(), { ...CENTRE, radiusMeters: 2000 }));

    expect(rows.map((row) => row.name)).toEqual([`${PREFIX}a`, `${PREFIX}b`]);
    expect(rows[0]?.distanceMeters).toBeLessThan(rows[1]?.distanceMeters ?? Infinity);
  });

  it('excludes a temporarily closed or removed toilet even when it is the closest', async () => {
    await insertToilet(`${PREFIX}closed`, 0.001, { canonicalStatus: 'temporarily_closed' });
    await insertToilet(`${PREFIX}removed`, 0.0015, { canonicalStatus: 'removed' });
    await insertToilet(`${PREFIX}active`, 0.002);

    const rows = ownRows(await findNearbyToilets(getPool(), { ...CENTRE, radiusMeters: 1000 }));

    expect(rows.map((row) => row.name)).toEqual([`${PREFIX}active`]);
  });

  it('caps the result count at MAX_NEARBY_RESULTS', async () => {
    // Placed at a latitude offset unlikely to collide with other tests'
    // fixture rows, and identified by the same prefix regardless.
    for (let i = 0; i < MAX_NEARBY_RESULTS + 5; i += 1) {
      await insertToilet(`${PREFIX}cap-${i}`, 0.0001 * i);
    }

    const rows = await findNearbyToilets(getPool(), { ...CENTRE, radiusMeters: 5000 });

    // The cap is a property of the query itself: however many rows exist
    // near this point, real fixtures or pre-existing data, the total
    // returned is never more than MAX_NEARBY_RESULTS.
    expect(rows.length).toBe(MAX_NEARBY_RESULTS);
  });

  it('reports schema enum values unchanged, not collapsed into booleans', async () => {
    await getPool().query(
      `INSERT INTO toilets (name, geom, wheelchair, price_state)
       VALUES ($3, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, 'limited', 'paid')`,
      [CENTRE.lng, CENTRE.lat + 0.001, `${PREFIX}limited`],
    );

    const rows = ownRows(await findNearbyToilets(getPool(), { ...CENTRE, radiusMeters: 1000 }));
    const row = rows.find((item) => item.name === `${PREFIX}limited`);

    expect(row?.wheelchair).toBe('limited');
    expect(row?.priceState).toBe('paid');
  });

  it('returns nothing at a coordinate far from any fixture, real or pre-existing', async () => {
    const rows = await findNearbyToilets(getPool(), { lat: 0, lng: 0, radiusMeters: 100 });

    expect(rows).toEqual([]);
  });

  it('reports open_24h and opening_hours_normalized (TASK-013), round-tripped through jsonb', async () => {
    await getPool().query(
      `INSERT INTO toilets (name, geom, open_24h, opening_hours_normalized)
       VALUES ($3, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, true, NULL)`,
      [CENTRE.lng, CENTRE.lat + 0.001, `${PREFIX}always-open`],
    );
    await getPool().query(
      `INSERT INTO toilets (name, geom, open_24h, opening_hours_normalized)
       VALUES ($3, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, NULL, $4::jsonb)`,
      [
        CENTRE.lng,
        CENTRE.lat + 0.0012,
        `${PREFIX}scheduled`,
        JSON.stringify({
          rules: [{ days: [0, 1, 2, 3, 4], closed: false, ranges: [{ start: 480, end: 960 }] }],
        }),
      ],
    );

    const rows = ownRows(await findNearbyToilets(getPool(), { ...CENTRE, radiusMeters: 1000 }));
    const alwaysOpen = rows.find((item) => item.name === `${PREFIX}always-open`);
    const scheduled = rows.find((item) => item.name === `${PREFIX}scheduled`);

    expect(alwaysOpen?.open24h).toBe(true);
    expect(alwaysOpen?.openingHoursNormalized).toBeNull();
    expect(scheduled?.open24h).toBeNull();
    expect(scheduled?.openingHoursNormalized).toEqual({
      rules: [{ days: [0, 1, 2, 3, 4], closed: false, ranges: [{ start: 480, end: 960 }] }],
    });
  });

  it('reports price_amount_minor, currency, and payment_methods (TASK-014), round-tripped through jsonb', async () => {
    await getPool().query(
      `INSERT INTO toilets (name, geom, price_state, price_amount_minor, currency, payment_methods)
       VALUES ($3, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, 'paid', 450, 'PLN', $4::jsonb)`,
      [
        CENTRE.lng,
        CENTRE.lat + 0.001,
        `${PREFIX}priced`,
        JSON.stringify({ cash: 'yes', cards: 'no', coins: 'unknown' }),
      ],
    );

    const rows = ownRows(await findNearbyToilets(getPool(), { ...CENTRE, radiusMeters: 1000 }));
    const priced = rows.find((item) => item.name === `${PREFIX}priced`);

    expect(priced?.priceAmountMinor).toBe(450);
    expect(priced?.currency).toBe('PLN');
    expect(priced?.paymentMethods).toEqual({ cash: 'yes', cards: 'no', coins: 'unknown' });
  });

  it('reports verified_at and access_raw (TASK-019), and computes real MEDIUM confidence from them', async () => {
    await getPool().query(
      `INSERT INTO toilets (name, geom, access_raw, verified_at)
       VALUES ($3, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, 'yes', now() - interval '10 days')`,
      [CENTRE.lng, CENTRE.lat + 0.001, `${PREFIX}recently-verified`],
    );

    const rows = ownRows(await findNearbyToilets(getPool(), { ...CENTRE, radiusMeters: 1000 }));
    const row = rows.find((item) => item.name === `${PREFIX}recently-verified`);

    expect(row?.accessRaw).toBe('yes');
    expect(row?.verifiedAt).not.toBeNull();

    // The real point of this fact: a fresh, real row now computes MEDIUM
    // confidence, not the schema's own 'low' default (docs/adr/0014).
    const result = toNearbyResult(row as NearbyToiletRow, new Date());
    expect(result.confidenceLevel).toBe('medium');
  });

  it('reports paymentMethods as null (not an all-unknown object) for a pre-TASK-014 row with none recorded', async () => {
    await insertToilet(`${PREFIX}no-payment-data`, 0.001);

    const rows = ownRows(await findNearbyToilets(getPool(), { ...CENTRE, radiusMeters: 1000 }));
    const row = rows.find((item) => item.name === `${PREFIX}no-payment-data`);

    // The query itself reports the real column value; toNearbyResult (unit-
    // tested separately) is what turns this null into the all-unknown
    // object at the API boundary.
    expect(row?.paymentMethods).toBeNull();
    expect(row?.priceAmountMinor).toBeNull();
    expect(row?.currency).toBeNull();
  });
});

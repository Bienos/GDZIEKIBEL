import type { PoolClient } from 'pg';
import type { NormalizedSourceRecord } from '@/lib/toilets/normalized-source-record';

/**
 * Writes normalised source records into the database.
 *
 * Source-agnostic on purpose: the second source (TASK-022) reuses this without
 * change. It implements the identity and change-detection rules in
 * `docs/contracts/osm-toilets-source.md` section 5.
 *
 * What it never does: delete a source record, delete a canonical toilet, or
 * change a toilet's status because a source stopped listing it. An element that
 * disappears is marked `not_seen_since` and nothing else. Deciding a facility is
 * gone needs more evidence than one absent row.
 */

export interface UpsertCounts {
  fetched: number;
  created: number;
  updated: number;
  unchanged: number;
  notSeen: number;
}

/**
 * The label used when a source gives no name. It states nothing about access,
 * price or hours. Revisit when copy rules for labels exist.
 */
export const FALLBACK_TOILET_NAME = 'Toaleta';

/** Canonical columns this task can derive from one source record. */
function canonicalValues(record: NormalizedSourceRecord) {
  return [
    record.name ?? FALLBACK_TOILET_NAME,
    record.position.lon,
    record.position.lat,
    record.accessType,
    record.priceState,
    record.priceAmountMinor,
    record.currency,
    record.wheelchair,
    record.changingTable,
    record.male,
    record.female,
    record.unisex,
    record.openingHoursRaw,
    record.open24h,
    record.openingHoursNormalized === null ? null : JSON.stringify(record.openingHoursNormalized),
    record.level,
    record.indoor,
    record.sourceVerifiedAt,
    JSON.stringify(record.paymentMethods),
  ];
}

const INSERT_TOILET = `
  INSERT INTO toilets (
    name, geom, access_type, price_state, price_amount_minor, currency,
    wheelchair, changing_table, male, female, unisex,
    opening_hours_raw, open_24h, opening_hours_normalized, level, indoor, verified_at, payment_methods
  ) VALUES (
    $1, ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography, $4, $5, $6, $7,
    $8, $9, $10, $11, $12,
    $13, $14, $15::jsonb, $16, $17, $18, $19::jsonb
  )
  RETURNING id`;

const UPDATE_TOILET = `
  UPDATE toilets SET
    name = $1,
    geom = ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography,
    access_type = $4, price_state = $5, price_amount_minor = $6, currency = $7,
    wheelchair = $8, changing_table = $9, male = $10, female = $11, unisex = $12,
    opening_hours_raw = $13, open_24h = $14, opening_hours_normalized = $15::jsonb,
    level = $16, indoor = $17, verified_at = $18,
    payment_methods = $19::jsonb
  WHERE id = $20`;

/**
 * Applies one run's records inside the caller's transaction.
 *
 * `runStartedAt` marks records this run did not see, so a partially failed
 * fetch cannot mark the whole dataset absent: the caller only commits when the
 * fetch completed.
 */
export async function upsertSourceRecords(
  client: PoolClient,
  sourceName: string,
  records: NormalizedSourceRecord[],
  runStartedAt: Date,
): Promise<UpsertCounts> {
  const counts: UpsertCounts = {
    fetched: records.length,
    created: 0,
    updated: 0,
    unchanged: 0,
    notSeen: 0,
  };

  for (const record of records) {
    const existing = await client.query<{
      id: string;
      source_version: string | null;
      toilet_id: string | null;
    }>(
      `SELECT id, source_version, toilet_id FROM toilet_source_records
        WHERE source_name = $1 AND source_record_id = $2`,
      [sourceName, record.sourceRecordId],
    );
    const previous = existing.rows[0];

    if (!previous) {
      const toilet = await client.query<{ id: string }>(INSERT_TOILET, canonicalValues(record));
      await client.query(
        `INSERT INTO toilet_source_records (
           source_name, source_record_id, source_version, toilet_id, source_url,
           geom, raw_payload, normalized_payload, source_updated_at,
           first_seen_at, last_seen_at
         ) VALUES (
           $1, $2, $3, $4, $5,
           ST_SetSRID(ST_MakePoint($6, $7), 4326)::geography, NULL, $8::jsonb, $9,
           $10, $10
         )`,
        [
          sourceName,
          record.sourceRecordId,
          record.sourceVersion,
          toilet.rows[0]?.id,
          record.sourceUrl,
          record.position.lon,
          record.position.lat,
          JSON.stringify(record),
          record.sourceUpdatedAt,
          runStartedAt,
        ],
      );
      counts.created += 1;
      continue;
    }

    // Unchanged: same version, and the run has seen it, so clear any previous
    // absence marker and move on without touching the canonical row.
    if (previous.source_version === record.sourceVersion) {
      await client.query(
        `UPDATE toilet_source_records
            SET last_seen_at = $2, not_seen_since = NULL
          WHERE id = $1`,
        [previous.id, runStartedAt],
      );
      counts.unchanged += 1;
      continue;
    }

    if (previous.toilet_id) {
      await client.query(UPDATE_TOILET, [...canonicalValues(record), previous.toilet_id]);
    }
    await client.query(
      `UPDATE toilet_source_records
          SET source_version = $2, source_url = $3,
              geom = ST_SetSRID(ST_MakePoint($4, $5), 4326)::geography,
              normalized_payload = $6::jsonb, source_updated_at = $7,
              last_seen_at = $8, not_seen_since = NULL
        WHERE id = $1`,
      [
        previous.id,
        record.sourceVersion,
        record.sourceUrl,
        record.position.lon,
        record.position.lat,
        JSON.stringify(record),
        record.sourceUpdatedAt,
        runStartedAt,
      ],
    );
    counts.updated += 1;
  }

  // Anything this source has that the run did not see. Marked, never deleted.
  const absent = await client.query(
    `UPDATE toilet_source_records
        SET not_seen_since = $2
      WHERE source_name = $1
        AND last_seen_at < $2
        AND not_seen_since IS NULL`,
    [sourceName, runStartedAt],
  );
  counts.notSeen = absent.rowCount ?? 0;

  return counts;
}

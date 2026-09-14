import type { PoolClient } from 'pg';
import {
  findCrossSourceSpatialCandidates,
  insertDedupCandidate,
} from '@/db/queries/dedup-candidates';
import type { NormalizedSourceRecord } from '@/lib/toilets/normalized-source-record';
import { decideMatch, SPATIAL_CANDIDATE_RADIUS_METERS } from './dedup';
import { FALLBACK_TOILET_NAME } from './fallback-name';

export { FALLBACK_TOILET_NAME };

/**
 * Writes normalised source records into the database.
 *
 * Source-agnostic: a second source calls this the same way OSM does. It is
 * NOT unmodified-reuse-proof against duplicates on its own — an earlier
 * version of this comment claimed it was, which did not survive actually
 * building `TASK-022`'s matching requirement. Deciding whether a brand-new
 * source record belongs to an existing canonical toilet is
 * `lib/ingest/dedup.ts`'s job (`docs/adr/0017-cross-source-deduplication.md`),
 * called from the `!previous` branch below.
 *
 * It implements the identity and change-detection rules in
 * `docs/contracts/osm-toilets-source.md` section 5.
 *
 * What it never does: delete a source record, delete a canonical toilet, or
 * change a toilet's status because a source stopped listing it. An element that
 * disappears is marked `not_seen_since` and nothing else. Deciding a facility is
 * gone needs more evidence than one absent row.
 */

export interface UpsertCounts {
  fetched: number;
  /** A new canonical toilet was created — no cross-source candidate existed. */
  created: number;
  updated: number;
  unchanged: number;
  notSeen: number;
  /** Linked to an existing, differently-sourced toilet; that toilet's own
   * columns were not touched (docs/adr/0017, "conflict surfaced, not
   * silently resolved"). */
  merged: number;
  /** Inserted with `toilet_id = NULL`, pending review in `dedup_candidates`. */
  flaggedForReview: number;
}

/** Canonical columns this task can derive from one source record. */
function canonicalValues(record: NormalizedSourceRecord) {
  return [
    record.name ?? FALLBACK_TOILET_NAME,
    record.position.lon,
    record.position.lat,
    record.accessType,
    record.accessRaw,
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
    name, geom, access_type, access_raw, price_state, price_amount_minor, currency,
    wheelchair, changing_table, male, female, unisex,
    opening_hours_raw, open_24h, opening_hours_normalized, level, indoor, verified_at, payment_methods
  ) VALUES (
    $1, ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography, $4, $5, $6, $7, $8,
    $9, $10, $11, $12, $13,
    $14, $15, $16::jsonb, $17, $18, $19, $20::jsonb
  )
  RETURNING id`;

const UPDATE_TOILET = `
  UPDATE toilets SET
    name = $1,
    geom = ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography,
    access_type = $4, access_raw = $5, price_state = $6, price_amount_minor = $7, currency = $8,
    wheelchair = $9, changing_table = $10, male = $11, female = $12, unisex = $13,
    opening_hours_raw = $14, open_24h = $15, opening_hours_normalized = $16::jsonb,
    level = $17, indoor = $18, verified_at = $19,
    payment_methods = $20::jsonb
  WHERE id = $21`;

/**
 * Decides how a source record `upsertSourceRecords` has never seen before
 * relates to any existing, differently-sourced toilet nearby
 * (`docs/adr/0017-cross-source-deduplication.md`): a brand new canonical
 * toilet, a confident link to an existing one (never touching that
 * toilet's own columns), or an ambiguous match left unlinked
 * (`toilet_id = NULL`) and flagged in `dedup_candidates` for later review.
 */
async function resolveCanonicalToilet(
  client: PoolClient,
  sourceName: string,
  record: NormalizedSourceRecord,
  counts: UpsertCounts,
): Promise<{
  toiletId: string | null;
  ambiguousCandidates: { toiletId: string; score: number }[];
}> {
  const candidates = await findCrossSourceSpatialCandidates(client, {
    position: record.position,
    radiusMeters: SPATIAL_CANDIDATE_RADIUS_METERS,
    excludeSourceName: sourceName,
  });

  const decision = decideMatch(record.name, candidates);

  if (decision.kind === 'new') {
    const toilet = await client.query<{ id: string }>(INSERT_TOILET, canonicalValues(record));
    counts.created += 1;
    return { toiletId: toilet.rows[0]?.id ?? null, ambiguousCandidates: [] };
  }

  if (decision.kind === 'merge') {
    counts.merged += 1;
    return { toiletId: decision.toiletId, ambiguousCandidates: [] };
  }

  counts.flaggedForReview += 1;
  return { toiletId: null, ambiguousCandidates: decision.candidates };
}

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
    merged: 0,
    flaggedForReview: 0,
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
      const { toiletId, ambiguousCandidates } = await resolveCanonicalToilet(
        client,
        sourceName,
        record,
        counts,
      );

      const inserted = await client.query<{ id: string }>(
        `INSERT INTO toilet_source_records (
           source_name, source_record_id, source_version, toilet_id, source_url,
           geom, raw_payload, normalized_payload, source_updated_at,
           first_seen_at, last_seen_at
         ) VALUES (
           $1, $2, $3, $4, $5,
           ST_SetSRID(ST_MakePoint($6, $7), 4326)::geography, NULL, $8::jsonb, $9,
           $10, $10
         )
         RETURNING id`,
        [
          sourceName,
          record.sourceRecordId,
          record.sourceVersion,
          toiletId,
          record.sourceUrl,
          record.position.lon,
          record.position.lat,
          JSON.stringify(record),
          record.sourceUpdatedAt,
          runStartedAt,
        ],
      );

      const sourceRecordId = inserted.rows[0]?.id;
      if (sourceRecordId) {
        for (const candidate of ambiguousCandidates) {
          await insertDedupCandidate(client, {
            sourceRecordId,
            candidateToiletId: candidate.toiletId,
            matchScore: candidate.score,
          });
        }
      }

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

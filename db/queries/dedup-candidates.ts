import type { PoolClient } from 'pg';
import type { SpatialCandidate } from '@/lib/ingest/dedup';

/**
 * Cross-source spatial lookups for `lib/ingest/upsert.ts` (TASK-022,
 * `docs/adr/0017-cross-source-deduplication.md`). Thin, like
 * `db/queries/nearby.ts`: the matching decision itself lives in
 * `lib/ingest/dedup.ts`, this only reads and writes.
 */

/**
 * Toilets already backed by a source other than `excludeSourceName`,
 * within `radiusMeters` of `position` — never toilets backed only by the
 * same source, so a same-source element never triggers cross-source
 * matching (the ADR's own provable-unaffected guarantee for today's
 * single-source ingestion).
 */
export async function findCrossSourceSpatialCandidates(
  client: PoolClient,
  params: {
    position: { lat: number; lon: number };
    radiusMeters: number;
    excludeSourceName: string;
  },
): Promise<SpatialCandidate[]> {
  const result = await client.query<{ id: string; name: string; distance_meters: number }>(
    `SELECT DISTINCT ON (t.id) t.id, t.name,
       ST_Distance(t.geom, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography) AS distance_meters
     FROM toilets t
     JOIN toilet_source_records s ON s.toilet_id = t.id
     WHERE s.source_name != $3
       AND ST_DWithin(t.geom, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $4)
     ORDER BY t.id, distance_meters ASC`,
    [params.position.lon, params.position.lat, params.excludeSourceName, params.radiusMeters],
  );

  return result.rows
    .map((row) => ({
      toiletId: row.id,
      name: row.name,
      distanceMeters: Number(row.distance_meters),
    }))
    .sort((a, b) => a.distanceMeters - b.distanceMeters);
}

export interface InsertDedupCandidateParams {
  sourceRecordId: string;
  candidateToiletId: string;
  matchScore: number;
}

export async function insertDedupCandidate(
  client: PoolClient,
  params: InsertDedupCandidateParams,
): Promise<void> {
  await client.query(
    `INSERT INTO dedup_candidates (source_record_id, candidate_toilet_id, match_score)
     VALUES ($1, $2, $3)`,
    [params.sourceRecordId, params.candidateToiletId, params.matchScore],
  );
}

-- Up Migration

-- TASK-022: cross-source dedup candidates awaiting review
-- (docs/adr/0017-cross-source-deduplication.md). A row exists only for a
-- source record that matched an existing, differently-sourced toilet
-- closely enough to be plausible but not closely enough to auto-merge
-- (lib/ingest/dedup.ts). That source record's own toilet_id stays NULL
-- (already nullable since the original schema) until a candidate here is
-- resolved by a later moderation task.
CREATE TYPE dedup_candidate_status AS ENUM ('pending', 'reviewed');

CREATE TABLE dedup_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_record_id uuid NOT NULL REFERENCES toilet_source_records(id),
  candidate_toilet_id uuid NOT NULL REFERENCES toilets(id),
  match_score smallint NOT NULL CHECK (match_score BETWEEN 0 AND 100),
  status dedup_candidate_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX dedup_candidates_source_record_id_idx ON dedup_candidates (source_record_id);
CREATE INDEX dedup_candidates_status_idx ON dedup_candidates (status);

-- Down Migration

DROP TABLE dedup_candidates;
DROP TYPE dedup_candidate_status;

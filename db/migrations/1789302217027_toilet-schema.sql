-- Up Migration

-- TASK-003: canonical toilet schema and provenance tables.
--
-- Implements ARCHITECTURE.md 5.1, 5.2 and 5.4. Departures from the suggested
-- field list are recorded in docs/adr/0003-toilet-schema.md. `toilet_reports`
-- (5.3) is deliberately not created here; it belongs to the report task.
--
-- Conventions:
-- - unknown is NULL; no column defaults an unknown to false, 0 or a sentinel
--   where NULL is the representation;
-- - enumerated values are text with CHECK constraints rather than enum types,
--   so a later task can widen a set with a plain ALTER;
-- - `updated_at` is maintained by a trigger, never by callers.

CREATE FUNCTION gdziekibel_set_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- 5.1 Canonical toilet: the real-world facility the product shows.
CREATE TABLE toilets (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                     text UNIQUE,
  name                     text NOT NULL,
  address                  text,
  district                 text,
  -- WGS84 point as geography so ST_DWithin/ST_Distance work in metres.
  geom                     geography(Point, 4326) NOT NULL,
  -- Access class as the sources express it. NULL = unknown.
  access_type              text
                           CHECK (access_type IN ('public', 'customers', 'permissive', 'private', 'no')),
  -- Derived convenience flag; NULL when access_type is unknown.
  public_access            boolean,
  -- 'unknown' is an explicit value here because ARCHITECTURE.md 5.1 lists it
  -- as one; it is the only column where unknown is not NULL.
  price_state              text NOT NULL DEFAULT 'unknown'
                           CHECK (price_state IN ('free', 'paid', 'unknown')),
  price_amount_minor       integer CHECK (price_amount_minor >= 0),
  currency                 char(3) CHECK (currency ~ '^[A-Z]{3}$'),
  open_24h                 boolean,
  opening_hours_raw        text,
  opening_hours_normalized jsonb,
  -- Three-state facilities: 'limited' exists in the sources and must not be
  -- collapsed into yes/no. NULL = unknown.
  wheelchair_accessible    text CHECK (wheelchair_accessible IN ('yes', 'no', 'limited')),
  baby_changing            text CHECK (baby_changing IN ('yes', 'no', 'limited')),
  unisex                   boolean,
  seasonal                 boolean,
  canonical_status         text NOT NULL DEFAULT 'active'
                           CHECK (canonical_status IN ('active', 'temporarily_closed', 'removed')),
  confidence_level         text CHECK (confidence_level IN ('high', 'medium', 'low')),
  confidence_score         smallint CHECK (confidence_score BETWEEN 0 AND 100),
  verified_at              timestamptz,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),
  -- A paid toilet may have an unknown amount, but an amount needs a currency.
  CONSTRAINT toilets_price_amount_needs_currency
    CHECK (price_amount_minor IS NULL OR currency IS NOT NULL)
);

CREATE INDEX toilets_geom_gist ON toilets USING gist (geom);

CREATE TRIGGER toilets_set_updated_at
  BEFORE UPDATE ON toilets
  FOR EACH ROW EXECUTE FUNCTION gdziekibel_set_updated_at();

-- 5.2 Source records: what one source says about one facility. Every source
-- record survives reconciliation unchanged; only the canonical row is merged.
CREATE TABLE toilet_source_records (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Source names fixed by docs/contracts/toilet-sources.md. 'warsaw-city' is
  -- reserved and has no adapter until its dataset is verified.
  source_name            text NOT NULL
                         CHECK (source_name IN ('osm', 'metro-rule', 'hub-curated', 'warsaw-city')),
  source_record_id       text NOT NULL,
  -- NULL until reconciliation links the record to a canonical toilet. If the
  -- canonical row is deleted the provenance stays and is simply unlinked.
  toilet_id              uuid REFERENCES toilets (id) ON DELETE SET NULL,
  -- The contract requires a URL a person can open, so this is NOT NULL.
  source_url             text NOT NULL,
  -- Source element as received; NULL only where licensing forbids keeping it.
  raw_payload            jsonb,
  -- The SourceToiletRecord shape from lib/toilets/source-record.ts.
  normalized_payload     jsonb NOT NULL,
  -- Timestamp the source gives for the record, if any.
  source_updated_at      timestamptz,
  fetched_at             timestamptz NOT NULL,
  source_confidence      smallint CHECK (source_confidence BETWEEN 0 AND 100),
  -- Set when the record was present in an earlier snapshot and absent from a
  -- later one (contract section 2, "Removal"). Cleared if it reappears.
  missing_since          timestamptz,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT toilet_source_records_source_key UNIQUE (source_name, source_record_id)
);

-- Index for the foreign key: reconciliation reads "all records for toilet X".
CREATE INDEX toilet_source_records_toilet_id_idx ON toilet_source_records (toilet_id);

CREATE TRIGGER toilet_source_records_set_updated_at
  BEFORE UPDATE ON toilet_source_records
  FOR EACH ROW EXECUTE FUNCTION gdziekibel_set_updated_at();

-- 5.4 One row per adapter run. Counts are NULL until the run reports them;
-- error_summary is a short message, never a log.
CREATE TABLE ingestion_runs (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_name         text NOT NULL
                      CHECK (source_name IN ('osm', 'metro-rule', 'hub-curated', 'warsaw-city')),
  started_at          timestamptz NOT NULL DEFAULT now(),
  finished_at         timestamptz,
  status              text NOT NULL DEFAULT 'running'
                      CHECK (status IN ('running', 'succeeded', 'failed')),
  records_fetched     integer CHECK (records_fetched >= 0),
  records_created     integer CHECK (records_created >= 0),
  records_updated     integer CHECK (records_updated >= 0),
  records_unchanged   integer CHECK (records_unchanged >= 0),
  duplicates_found    integer CHECK (duplicates_found >= 0),
  ambiguous_matches   integer CHECK (ambiguous_matches >= 0),
  error_summary       text CHECK (char_length(error_summary) <= 2000),
  CONSTRAINT ingestion_runs_finished_after_start
    CHECK (finished_at IS NULL OR finished_at >= started_at),
  CONSTRAINT ingestion_runs_running_has_no_end
    CHECK (status <> 'running' OR finished_at IS NULL)
);

-- Down Migration

-- Drops exactly what the up migration created, in reverse dependency order.
DROP TABLE ingestion_runs;
DROP TABLE toilet_source_records;
DROP TABLE toilets;
DROP FUNCTION gdziekibel_set_updated_at();

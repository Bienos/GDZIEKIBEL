-- Up Migration

-- TASK-003: canonical toilet schema and provenance tables.
--
-- Follows ARCHITECTURE.md section 5 with the changes recorded in
-- docs/adr/0004-schema-conventions.md. The rule that shapes every column:
-- unknown is a value. Nothing here defaults to no, free or open.

-- Enumerated types. Each has an explicit 'unknown' member where the product
-- must never infer a value from absence. TypeScript mirrors these lists in
-- lib/toilets/types.ts and a test keeps the two in step.

CREATE TYPE access_type AS ENUM (
  'public_unconditional',
  'public_paid',
  'customers_only',
  'purchase_required',
  'ask_staff',
  'key_required',
  'code_required',
  'ticket_required',
  'not_public',
  'unknown'
);

CREATE TYPE price_state AS ENUM ('free', 'paid', 'unknown');

CREATE TYPE feature_state AS ENUM ('yes', 'no', 'limited', 'unknown');

CREATE TYPE canonical_status AS ENUM ('active', 'temporarily_closed', 'removed');

CREATE TYPE confidence_level AS ENUM ('high', 'medium', 'low');

CREATE TYPE ingestion_run_status AS ENUM ('running', 'succeeded', 'failed');

-- updated_at is maintained here, not by application code, so no caller can
-- forget it.
CREATE FUNCTION set_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END
$$;

-- The canonical, user-facing toilet. One row per real-world facility.
CREATE TABLE toilets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE,
  name text NOT NULL,
  address text,
  district text,

  -- Where the facility is. Geography, so distances are metres.
  geom geography(Point, 4326) NOT NULL,
  -- Where to walk to when that differs from the facility itself: a building
  -- entrance, a station concourse door. Null when not known.
  entrance_geom geography(Point, 4326),
  -- Human guidance for the last hundred metres. Null when not known.
  finding_note text,
  level text,
  -- NULL means unknown. No default on purpose.
  indoor boolean,

  access_type access_type NOT NULL DEFAULT 'unknown',
  access_note text,

  price_state price_state NOT NULL DEFAULT 'unknown',
  price_amount_minor integer CHECK (price_amount_minor IS NULL OR price_amount_minor >= 0),
  currency char(3),
  -- Normalised later by TASK-014. Null until then.
  payment_methods jsonb,

  -- NULL means unknown. Derived by TASK-013, never set from absence.
  open_24h boolean,
  opening_hours_raw text,
  opening_hours_normalized jsonb,
  -- NULL means unknown. Seasonality is a separate fact from status.
  seasonal boolean,

  wheelchair feature_state NOT NULL DEFAULT 'unknown',
  changing_table feature_state NOT NULL DEFAULT 'unknown',
  male feature_state NOT NULL DEFAULT 'unknown',
  female feature_state NOT NULL DEFAULT 'unknown',
  unisex feature_state NOT NULL DEFAULT 'unknown',

  canonical_status canonical_status NOT NULL DEFAULT 'active',
  confidence_level confidence_level NOT NULL DEFAULT 'low',
  confidence_score smallint CHECK (confidence_score IS NULL OR (confidence_score BETWEEN 0 AND 100)),
  verified_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX toilets_geom_gix ON toilets USING GIST (geom);

CREATE TRIGGER toilets_set_updated_at
  BEFORE UPDATE ON toilets
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- What one source says about one facility. Many rows may point at one toilet.
-- Rows are never deleted when a source stops listing something; they are
-- marked not_seen_since, per docs/contracts/osm-toilets-source.md section 5.
CREATE TABLE toilet_source_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_name text NOT NULL,
  source_record_id text NOT NULL,
  -- The source's own version marker, when it has one. OSM: element version.
  source_version text,
  toilet_id uuid REFERENCES toilets(id) ON DELETE SET NULL,
  source_url text,
  -- The source's own position, kept separately from the canonical one so
  -- dedup can compare candidates and conflicts stay explainable.
  geom geography(Point, 4326),
  raw_payload jsonb,
  normalized_payload jsonb NOT NULL,
  source_updated_at timestamptz,
  source_confidence smallint CHECK (source_confidence IS NULL OR (source_confidence BETWEEN 0 AND 100)),
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  not_seen_since timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_name, source_record_id),
  CHECK (source_name <> ''),
  CHECK (source_record_id <> '')
);

CREATE INDEX toilet_source_records_toilet_id_idx ON toilet_source_records (toilet_id);
-- Justified by ARCHITECTURE.md section 14 step 1: nearby spatial candidate match.
CREATE INDEX toilet_source_records_geom_gix ON toilet_source_records USING GIST (geom);

CREATE TRIGGER toilet_source_records_set_updated_at
  BEFORE UPDATE ON toilet_source_records
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- One row per import run. Counts only; never raw logs.
CREATE TABLE ingestion_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_name text NOT NULL,
  status ingestion_run_status NOT NULL DEFAULT 'running',
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  records_fetched integer NOT NULL DEFAULT 0,
  records_created integer NOT NULL DEFAULT 0,
  records_updated integer NOT NULL DEFAULT 0,
  records_unchanged integer NOT NULL DEFAULT 0,
  records_rejected integer NOT NULL DEFAULT 0,
  duplicates_flagged integer NOT NULL DEFAULT 0,
  error_summary text,
  CHECK (source_name <> ''),
  CHECK (finished_at IS NULL OR finished_at >= started_at)
);

CREATE INDEX ingestion_runs_source_started_idx ON ingestion_runs (source_name, started_at DESC);

-- Down Migration

DROP TABLE ingestion_runs;
DROP TABLE toilet_source_records;
DROP TABLE toilets;
DROP FUNCTION set_updated_at();
DROP TYPE ingestion_run_status;
DROP TYPE confidence_level;
DROP TYPE canonical_status;
DROP TYPE feature_state;
DROP TYPE price_state;
DROP TYPE access_type;

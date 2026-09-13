-- Up Migration

-- TASK-019: computed confidence needs the source's own raw access tag,
-- kept apart from access_type (lib/ingest/osm/normalize.ts's own comment:
-- "the raw value is kept so TASK-019 can lower confidence for it"). NULL
-- means the source gave no access value, distinct from an access value the
-- contract could not classify.
ALTER TABLE toilets ADD COLUMN access_raw text;

-- Down Migration

ALTER TABLE toilets DROP COLUMN access_raw;

-- Up Migration

-- Baseline migration for TASK-001.
--
-- It only enables the geospatial extension the architecture depends on.
-- No product-domain tables are created here: toilet/report/source schema is
-- owned by later tasks (ARCHITECTURE.md 5).
--
-- Requires a database role permitted to create extensions. On managed Postgres
-- (Neon) PostGIS must be available on the selected plan.
CREATE EXTENSION IF NOT EXISTS postgis;

-- Down Migration

-- Deliberately a no-op.
--
-- Dropping PostGIS would be a destructive change affecting every geometry
-- column in the database, and AGENTS.md requires destructive changes to be in
-- explicit task scope. Re-running the up migration is safe and idempotent.
SELECT 1;

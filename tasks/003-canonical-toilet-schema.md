# TASK-003 — Canonical toilet schema + first source contract

## Goal

Create the database schema that can hold Warsaw toilets from the first source,
and the code-level contract an ingestion adapter must satisfy to write into it.

At completion, a migration applied to an empty PostGIS database produces the
canonical `toilets` table, the `toilet_source_records` table and the
`ingestion_runs` table, and a TypeScript schema defines the normalised record an
adapter emits. Nothing is ingested. No API reads the tables.

## User-visible outcome

None. The live site is unchanged.

## Acceptance criteria

### Schema

- One versioned SQL migration creates, with reversible down steps:
  - enumerated types for access type, price state, feature state, canonical
    status, confidence level and ingestion run status;
  - `toilets`, the canonical record, following `ARCHITECTURE.md` section 5.1 and
    the consequences in `docs/adr/0003-first-data-source.md` section 7;
  - `toilet_source_records`, following section 5.2 and the identity and change
    detection rules in `docs/contracts/osm-toilets-source.md` section 5;
  - `ingestion_runs`, following section 5.4;
  - a GiST index on `toilets.geom` and on `toilet_source_records.geom`, the
    latter justified by the dedup candidate search in section 14;
  - `updated_at` maintained by trigger, not by application code.
- **Unknown is a value.** Every attribute the product must never collapse into
  `no`, `free` or `open` is an enumerated type with an explicit `unknown`
  member and that member as its default. No boolean column defaults to
  `false`. Where a plain boolean is kept, `NULL` means unknown and the column
  has no default.
- `toilet_reports` is **not** created. It belongs to TASK-020, and
  `AGENTS.md` forbids speculative product schema.
- Deviations from the field list in `ARCHITECTURE.md` section 5.1 are recorded
  in an ADR with the reason for each.

### Adapter contract in code

- A Zod schema in `lib/toilets/` defines the normalised source record an
  adapter emits, matching `docs/contracts/osm-toilets-source.md` section 6
  field for field.
- The schema is strict: unknown keys are rejected, and every field is required
  so an adapter must state `unknown` explicitly rather than omit a field and
  have it defaulted. A test proves that omitting a feature field fails
  validation.
- Coordinates are range-checked. A coarse Warsaw bounding-box helper exists in
  `lib/geo/` and is documented as coarse; the administrative boundary check
  belongs to TASK-004.
- Enumerated values are defined once in TypeScript and mirror the SQL types
  member for member. A test proves the two lists agree.

### Verification against a real database

Integration tests run against PostGIS and prove:

- the migration applies to an empty database and the three tables exist;
- a toilet inserted with only the required columns reads back with
  `access_type`, `price_state`, `wheelchair` and `changing_table` equal to
  `unknown`, not `no` or `free`;
- an invalid enum member is rejected;
- `ST_DWithin` on `geom` finds a toilet inside the radius and not one outside;
- the unique constraint on (`source_name`, `source_record_id`) rejects a
  duplicate;
- `updated_at` changes on update without the application setting it;
- the down migration removes everything the up migration created.

## In scope

- the migration and its down steps;
- the enumerated types and their TypeScript mirror;
- the normalised source record schema and coarse geo helper;
- unit and integration tests for the above;
- an ADR recording schema conventions and deviations from the architecture;
- `docs/CODEMAP.md` and `PROGRESS.md` updates.

## Out of scope

Do **not**:

- write the OpenStreetMap adapter or any ingestion code, which TASK-004 owns;
- write `db/queries/` for the nearby search, which TASK-007 owns;
- create `toilet_reports`, which TASK-020 owns;
- parse opening hours, which TASK-013 owns;
- implement deduplication logic, which TASK-022 owns;
- compute confidence scores, which TASK-019 owns;
- seed any data, including the hand-curated anchor layer;
- touch the UI.

## Canonical context to read

- `AGENTS.md`
- `PROGRESS.md`
- `ARCHITECTURE.md` sections 5, 6, 14 and 19
- `PRODUCT.md` sections 8, 9 and 10
- `docs/adr/0001-foundation-stack.md`
- `docs/adr/0003-first-data-source.md`, section 7 in particular
- `docs/contracts/osm-toilets-source.md`, sections 4 to 7
- `docs/research/2026-09-13-warsaw-toilet-sources.md`, section 5 only

## Likely relevant code

- `db/migrations/1789277236377_enable-postgis.sql`, the baseline to build on
- `db/client.ts`, the pool the integration tests use
- `tests/integration/postgis.test.ts`, the pattern to follow
- `lib/env/server.ts`, for how configuration is read

## Constraints

- Migrations are plain SQL via `node-pg-migrate`, per ADR 0001.
- The down migration must be a true inverse. Dropping tables this migration
  created is in scope; dropping PostGIS is not.
- No ORM. No schema tool other than the migration runner.
- OSM-derived rows must remain identifiable by `source_name`, per ADR 0003
  section 5, so the share-alike designs stay open.
- Do not store OSM usernames anywhere.
- Do not add dependencies.

## Verification

Run and record:

- `pnpm lint`, `pnpm format:check`, `pnpm typecheck`
- `pnpm test:unit`
- `pnpm db:migrate` from an empty database, then `pnpm db:check`
- `pnpm test:integration`
- `pnpm db:migrate:down` once, then `pnpm db:migrate` again, proving the
  round trip
- `pnpm build`
- inspect the complete git diff

## Definition of done

TASK-003 is complete only when:

- every acceptance criterion is satisfied with observed evidence;
- the migration round-trips on a real PostGIS database;
- no ingestion, query, report or UI code exists that this task did not have to
  create;
- the ADR records every deviation from `ARCHITECTURE.md` section 5;
- `docs/CODEMAP.md` and `PROGRESS.md` reflect the repository;
- the complete diff contains no unrelated changes.

Then stop. Do not begin TASK-004.

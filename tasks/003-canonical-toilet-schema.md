# TASK-003 — Canonical toilet schema + first source contract

## Goal

Create the versioned database schema and the typed, validated source-record
contract that TASK-004 needs to ingest the first selected sources
(OpenStreetMap extract, metro rule, curated hub layer) without further schema
work.

At completion, `pnpm db:migrate` on an empty PostGIS database produces the
canonical toilet, source-record and ingestion-run tables, and the source
contract in `docs/contracts/toilet-sources.md` has one executable definition in
code that rejects invalid records and never turns a missing value into `false`.

## User-visible outcome

None. No page, API or map changes. The shell from TASK-001 is unchanged.

## Acceptance criteria

### Migrations

One new SQL migration in `db/migrations/`, applied by `pnpm db:migrate`, that
creates:

- `toilets` — the canonical record from `ARCHITECTURE.md` 5.1, with a
  `geography(Point, 4326)` position and a GiST index on it. Three-state
  facility fields (wheelchair, changing table, unisex) must be able to
  represent `yes`, `no`, `limited` where the sources provide it, and unknown
  as `NULL`. Status and confidence values are constrained to the listed sets.
- `toilet_source_records` — `ARCHITECTURE.md` 5.2, with
  `unique (source_name, source_record_id)`, a nullable reference to `toilets`,
  the raw payload, the normalised payload and the provenance timestamps.
- `ingestion_runs` — `ARCHITECTURE.md` 5.4, with counts and an error summary,
  and no raw log storage.

Rules:

- `updated_at` is maintained by the database, not by callers.
- The down migration drops exactly what the up migration created, in reverse
  order, and nothing else.
- No data is inserted by the migration.
- No index beyond the GiST index and the unique/foreign keys unless the task
  file below names it.

### Source-record contract in code

- A module under `lib/toilets/` defines the `SourceToiletRecord` from
  `docs/contracts/toilet-sources.md` section 1 as a Zod schema and inferred
  type, including the `source_name` set (`osm`, `metro-rule`, `hub-curated`,
  reserved `warsaw-city`), the enumerated `access`, `fee`, `wheelchair`,
  `changing_table`, `unisex`, `position_kind`, `opening_hours_format` and
  `licence` values, and the rule that unknown is `null`.
- Parsing rejects: a missing `source_url`, a position outside WGS84 bounds, a
  `fee` value that is not in the set, and any boolean-like field supplied as a
  string.
- Parsing does not default any nullable field; an omitted optional field
  parses to `null` only where the contract says unknown is `null`, and the
  test proves no field becomes `false` when absent.
- The module imports nothing from `db/`, `app/` or Next.js.

### Verification code

- Unit tests for the contract module under `tests/unit/`.
- An integration test under `tests/integration/` that, against a real
  PostGIS database with migrations applied: inserts a toilet with a Warsaw
  position and reads its distance to a nearby point with `ST_DWithin`;
  proves the unique constraint on `(source_name, source_record_id)`; proves
  a `NULL` facility value stays `NULL` on read; proves the check constraints
  reject an out-of-set status; and cleans up what it inserted.

### Documentation/state

- `docs/adr/0003-toilet-schema.md` records any place the created schema
  departs from the "suggested fields" in `ARCHITECTURE.md` 5, and why.
- `docs/contracts/toilet-sources.md` gains a pointer to the code module and
  to the table each record lands in; its field definitions do not change
  unless the code proves one unworkable, in which case the change is recorded
  in the ADR.
- `docs/CODEMAP.md` lists the new modules.
- `PROGRESS.md` records commands run and observed results.

## In scope

- the migration above;
- the contract module and its tests;
- the integration test;
- ADR 0003, CODEMAP, PROGRESS, README migration note if the workflow changed.

## Out of scope

Do **not**:

- create `toilet_reports` (owned by the report task in Milestone 2);
- write any adapter, fetcher, extract processing, matching or reconciliation
  logic (TASK-004);
- write the nearby API, ranking or opening-hours parsing (TASK-007, 009, 010);
- add `db/queries/` helpers beyond what the integration test needs inline;
- add runtime dependencies;
- populate any table with sample or real data;
- change `ARCHITECTURE.md`, `PRODUCT.md`, `DESIGN.md` or `BRAND.md`.

## Canonical context to read

- `AGENTS.md`
- `PROGRESS.md`
- `ARCHITECTURE.md` sections 4, 5, 6, 19
- `docs/adr/0001-foundation-stack.md`
- `docs/adr/0002-toilet-data-sources.md` sections D1, D7
- `docs/contracts/toilet-sources.md`

Do not read the brand or design libraries.

## Likely relevant code

- `db/migrations/1789277236377_enable-postgis.sql` — migration format.
- `db/client.ts`, `db/postgis.ts` — pool and PostGIS status reader.
- `tests/integration/postgis.test.ts` — integration test pattern and skip rule.
- `lib/env/server.ts`, `tests/unit/env.test.ts` — Zod usage pattern.

## Constraints

- Unknown is `NULL`. No column may default an unknown to `false`, `0` or
  `'unknown'` where `NULL` is the contract's representation.
- Every value class the sources can express (`limited`, `designated`,
  `permissive`, `customers`) must be storable without loss, either in the
  canonical column or in the source record's normalised payload.
- Plain SQL, reviewable, with comments explaining non-obvious choices.
- Keep the migration additive; the down migration is the only destructive
  statement set and it is scoped to the objects created here.
- Do not store precise user location anywhere. (No user table, no report
  table in this task.)

## Read-only preflight

1. inspect `git status` and the current diff;
2. confirm the migration tooling and the format of the baseline migration;
3. confirm a PostGIS database is reachable, or record that it is not;
4. confirm the contract file's field list before typing the schema.

## Verification

Run and record:

- `pnpm lint`
- `pnpm format:check`
- `pnpm typecheck`
- `pnpm test:unit`
- `pnpm db:migrate` on an empty database, then `pnpm db:migrate:down`, then
  `pnpm db:migrate` again (proves the down migration is complete)
- `pnpm db:check`
- `pnpm test:integration`
- `pnpm build`

Also inspect the complete git diff.

## Definition of done

TASK-003 is complete only when:

- every acceptance criterion is satisfied or recorded as a blocker with the
  reason;
- migrations apply, roll back and re-apply cleanly on an empty PostGIS
  database, observed;
- the contract module rejects the listed invalid inputs, observed by tests;
- ADR 0003 exists and disagrees with nothing in `ARCHITECTURE.md` that is a
  rule rather than a suggestion;
- `PROGRESS.md` states what was run and what was observed;
- no adapter, API, UI or report code exists;
- the complete diff contains no unrelated changes.

Then stop. Do not begin TASK-004.

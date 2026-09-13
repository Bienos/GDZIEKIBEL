# ADR 0003 — Canonical toilet schema

Status: Accepted
Date: 2026-09-13
Scope: TASK-003 — Canonical toilet schema + first source contract

## Context

`ARCHITECTURE.md` 5 gives "suggested fields" for `toilets`,
`toilet_source_records`, `toilet_reports` and `ingestion_runs`.
`docs/contracts/toilet-sources.md` (ADR 0002) fixes what the first sources
provide, including values the suggested field list cannot hold without loss:
`limited` for wheelchair access and changing tables, and a `source_url` that is
required rather than optional. Migration `1789302217027_toilet-schema.sql`
creates the schema; this ADR records where it departs from the suggestions and
why.

## Decisions

### Text with CHECK constraints instead of enum types

Every enumerated column is `text` with a `CHECK (… IN (…))`. Postgres enum
types cannot drop a value and need `ALTER TYPE` to add one; a CHECK constraint
is a plain, reviewable DDL change. The sets are exactly those in
`ARCHITECTURE.md` 5.1 and the contract.

### Three-state facility columns

`wheelchair_accessible` and `baby_changing` are `text` in `('yes','no','limited')`
rather than `boolean`. Observed OSM data uses `limited` (14 elements in the
Warsaw bounding box on 2026-09-13), the research and ADR 0002 D7 require it to
be preserved, and a boolean cannot hold it. `NULL` stays unknown. `unisex`
remains `boolean` because no source expresses a third state for it.

OSM's `wheelchair=designated` is not a canonical value; it is kept in the
source record's normalised payload and maps to `yes` on the canonical row.

### `price_state` keeps an explicit `'unknown'`

`ARCHITECTURE.md` 5.1 lists `price_state enum('free','paid','unknown')`, so
this is the one column where unknown is a value, with `DEFAULT 'unknown'`.
`price_amount_minor` may be `NULL` for a paid toilet whose price is unknown; an
amount without a currency is rejected.

### `access_type` and `public_access` both exist

`access_type` holds the source-expressed class (`public`, `customers`,
`permissive`, `private`, `no`) and is the column of record. `public_access` is
the derived convenience flag the architecture suggests, `NULL` whenever
`access_type` is `NULL`. Nothing derives it yet; TASK-004 owns the derivation.

### `source_url` is NOT NULL

The contract says a record without a URL a person can open is invalid; the
column follows the contract rather than the suggested `null`.

### `missing_since` on source records

Added to `toilet_source_records` for the contract's removal rule: a record
present in an earlier snapshot and absent from the current one is flagged, not
deleted, and the canonical status is not changed automatically.

### `updated_at` by trigger

One `plpgsql` function, `gdziekibel_set_updated_at`, and a `BEFORE UPDATE`
trigger on `toilets` and `toilet_source_records`. Callers cannot forget it or
fake it.

### `ON DELETE SET NULL` from source records to toilets

Deleting a canonical toilet unlinks its provenance rather than destroying it.
Source records are the audit trail; they outlive merges.

### Indexes

`toilets_geom_gist` (required by `ARCHITECTURE.md` 5.1) and
`toilet_source_records_toilet_id_idx` (the foreign key's lookup path for
reconciliation). Nothing else, per "normal indexes only where query evidence
justifies them".

### `toilet_reports` is not created

It belongs to the report task. Creating it now would be speculative schema
and would raise the privacy question (`ARCHITECTURE.md` 5.3, 8) before the
task that answers it.

### Counts on `ingestion_runs` are nullable

A run that has not finished has no counts; `NULL` there is unknown, not zero.
Two CHECKs keep the lifecycle honest: a `running` run has no `finished_at`,
and `finished_at` is never before `started_at`. `error_summary` is capped at
2000 characters so the table cannot become a log.

## Consequences

- The `SourceToiletRecord` Zod schema in `lib/toilets/source-record.ts` is
  the `validate` step for every adapter, and its output is what lands in
  `normalized_payload`.
- Widening a value set is a migration that alters one CHECK constraint.
- The down migration drops the three tables and the function and nothing
  else; PostGIS itself is untouched (ADR 0001).

## Not decided here

- Reconciliation and matching rules (`ARCHITECTURE.md` 14): the columns
  exist, the logic does not.
- `opening_hours_normalized` structure: `jsonb` is reserved, its shape is the
  opening-hours task's.
- Derivation of `public_access`, `open_24h`, `confidence_*` from sources.

# ADR 0004 — Schema conventions, and where the schema departs from the architecture

Status: Accepted
Date: 2026-09-13
Scope: TASK-003 — Canonical toilet schema + first source contract
Migration: `db/migrations/1789312508934_toilet-schema.sql`

## 1. Conventions

**Unknown is a value.** Every attribute that PRODUCT.md section 9 forbids
collapsing into `no`, `free` or `open` is an enumerated type with an explicit
`unknown` member, `NOT NULL`, defaulting to `unknown`. A freshly inserted row
therefore says "we do not know" about everything nobody has stated, and no
code path can read absence as a negative. Where a plain boolean is kept
(`indoor`, `open_24h`, `seasonal`), `NULL` means unknown and the column has no
default, so nothing can default it to `false`.

**Enumerated types are mirrored in TypeScript once**, in `lib/toilets/types.ts`,
and `tests/unit/toilets-types.test.ts` reads the migration and fails if the
two lists differ in members or order. The SQL is the source of truth; the test
is the enforcement.

**`updated_at` is set by trigger**, never by application code. A caller cannot
forget it.

**Source records are never deleted by ingestion.** A row whose element
disappears from a pull gets `not_seen_since`. Deleting a canonical toilet
unlinks its source records (`ON DELETE SET NULL`) rather than removing them,
because provenance outlives the decision that a facility is gone.

**OSM-derived rows stay identifiable** by `source_name`, so the two share-alike
designs in `docs/contracts/osm-toilets-source.md` section 9 both remain open.

**Geography, not geometry.** Distances are metres without projection
arithmetic. GiST on both `geom` columns; the second is justified by the dedup
candidate search in ARCHITECTURE.md section 14 step 1.

## 2. Departures from ARCHITECTURE.md section 5

| Architecture | Schema | Reason |
| --- | --- | --- |
| `wheelchair_accessible boolean null` | `wheelchair feature_state`, default `unknown` | sources say `limited`; a boolean cannot, and `NULL` is easy to misread |
| `baby_changing boolean null` | `changing_table feature_state` | same; named after the OSM tag to keep the mapping obvious |
| `unisex boolean null` | `male`, `female`, `unisex`, each `feature_state` | the research's section 5.2 lists all three; one flag cannot express "men only" |
| `public_access boolean null` | dropped | fully covered by `access_type`; a second answer to the same question invites disagreement |
| `access_type enum/text null` | `access_type` enum, `NOT NULL`, default `unknown` | the research's section 1.6 fixes the members; `NULL` would be a second way to say unknown |
| not listed | `entrance_geom`, `finding_note`, `level`, `indoor`, `access_note` | the research's section 3.4: the last hundred metres are a major failure point; nullable, cost nothing until filled |
| not listed | `payment_methods jsonb` | the research's section 3.10: paid is not a single boolean; normalised by TASK-014 |
| `toilet_source_records` as listed | plus `source_version`, `geom`, `first_seen_at`, `last_seen_at`, `not_seen_since` | the contract's section 5: change detection and never-delete semantics need them |
| `toilet_reports` | not created | TASK-020 owns it; AGENTS.md forbids speculative product schema |
| `ingestion_runs` as listed | plus `records_unchanged`, `records_rejected`, a status enum | a run must be able to say it rejected malformed elements, per the contract's section 7 |
| `confidence_level enum` | default `low` | PRODUCT.md section 9: single, uncorroborated data is LOW; a new row is exactly that |
| `canonical_status` | default `active` | a row exists because a source says the facility exists; `removed` is a later decision |

Nothing in section 5 was dropped without a replacement except `public_access`.

## 3. Consequences

- TASK-004 writes to `toilet_source_records` through the Zod schema in
  `lib/toilets/normalized-source-record.ts`, which requires every field and
  rejects unknown keys, so an adapter must state `unknown` on purpose.
- TASK-007 queries `toilets` with `ST_DWithin` on `geom` and filters on
  `canonical_status = 'active'`; the integration test already runs that shape.
- TASK-013 fills `opening_hours_normalized` and `open_24h`; until then both are
  null, which the API must render as unknown.
- TASK-020 adds `toilet_reports` in its own migration.

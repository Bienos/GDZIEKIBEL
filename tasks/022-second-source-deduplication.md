# TASK-022 — Second data source + deduplication

## Goal

`PLAN.md`'s outcome: "a second validated source can be ingested without
creating obvious duplicate toilets; ambiguous matches are surfaced for
review." `ARCHITECTURE.md` section 14 sketches the matching approach.
`docs/adr/0003-first-data-source.md` section 4 deferred the actual second
source (the Warsaw city open-data toilet dataset) from the project's
start.

## No real second source is reachable from this session

This session's environment has no egress to Warsaw city hosts. A fresh
check today (2026-09-14), from the dedicated "GDZIE KIBEL" cloud
environment created specifically with a Warsaw/OSM allowlist, confirmed
`dane.um.warszawa.pl`, `api.um.warszawa.pl`, `overpass-api.de`, and
`iot.warszawa.pl` all still fail (the proxy resets the connection mid-TLS,
code 1006); only `warszawa19115.pl` (the city's contact/report portal, not
a data catalog) responds, and no public-toilets dataset was found there.
`ARCHITECTURE.md` section 14's own words apply directly: "Do not hard-code
an exact distance threshold before inspecting real datasets" — this task
cannot inspect real datasets. `docs/adr/0017-cross-source-deduplication.md`
records this and the decision it forces.

## Design decision: build the matching engine, not a fabricated source

Given no real second source, this task builds the reusable matching/merge
logic — the part of `PLAN.md`'s outcome that does not depend on which
second source eventually arrives — and proves it against directly
constructed `NormalizedSourceRecord` fixtures under a second, clearly
fictional `sourceName` (`'fixture-second-source'`), never invented as if
it were real. No second ingestion adapter is written: there is nothing
real to adapt to yet, and writing one against guessed field names would be
exactly the kind of unvalidated external-data assumption `AGENTS.md`
warns against.

`docs/adr/0017-cross-source-deduplication.md` records the matching design
in full:

- Cross-source matching only ever considers a candidate toilet that
  already has a source record from a **different** `source_name` than the
  incoming one. A same-source element near an existing same-source toilet
  never triggers matching — today's real, single-source (OSM) ingestion
  is provably unaffected, since no toilet has a non-OSM source yet.
- Spatial candidates within `SPATIAL_CANDIDATE_RADIUS_METERS` (30 m, a
  first pass).
- Auto-merge only when a candidate is within `AUTO_MERGE_DISTANCE_METERS`
  (15 m) **and** its name similarity is at least
  `AUTO_MERGE_NAME_SIMILARITY_THRESHOLD` (80) — never on a placeholder
  name (`FALLBACK_TOILET_NAME`) on either side, since matching two
  anonymous "Toaleta" labels proves nothing.
- Anything short of that bar, but still within the spatial radius, is
  **ambiguous**: the new source record is inserted with `toilet_id =
  NULL` (the schema already allows this) and one `dedup_candidates` row
  per candidate records the pairing for later review. No canonical toilet
  is created for an ambiguous record — creating one would itself be an
  "obvious duplicate toilet" risk `PLAN.md` asks to avoid.
- A confident merge links the new source record to the **existing**
  canonical toilet without touching that toilet's own columns.
  `docs/contracts/osm-toilets-source.md`/`ARCHITECTURE.md` section 14's
  rule — "when two sources disagree on a field, both source records are
  kept and the conflict is surfaced, not silently resolved" — means a
  second source's values must never silently overwrite the first source's
  canonical fields on merge.

## User-visible outcome

None yet: this is ingestion-pipeline plumbing with no UI. A future
moderation task can query `dedup_candidates` (status `'pending'`) the same
way a future one could query `toilet_reports` (status `'new'`) — this
task creates the surface, not the review screen.

## Acceptance criteria

- A synthetic second-source record far from every existing toilet creates
  a new canonical toilet, unaffected by matching.
- A synthetic second-source record within the auto-merge distance and
  name-similarity bar links to the existing toilet and does **not**
  create a new one or touch the existing toilet's columns.
- A synthetic second-source record within the spatial radius but below
  the merge bar is inserted with `toilet_id = NULL` and produces a
  `dedup_candidates` row; no new canonical toilet is created for it.
- A real, same-source (OSM) new element near an existing OSM-only toilet
  is completely unaffected: still always creates a new canonical toilet,
  proven by the pre-existing `tests/integration/ingest.test.ts` suite
  passing unmodified.
- All of the above verified against a real PostGIS database.

## In scope

- A migration adding `dedup_candidates` and its status enum.
- `lib/ingest/dedup.ts` (pure: `computeNameSimilarity`, `decideMatch`, the
  named threshold constants).
- `db/queries/dedup-candidates.ts` (`findCrossSourceSpatialCandidates`,
  `insertDedupCandidate`).
- `lib/ingest/upsert.ts`: the `!previous` branch now calls the matching
  logic before deciding whether to create, merge, or flag; `UpsertCounts`
  gains `merged` and `flaggedForReview`; the file's own top comment
  (previously "the second source reuses this without change") is
  corrected — that assumption did not survive contact with the actual
  requirement.
- `docs/adr/0017-cross-source-deduplication.md`.
- `docs/CODEMAP.md` and `PROGRESS.md` updates, including the fresh
  egress-check result.

## Out of scope

Do **not**:

- fabricate a second ingestion adapter against a guessed schema for a
  source this session cannot reach or verify;
- build a moderation UI or any code that reads/changes
  `dedup_candidates.status` after insert;
- change matching to compare `address` — no adapter populates it yet,
  comparing an always-null field would be theatre, not a real signal;
- change ranking, confidence computation, or the existing single-source
  ingestion behaviour for OSM.

## Canonical context to read

- `AGENTS.md`
- `PROGRESS.md`
- `ARCHITECTURE.md` section 14
- `docs/adr/0003-first-data-source.md` section 4
- `docs/contracts/osm-toilets-source.md` section 5

## Likely relevant code

- `lib/ingest/upsert.ts`
- `db/queries/nearby.ts` (the `ST_DWithin` pattern to mirror)

## Constraints

- No new dependency (a from-scratch Levenshtein-based similarity, not a
  string-matching library).

## Verification

Run and record:

- `pnpm lint`, `pnpm format:check`, `pnpm typecheck`
- `pnpm test:unit`
- `pnpm db:migrate`, `pnpm test:integration` (new/merge/ambiguous cases,
  and the full pre-existing ingest suite passing unmodified)
- `pnpm build`
- inspect the complete git diff

## Definition of done

TASK-022 is complete only when:

- the matching engine's three outcomes (new/merge/ambiguous) are each
  proven against a real database with synthetic fixtures;
- the existing single-source ingestion behaviour is provably unaffected;
- the real second-source gap (no egress) is recorded honestly, not
  papered over with an invented adapter;
- `docs/CODEMAP.md` and `PROGRESS.md` reflect the repository;
- the complete diff contains no unrelated changes.

Then stop. Do not begin the next task without checking `PLAN.md` for
Milestone 4's actual next item.

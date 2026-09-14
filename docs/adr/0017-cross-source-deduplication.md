# ADR 0017 — Cross-source deduplication

Status: Accepted
Date: 2026-09-14
Scope: TASK-022 — Second data source + deduplication

## Context

`PLAN.md`'s outcome: "a second validated source can be ingested without
creating obvious duplicate toilets; ambiguous matches are surfaced for
review." `ARCHITECTURE.md` section 14 sketches an approach (spatial
candidate match, compare normalised name/address, auto-merge only above a
conservative threshold, flag ambiguous candidates, preserve every source
record) but is explicit that final thresholds need real datasets and "a
future ADR should record final matching rules after source research."

A fresh egress check today (2026-09-14), run from the dedicated "GDZIE
KIBEL" cloud environment created specifically with a Warsaw/OSM host
allowlist, confirmed `dane.um.warszawa.pl`, `api.um.warszawa.pl`,
`overpass-api.de`, and `iot.warszawa.pl` all still fail — the proxy resets
the connection mid-TLS (code 1006) — and `warszawa19115.pl`, the one host
that does respond, is the city's contact/report portal, not a data
catalog; no public-toilets dataset was found there. No real second source
is reachable. This is not a one-time result carried over from an earlier
session — it was re-verified specifically for this task.

## Decisions

### The matching engine is built now; a real second adapter is not

`lib/ingest/upsert.ts`'s own existing comment claimed "the second source
(TASK-022) reuses this without change." That assumption does not survive
contact with the actual requirement: today, the `!previous` branch always
creates a new canonical toilet for any source record it has not seen
before, with no concept of "this might already exist under a different
source." Reusing it unmodified for a second source would create a full
duplicate for every toilet the two sources happen to agree on — the exact
outcome `PLAN.md` asks to avoid. The comment is corrected as part of this
task.

What this task builds instead: the matching/merge logic, proven against
directly constructed `NormalizedSourceRecord` fixtures under a second,
explicitly fictional `sourceName` (`'fixture-second-source'`). No second
ingestion adapter is written against a guessed schema for a source this
session has never seen — that would be exactly the kind of unvalidated
external-data assumption `AGENTS.md` warns against, and would produce
code nobody could trust once a real source finally arrives.

### Cross-source only: same-source records never trigger matching

A candidate toilet only enters matching if it already has a source record
from a **different** `source_name` than the incoming one. Two elements
from the *same* source that happen to be near each other (two distinct
real toilets in one park, say) are never compared: that source already
assigns them distinct identities, and second-guessing it would be a
regression, not an improvement. Because every canonical toilet in a real
production database today has only ever been backed by OSM, this
provision means today's real single-source ingestion is provably
unaffected — verified by the complete pre-existing
`tests/integration/ingest.test.ts` suite passing unmodified.

### A conservative, two-signal threshold — a first pass, not a calibrated one

Two real, already-available signals only: geospatial distance and name
similarity. `address` is not compared: no ingestion adapter (OSM's or any
future one) populates it, so comparing it would be theatre, not a signal.

- Spatial candidates: within `SPATIAL_CANDIDATE_RADIUS_METERS` (30 m).
- Auto-merge: within `AUTO_MERGE_DISTANCE_METERS` (15 m) **and** name
  similarity at or above `AUTO_MERGE_NAME_SIMILARITY_THRESHOLD` (80, on a
  from-scratch Levenshtein-based 0–100 scale — no new dependency for what
  is a single well-understood algorithm). Similarity is never computed
  against `FALLBACK_TOILET_NAME` ("Toaleta") on either side: two unnamed
  facilities both carrying the same placeholder label match on nothing
  real.
- Anything within the spatial radius that misses the merge bar is
  **ambiguous**, not silently treated as a new toilet and not silently
  merged. `ARCHITECTURE.md` section 14's explicit instruction not to
  hard-code an exact threshold "before inspecting real datasets" is
  honoured the only way it honestly can be without real datasets: the
  numbers above are named, documented as unvalidated, and isolated behind
  one small module (`lib/ingest/dedup.ts`) so they are trivial to revise
  once real cross-source data exists.

### Ambiguous means unlinked and flagged, never a new toilet

`toilet_source_records.toilet_id` has been nullable since `TASK-003`
(`ON DELETE SET NULL`) — a schema already shaped for a source record that
is not yet linked to a canonical toilet. An ambiguous match uses exactly
that: the new source record is inserted with `toilet_id = NULL`, and one
`dedup_candidates` row per plausible candidate (not just the closest —
`SPATIAL_CANDIDATE_RADIUS_METERS` is tight enough that this stays a small
number) records the pairing and a score, `status = 'pending'`. Creating a
canonical toilet for an ambiguous record would itself risk being the
"obvious duplicate" `PLAN.md` asks to avoid; leaving it unlinked costs
nothing the product currently shows (an unlinked source record is
invisible to `db/queries/nearby.ts`, which only ever reads `toilets`
directly) and loses no data (`raw_payload`/`normalized_payload` are
unaffected).

### A confident merge never overwrites the existing toilet's columns

`docs/contracts/osm-toilets-source.md` section 5 and `ARCHITECTURE.md`
section 14 both require that when two sources disagree on a field, both
source records are kept and the conflict is surfaced, not silently
resolved. A merge therefore only links the new source record's `toilet_id`
to the existing canonical toilet; it never calls `UPDATE_TOILET` with the
new source's values. This is different from the existing same-source
"version changed" update path, which does overwrite canonical
columns — that path represents one source correcting its own prior
statement, a genuinely different situation from two independent sources
disagreeing.

### `dedup_candidates.status` exists, nothing reads it yet

The same shape of decision already made for `toilet_reports.status`
(`TASK-020`) and `confidence_level` before it (`TASK-003`/`TASK-019`): a
column with a real default (`'pending'`), created because the write path
needs it, acted on only once a later task actually builds the review
workflow `PLAN.md` never asked this task to build.

## Consequences

- `lib/ingest/upsert.ts`'s `UpsertCounts` gains `merged` and
  `flaggedForReview`, alongside the existing `created`/`updated`/
  `unchanged`/`notSeen` — `created` now means specifically "a new
  canonical toilet was created," not "a new source record was written."
- A future real second source needs only its own ingestion adapter
  (fetch/validate/normalize, mirroring `lib/ingest/osm/`) — the matching
  engine this task builds requires no change to accept it, since it
  operates purely on `NormalizedSourceRecord` and `source_name`, not on
  where either came from.
- `docs/adr/0003-first-data-source.md`'s field-mapping table's "Last
  verified" and "Confidence" rows, and every ADR that has said "not yet
  corroborated" pending a second source, now have real matching machinery
  to corroborate against once one exists — but still nothing to
  corroborate today.

## Not decided here

The exact thresholds (30 m / 15 m / 80) are unvalidated first passes, to
be revisited once a real second source exists — the whole reason this ADR
isolates them in one small, named-constant module rather than scattering
magic numbers through the ingestion path. Whether ambiguous candidates
should ever expire, and what a moderation workflow for `dedup_candidates`
looks like, are both left for the task that actually builds it.

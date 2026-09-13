# ADR 0014 — Computed confidence level

Status: Accepted
Date: 2026-09-13
Scope: TASK-019 — Data confidence display

## Context

`PRODUCT.md` section 9 defines three confidence levels:

- **HIGH** — recent, trusted source or strong cross-source agreement.
- **MEDIUM** — plausible source with partial/stale metadata.
- **LOW** — old, single, incomplete or user-reported data not yet
  corroborated.

`docs/adr/0003-first-data-source.md`'s field-mapping table already named
this task as the one that computes `confidence_level`; until now, nothing
has ever written anything but the schema's own `'low'` default
(`docs/adr/0004-schema-conventions.md`) — every real ingested toilet
carries the same value, not because it is individually the correct
answer, but because no computation exists at all.

Read literally and together, HIGH's first branch ("recent, trusted
source") and LOW's own description ("single ... not yet corroborated")
overlap for exactly the case this project is actually in: one source
(OSM), no corroboration, but some records do carry a recent
`check_date`/`survey:date`. This ambiguity has to be resolved before any
computation can be written.

## Decisions

### HIGH stays unreachable until real cross-source corroboration exists

`docs/adr/0009-opening-hours-status.md`, written before this task started,
already commits to a reading: "once `TASK-019` starts producing
`confidence_level` values above `'low'`, **well-corroborated** toilets
will start showing plain `OPEN`/`CLOSED`." That ADR's own word,
"well-corroborated", ties HIGH to actual cross-source agreement, not to a
single source's self-reported recency. This task follows that existing
commitment rather than reinterpreting it: `computeConfidenceLevel` never
returns `'high'`. A single source, however recently verified, is still
exactly LOW's own description — "single ... not yet corroborated" — until
`TASK-022` gives this project a second source to actually agree or
disagree with the first. Computing HIGH from recency alone would be the
fabricated confidence `PRODUCT.md` principle 2 ("do not pretend uncertain
data is certain") forbids.

### MEDIUM from two real, already-captured signals

A toilet is `MEDIUM` when **both** hold, `LOW` otherwise:

1. `verified_at` is within `VERIFICATION_FRESHNESS_DAYS` (365) of the
   evaluated moment. This mirrors OSM's own community convention that
   unverified data older than about a year should be treated as
   questionable. It is a first, defensible pass — like
   `docs/adr/0007-recommendation-ranking-formula.md`'s penalty table, not
   calibrated against real usage yet, and revisitable.
2. The source's raw access tag is not one the contract already flags as
   uncertain (currently just `'permissive'`): `lib/ingest/osm/normalize.ts`
   maps `permissive` access to `public_unconditional` because the tag
   means the owner tolerates public use, but its own comment already
   reserved the raw value "so `TASK-019` can lower confidence for it" —
   tolerated access is a weaker guarantee than genuinely public access,
   independent of how recently anyone checked.

Both signals were chosen because they are real and already flow through
ingestion (`sourceVerifiedAt`, `accessRaw` in `NormalizedSourceRecord`) —
not invented for this task. `accessRaw` itself was never stored on the
canonical `toilets` row before now; this task adds one column
(`access_raw`) to carry it through.

### Computed at request time from raw facts, not a stored derived column

`verified_at` and `access_raw` are stored as plain facts on `toilets`;
`confidence_level` is derived from them and the request's own `now` inside
`toNearbyResult`, the same shape of decision `docs/adr/0009` already made
for `openingStatus`. A verification's freshness is judged against the
moment of the request, never against whatever moment ingestion last ran.
The existing `confidence_level`/`confidence_score` DB columns are left
exactly as `docs/adr/0004` described them — reserved, still defaulting to
`'low'`, untouched by this task's write path. A later task that genuinely
needs a stored, moderator-set, or cross-source-computed value (rather than
a per-request derivation) can still use them without this ADR standing in
the way.

## Consequences

- `lib/toilets/nearby-response.ts`'s `toNearbyResult` computes
  `confidence_level` once and feeds the same value into both the API
  response and `computeOpeningStatus` — one evaluated moment, one
  confidence answer, matching the project's established "one `now`, one
  consistent response" rule.
- Because HIGH is never returned, `docs/adr/0009`'s `LIKELY_OPEN`/`LIKELY_CLOSED`
  qualification still applies to every toilet after this task, unchanged.
  Only the confidence hint's own text (`NISKA`/`ŚREDNIA`) starts varying.
- Ranking (`docs/adr/0007`) is not touched: that ADR's own "Not decided
  here" section already reserves confidence-based ranking as a future,
  separate decision.
- `docs/adr/0003`'s field-mapping table entry ("Confidence | computed,
  TASK-019") is now accurate.

## Not decided here

Whether `VERIFICATION_FRESHNESS_DAYS` (365) is the right threshold, and
whether any access value besides `'permissive'` should count as uncertain,
are both first passes, left for real usage data or a second source
(`TASK-022`) to revisit.

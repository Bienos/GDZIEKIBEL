# ADR 0007 — Recommendation ranking formula

Status: Accepted
Date: 2026-09-13
Scope: TASK-009 — Recommendation ranking

## Context

`PRODUCT.md` section 11 requires nearby results to be ranked, not just
sorted by raw distance, on six criteria, and requires "the final score
formula must be documented in code/tests when implemented; avoid an opaque
magic score."

Of the six criteria, only two are real, differentiating signals in today's
data: geospatial distance, and `access_type` (public-access confidence).
The other four are inert given what the pipeline currently produces — see
`tasks/009-recommendation-ranking.md` for why each one is inert and which
future task makes it real. Ranking on a signal that is currently constant
across every row (confidence_level) or does not exist as input at all
(filters, price preference) would not reorder anything; it would only add
dead code that looks like it does something.

## Decision

### An access-confidence penalty expressed in metres, not an abstract score

Each `access_type` maps to a stated penalty, in metres, representing how
much less confident that access type is that a member of the public can
simply walk in and use the toilet right now:

| `access_type`          | penalty (m) | why                                            |
| ----------------------- | ----------: | ----------------------------------------------- |
| `public_unconditional`  |           0 | no known condition                              |
| `public_paid`           |           0 | open to anyone; the barrier is price, not access, and price is a separate field a user can already see |
| `unknown`                |         150 | genuinely could be anything; penalised per section 11's own "closer uncertain one" example, without changing the stored value |
| `customers_only`        |         300 | a real but usually low-friction condition       |
| `purchase_required`     |         300 | same tier as `customers_only`: a purchase, not a barrier requiring staff or a key |
| `ask_staff`              |         300 | same tier: requires interaction, not a hard block |
| `key_required`           |         400 | a physical dependency on staff/access, higher friction than asking |
| `code_required`          |         400 | same tier as `key_required`                     |
| `ticket_required`        |         400 | same tier: a specific artefact must be obtained first |
| `not_public`             |        1000 | confirmed not for public use; never excluded, always deprioritised |

`rankingScore = distanceMeters + penalty`. Results sort by that score
ascending; ties break on real `distanceMeters` ascending, so that between
two equally-scored options the nearer one always comes first.

Metres were chosen as the unit, rather than an arbitrary 0-100 score,
specifically so a reviewer can read the table and understand exactly what
it does: "this access type makes the toilet feel N metres farther than it
actually is." No unit conversion or weighting constant exists anywhere else
in the formula.

### `not_public` is included, never filtered

Section 11: "The UI should still allow the user to see nearby alternatives."
A 1000 m penalty makes `not_public` sort last among nearby options in
almost every realistic radius (`MAX_RADIUS_METERS` is 5000 in
`lib/toilets/nearby-request.ts`), without ever removing it from the array.

### Applied above the query, not inside it

`db/queries/nearby.ts` keeps returning plain-distance-ordered rows, and its
own tests assert exactly that. Ranking is a new function,
`lib/toilets/rank-nearby.ts`, applied in `app/api/toilets/nearby/route.ts`
after the query returns. This keeps the SQL query's contract
(active-only, radius-bounded, capped, nearest-first) independently true and
independently testable, and keeps the ranking rule — the part most likely
to be revisited as more criteria become real — in one small, pure,
database-free module.

### No score in the API response

`ARCHITECTURE.md`'s response sketch is an ordered list, not a list with a
number attached. Exposing the raw metre-penalty score would invite a future
consumer to treat it as meaningful on its own (e.g. displaying "score: 450"
to a user), which is precisely the opaque-score outcome `PRODUCT.md`
section 11 warns against. Order is the only externally visible effect.

## Consequences

- Every current active toilet ranks by distance alone in practice until
  ingestion starts producing `access_type` values other than OSM's default
  `public_unconditional` (`lib/ingest/osm/normalize.ts`) — the formula is
  correct and tested now, but has nothing to reorder against
  today's real ingested data until access-type variety exists.
- Adding a new `access_type` member to the schema without adding it to
  `ACCESS_CONFIDENCE_PENALTY_METERS` is a TypeScript error (the table is
  typed as `Record<AccessType, number>`), not a silent fallback to some
  default penalty.
- When `TASK-019` makes `confidence_level` real, or `TASK-016` adds
  filters, or a price preference input is designed, each is an additive
  change to `rankingScore` — a new named penalty/bonus term — not a
  rewrite of this ADR's decision.

## Not decided here

The exact penalty values are a first, defensible pass, not calibrated
against real user behaviour (there is none yet). `PROGRESS.md`'s "Known
unresolved decisions" records this as revisitable once real usage data
exists.

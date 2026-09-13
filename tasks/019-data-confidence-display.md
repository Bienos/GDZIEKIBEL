# TASK-019 — Data confidence display

## Goal

`PLAN.md`'s outcome: "low/medium/high confidence can be surfaced where it
improves user decisions without clutter." `PRODUCT.md` section 9 defines
three confidence levels and requires the scoring to be internal but
testable; `docs/adr/0003-first-data-source.md`'s field-mapping table
already names this task as the one that computes it ("Confidence |
computed, TASK-019").

## What already exists, and what is actually missing

The **display** half of this task is already done. `DESIGN.md` section
9.4 places a "confidence/source hint" at position 7 of the toilet detail
sheet only — not the collapsed preview (section 9.3 lists label, distance,
walking time, status badges, CTA; no confidence line). `TASK-011` already
built exactly that hint (`PEWNOŚĆ DANYCH: NISKA`/`ŚREDNIA`/`WYSOKA`), and
`docs/adr/0009-opening-hours-status.md` already wires `confidence_level`
into whether a status renders as plain `OPEN`/`CLOSED` or the qualified
`LIKELY_*` form. Nothing about placement needs to change.

What is missing is the **input**: `confidence_level` is a schema column
that defaults to `'low'` and nothing has ever written anything else to it
(`lib/ingest/upsert.ts`'s `canonicalValues()` does not include it at all).
Every toilet shows `'low'` today not because that is the honest answer for
each one individually, but because nothing has ever computed a real
answer. This task's job is to make the value real.

## Design decision: resolve the HIGH/LOW tension conservatively

`PRODUCT.md` section 9 defines HIGH as "recent, trusted source **or**
strong cross-source agreement" but defines LOW as including "single ...
data **not yet corroborated**" — read together with only one source
(`OSM`) in production, every real record today is simultaneously "a single
uncorroborated source" (LOW's own words) and could be read as "a recent
trusted source" (HIGH's first branch) if a record happens to carry a fresh
`check_date`. `docs/adr/0014-computed-confidence-level.md` records the
resolution: **HIGH stays unreachable until real cross-source corroboration
exists (`TASK-022`)**, consistent with `docs/adr/0009-opening-hours-status.md`'s
own phrase, written before this task started, "once `TASK-019` starts
producing `confidence_level` values above `'low'`, **well-corroborated**
toilets will start showing plain `OPEN`/`CLOSED`." Computing HIGH from
recency alone, with no second source, would be exactly the fabricated
confidence `PRODUCT.md` principle 2 forbids.

**MEDIUM is real and reachable today**, from two signals already present
in the ingested data:

1. `verified_at` (`toilets` table, already populated from OSM's
   `check_date`/`survey:date` tags since `TASK-002`/`TASK-003`) is within a
   documented freshness window.
2. The source's raw access tag is not one the contract already flags as
   uncertain (`lib/ingest/osm/normalize.ts`'s own comment on `permissive`
   access: "the raw value is kept so `TASK-019` can lower confidence for
   it" — that raw value has never been stored on the canonical `toilets`
   row until this task adds `access_raw`).

Both conditions must hold; either one failing keeps a toilet at `LOW`, the
honest default for unverified or uncertain data.

**Computed at request time from raw facts, never a stale stored column** —
the same shape of decision already made for `openingStatus`
(`docs/adr/0009-opening-hours-status.md`): `verified_at` and `access_raw`
are stored as plain facts; `confidence_level` is derived from them and
`now` on every API response, so a verification's freshness is judged
against the moment of the request, not the moment of the last ingestion
run. The `confidence_level`/`confidence_score` DB columns are left exactly
as `docs/adr/0004-schema-conventions.md` already described them
(`default 'low'`) — reserved, unused by this task, not removed.

## User-visible outcome

A toilet whose source data was verified within the freshness window, and
whose access basis is not the contract's uncertain case, now shows
`PEWNOŚĆ DANYCH: ŚREDNIA` instead of `NISKA` in the detail sheet — real
variation, the first time this field has ever differed between two real
toilets. Everything else visible is unchanged: no new UI, since `DESIGN.md`
already places this exactly where it belongs.

## Acceptance criteria

- A new pure function computes `confidence_level` from `verified_at` and
  `access_raw`, given an explicit `now`; it never returns `'high'`.
- `access_raw` is a new canonical `toilets` column, populated at ingestion
  from `NormalizedSourceRecord.accessRaw` (already produced, never stored
  until now).
- The nearby API's `confidenceLevel` field, and the `confidenceLevel` fed
  into `computeOpeningStatus`, both use the freshly computed value, not
  the stored `confidence_level` column.
- A real ingested-then-queried toilet with a recent `check_date` and a
  non-`permissive` access tag is provably `MEDIUM`, verified against a
  real PostGIS database, not only fixtures.

## In scope

- `lib/toilets/compute-confidence.ts` (new pure function + the named
  freshness-window constant).
- A migration adding `toilets.access_raw`.
- `lib/ingest/upsert.ts`, `db/queries/nearby.ts`, `lib/toilets/nearby-response.ts`
  wiring.
- `docs/adr/0014-computed-confidence-level.md`.
- `docs/CODEMAP.md` and `PROGRESS.md` updates.

## Out of scope

Do **not**:

- make `confidence_level` ever return `'high'` (needs `TASK-022`'s
  cross-source corroboration);
- add confidence to the ranking formula (`docs/adr/0007-recommendation-ranking-formula.md`'s
  own "Not decided here" territory — a separate, later decision if real
  usage ever justifies it);
- add any new UI: `DESIGN.md` section 9.4 already places the confidence
  hint, and `TASK-011` already built it;
- change `confidence_level`/`confidence_score`'s stored schema defaults.

## Canonical context to read

- `AGENTS.md`
- `PROGRESS.md`
- `PRODUCT.md` section 9 ("Confidence levels")
- `DESIGN.md` sections 9.3 and 9.4
- `docs/adr/0003-first-data-source.md`, `docs/adr/0004-schema-conventions.md`,
  `docs/adr/0007-recommendation-ranking-formula.md`,
  `docs/adr/0009-opening-hours-status.md`

## Likely relevant code

- `lib/ingest/osm/normalize.ts` (`accessRaw`, already produced)
- `lib/ingest/upsert.ts`
- `db/queries/nearby.ts`
- `lib/toilets/nearby-response.ts`
- `lib/opening-hours/compute-status.ts` (already consumes `confidenceLevel`)
- `lib/toilets/detail-copy.ts` (`confidenceLabel`, already built)

## Constraints

- No new dependency; the API's `confidenceLevel` field shape is unchanged
  (`docs/adr/0006-nearby-api-contract.md`), only what produces its value.

## Verification

Run and record:

- `pnpm lint`, `pnpm format:check`, `pnpm typecheck`
- `pnpm test:unit`
- `pnpm db:migrate`, `pnpm test:integration` (a real round trip proving
  `MEDIUM` is reachable and `LOW` is the honest default otherwise)
- `pnpm build`
- inspect the complete git diff

## Definition of done

TASK-019 is complete only when:

- `confidence_level` genuinely varies based on real ingested signals,
  verified against a real database, not only unit fixtures;
- `HIGH` remains provably unreachable until `TASK-022`;
- the existing detail-sheet display and opening-status qualification pick
  up the computed value with no UI change;
- `docs/CODEMAP.md` and `PROGRESS.md` reflect the repository;
- the complete diff contains no unrelated changes.

Then stop. Do not begin TASK-020.

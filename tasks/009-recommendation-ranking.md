# TASK-009 — Recommendation ranking

## Goal

Reorder the nearby-toilets API's results into a deterministic "recommended"
order that is not simply nearest-first, using only signals that actually
exist and actually vary in today's data. Document the formula in code and
tests rather than an opaque score, per `PRODUCT.md` section 11.

## Which of PRODUCT.md section 11's six criteria this task can honestly act on

Section 11 lists, in order: (1) known closed vs usable/unknown, (2)
geospatial distance, (3) confidence of availability/opening data, (4)
public-access confidence, (5) user-selected filters, (6) price preference.

Given the real state of the pipeline right now:

1. **Known closed vs usable** — already fully handled upstream.
   `db/queries/nearby.ts`'s `WHERE canonical_status = 'active'` excludes
   every `temporarily_closed`/`removed` toilet before ranking ever sees a
   row. There is no "closed" state left to rank against; nothing to add
   here.
2. **Distance** — real, present on every row, the existing plain order.
3. **Confidence of availability/opening data** — not a real signal yet.
   `confidence_level` defaults to `'low'` in the schema
   (`db/migrations/*_toilet-schema.sql`) and nothing in
   `lib/ingest/osm/normalize.ts` or `lib/ingest/upsert.ts` ever sets it to
   anything else, so it is a constant across every row today. Ranking on a
   constant would be dead code producing no observable reordering, and
   would misleadingly imply a confidence signal exists. Deferred to
   `TASK-019`, which is what will make this field actually vary.
4. **Public-access confidence** — real, and already varies: `access_type`
   (`lib/toilets/types.ts`) is a ten-member enum set by ingestion today
   (`public_unconditional` is OSM's default per
   `lib/ingest/osm/normalize.ts`, but the field can and does take other
   values from source data). This is the one confidence signal this task
   can honestly rank on.
5. **User-selected filters** — no `filters` field exists in the request
   (`docs/adr/0006-nearby-api-contract.md`, decided deliberately). Nothing
   to rank by; `TASK-016`'s job.
6. **Price preference** — no user preference input exists anywhere yet.
   Nothing to rank by.

**Scope**: this task ranks by distance and `access_type` confidence only.
The other four criteria are named explicitly, in code, as currently inert
rather than silently ignored, so a later task turning one of them real is a
visible, expected change here — not a surprise.

## Formula

`docs/adr/0007-recommendation-ranking-formula.md` records the decision.
Summary: each `access_type` maps to a stated penalty in metres — how much
less confident that access type is that a member of the public can simply
walk in — added to the toilet's real distance to make one comparable
"ranking score". Results sort by that score ascending, nearest-effective
first; ties break on real distance so that, among equally-scored options,
the physically closer one comes first.

This directly implements section 11's own example: "a slightly farther
high-confidence open public toilet may outrank a closer uncertain one."

## User-visible outcome

The nearby-toilets API's `results` array is returned in recommended order,
not raw distance order. A `public_unconditional` toilet a little farther
away can appear before a closer `unknown`- or `customers_only`-access one.
Nothing in the response shape changes — no new field, no exposed score —
since `ARCHITECTURE.md`'s sketch only asks for an ordered `results` array,
and exposing a raw internal score as if it meant something precise to a
user would be exactly the "opaque magic score" `PRODUCT.md` warns against.

## Acceptance criteria

- A pure, unit-testable ranking function takes toilets with `distanceMeters`
  and `accessType` and returns them reordered; it does not depend on
  `maplibre-gl`, the DOM, or a database.
- The per-`access_type` penalty table names every member of
  `lib/toilets/types.ts`'s `ACCESS_TYPES`, so adding a new access type to
  the schema without updating the ranking table is a visible gap, not a
  silent fallback.
- `not_public` is never excluded from results — it is heavily
  deprioritised, not hidden — per section 11's "The UI should still allow
  the user to see nearby alternatives."
- `unknown` access is penalised relative to confirmed-public access
  (`PRODUCT.md`'s own "closer uncertain one" example), but this changes
  only display order, never the stored value: the API still reports
  `accessType: "unknown"` verbatim, never inferring or collapsing it.
- The nearby API route applies this ranking to the query's results before
  responding; `db/queries/nearby.ts` itself is unchanged and keeps
  returning plain distance order, since its own tests and docstring already
  say ranking is layered on top of that, not inside it.
- A concrete regression test proves the section-11 example: a farther
  `public_unconditional` toilet outranks a closer `unknown`-access one.

## In scope

- `lib/toilets/rank-nearby.ts`: the penalty table and the ranking function.
- Wiring the ranking function into `app/api/toilets/nearby/route.ts`.
- `docs/adr/0007-recommendation-ranking-formula.md`.
- Unit tests for the ranking function.
- `docs/CODEMAP.md` and `PROGRESS.md` updates.

## Out of scope

Do **not**:

- change `db/queries/nearby.ts`'s SQL ordering, radius, or result cap;
- add a `filters` field or any price-preference input, `TASK-016`'s job;
- compute a real `confidence_level`, `TASK-019`'s job;
- expose the internal ranking score in the API response;
- change marker rendering or add a "recommended" marker visual variant —
  `components/map/MapShell.tsx` and `lib/toilets/marker-element.ts` are
  untouched; nothing downstream reads order yet, since the bottom preview
  that would show a single top recommendation is `TASK-010`'s job.

## Canonical context to read

- `AGENTS.md`
- `PROGRESS.md`
- `PRODUCT.md` section 11
- `docs/adr/0006-nearby-api-contract.md`

## Likely relevant code

- `lib/toilets/types.ts`, the `ACCESS_TYPES` list
- `db/queries/nearby.ts`, `lib/toilets/nearby-response.ts`
- `app/api/toilets/nearby/route.ts`

## Constraints

- No new dependency.
- The formula must be a named, documented constant table plus a plain
  arithmetic rule — never a black-box or ML-style score, per
  `PRODUCT.md` section 11's explicit requirement.

## Verification

Run and record:

- `pnpm lint`, `pnpm format:check`, `pnpm typecheck`
- `pnpm test:unit`, including the new ranking tests
- `pnpm build`
- inspect the complete git diff

E2E is not extended: no user-visible interaction changes, only response
ordering, which the existing E2E suite does not assert on.

## Definition of done

TASK-009 is complete only when:

- the ranking function and its penalty table exist, are wired into the
  route, and are proven by unit tests including the section-11 example;
- the four currently-inert criteria are named in the task file and the ADR
  as inert, not silently dropped;
- `docs/CODEMAP.md` and `PROGRESS.md` reflect the repository;
- the complete diff contains no unrelated changes.

Then stop. Do not begin TASK-010.

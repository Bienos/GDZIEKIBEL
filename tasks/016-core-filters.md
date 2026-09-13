# TASK-016 — Core filters

## Goal

`PLAN.md`'s outcome: "open-now, free, wheelchair, baby-changing and 24h
filters work with correct unknown semantics." `PRODUCT.md` section 6.3
names exactly these five; `DESIGN.md` section 9.6 gives the filter sheet's
layout. `docs/adr/0006-nearby-api-contract.md` deliberately left `filters`
out of the request schema until this task could give it real meaning —
this is that task.

## The unknown-semantics decision

`docs/adr/0011-filter-semantics.md` records it in full. Summary:
`PRODUCT.md` section 6.3 phrases three of the five filters as "where data
exists" (wheelchair, baby-changing, 24h) — the product's own words already
scope these to confirmed data. This task applies the identical rule to all
five, symmetrically: **a filter only keeps a toilet whose relevant fact is
positively confirmed to satisfy it.** `'unknown'` never matches an active
filter, and neither does an actively negative fact standing in for
unknown — `'limited'` wheelchair access does not satisfy the wheelchair
filter, since the filter promises confident accessibility, not a partial
or uncertain one. This can honestly return few or no results against
today's mostly-unconfirmed data; that is correct, not a defect, and
`TASK-017 — No-results and radius expansion` is the next task specifically
because the roadmap already anticipates it.

## User-visible outcome

A `FILTRY`/`FILTERS` button opens a sheet (`DESIGN.md` 9.6): four
sections — `STATUS` (open now), `CENA` (free), `DOSTĘPNOŚĆ` (wheelchair),
`UDOGODNIENIA` (baby changing, 24h) — each a toggle. `POKAŻ WYNIKI` applies
them: the map markers, the list view, and the preview all update from the
same, now-filtered `toilets` state, since all three already read that one
array. `WYCZYŚĆ` clears every toggle and reapplies.

## Design decision: filtering is server-side, within the existing cap

Filtering happens in the nearby API, on the same nearest-30 candidates
`db/queries/nearby.ts` already returns (unchanged), before ranking
(`TASK-009`) and status computation (`TASK-013`) — not a second,
client-side pass. This keeps the client simple (it only displays what the
server returns, as everywhere else in this app) and keeps ranking correct
against the actual filtered set, not a stale unfiltered one.
`openNow` cannot be filtered in SQL (it depends on the request's own `now`
and the bounded-grammar evaluation `lib/opening-hours/compute-status.ts`
already owns), so every filter is applied in JS, uniformly, after the
query and before ranking — one code path, not two.

Because filtering happens within the existing 30-nearest-candidate cap,
`radiusMeters`'s effective cap `MAX_NEARBY_RESULTS` still applies before
filtering, not after: a filtered response can return fewer than 30, or
zero, even when more matching toilets exist farther away. Expanding the
search radius when that happens is explicitly `TASK-017`'s job.

## Design decision: no live "(N)" result count for this task

`DESIGN.md` 9.6's mockup shows `POKAŻ WYNIKI (N)`. Computing an accurate
live count as the user toggles filters, before applying them, would need a
second, always-unfiltered candidate pool kept in sync alongside the
displayed (possibly already-filtered) one — a real architectural addition
`PLAN.md`'s actual outcome text ("filters work with correct unknown
semantics") does not ask for. The CTA reads `POKAŻ WYNIKI` without a count
for this task, the same category of decision as `TASK-010`'s deferred CTA:
citing `PLAN.md`'s stated outcome over a mockup detail, not silently
dropping it.

## Acceptance criteria

- `lib/toilets/filter-nearby.ts` exports the filter type and a pure
  predicate; unit-tested against every combination of filter × feature
  state, proving `'unknown'` and `'limited'` never match.
- The nearby API accepts an optional `filters` object
  (`lib/toilets/nearby-request.ts`), rejecting unknown keys as the schema
  already does everywhere else.
- `NearbyToiletResult` gains `open24h: boolean | null` (the raw fact,
  alongside the already-exposed `openingStatus`), since the filter sheet's
  live state needs it and no existing field carries it.
- The filter sheet is reachable by keyboard, each toggle has an accessible
  name, and the sheet's controls follow the same dialog/heading-focus
  pattern already used by the location and detail sheets.
- Applying a filter updates markers, the list view, and the preview from
  the one shared `toilets` state — no separate filtered copy is kept.

## In scope

- `lib/toilets/filter-nearby.ts`.
- `nearby-request.ts`, `nearby-response.ts`, `route.ts`, `fetch-nearby.ts`
  changes to carry filters through.
- `components/map/FiltersSheet.tsx`; `MapShell.tsx` wiring (a filters
  toggle button, sheet visibility, `activeFilters` state feeding the
  existing fetch effect).
- New `Dictionary` keys for section titles, toggle labels, and the two
  CTAs.
- Unit tests for the filter predicate; an E2E test applying one filter
  against intercepted results and asserting the request body's `filters`
  field.
- `docs/adr/0011-filter-semantics.md`.
- `docs/CODEMAP.md` and `PROGRESS.md` updates.

## Out of scope

Do **not**:

- add radius expansion or a real empty-state design (`TASK-017`'s job);
- add a live result count;
- add filters beyond the five `PRODUCT.md` section 6.3 names (no price
  amount range, no payment-method filter);
- change ranking or opening-status computation themselves, only what feeds
  them.

## Canonical context to read

- `AGENTS.md`
- `PROGRESS.md`
- `PRODUCT.md` section 6.3
- `DESIGN.md` section 9.6
- `docs/adr/0006-nearby-api-contract.md`

## Likely relevant code

- `app/api/toilets/nearby/route.ts`, `lib/toilets/nearby-request.ts`,
  `lib/toilets/nearby-response.ts`
- `components/map/MapShell.tsx`, `lib/toilets/fetch-nearby.ts`

## Constraints

- No new dependency; no schema migration (every column a filter reads
  already exists).

## Verification

Run and record:

- `pnpm lint`, `pnpm format:check`, `pnpm typecheck`
- `pnpm test:unit`, including the new filter-predicate tests
- `pnpm test:integration`
- `pnpm build`
- `pnpm test:e2e`, extended with a filter-sheet flow
- inspect the complete git diff

## Definition of done

TASK-016 is complete only when:

- all five filters are real, apply server-side, and never let `'unknown'`
  or `'limited'` satisfy a filter that asks for a confirmed fact;
- the map, list, and preview all reflect the filtered set from one shared
  state;
- `docs/CODEMAP.md` and `PROGRESS.md` reflect the repository;
- the complete diff contains no unrelated changes.

Then stop. Do not begin TASK-017.

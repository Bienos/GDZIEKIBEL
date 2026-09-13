# TASK-017 — No-results and radius expansion

## Goal

`PLAN.md`'s outcome: "empty state offers a useful fallback and can search
farther." `PRODUCT.md` section 6.2: say so clearly, show alternatives
beyond the default radius, allow expanding the search, never imply no
toilet exists anywhere. `DESIGN.md` section 9.8.

## Why an empty result is now a real, reachable state

Before `TASK-016`, an empty `toilets` array could only happen from a
genuinely empty area. Now it can also happen because an active filter
excludes everything — expected, given today's mostly-`'unknown'` real data
(`docs/adr/0011-filter-semantics.md`). Radius expansion does not fix that
case; only clearing the filter does. This task's design has to diagnose
which situation is actually true, not show one generic message regardless
of cause.

## Design decision: three states, not one

`docs/adr/0012-no-results-diagnosis.md` records it. Summary:

1. **A filter is active.** The likely cause is the filter, not distance —
   expanding the radius will not surface a toilet whose wheelchair access
   is `'unknown'`. The message points at the filter; the action is to
   clear it (reusing the filter sheet's existing "WYCZYŚĆ").
2. **No filter is active, and the search radius has not reached
   `MAX_RADIUS_METERS`.** The action is to search farther: `SZUKAJ DALEJ`
   re-fetches once, directly at `MAX_RADIUS_METERS` — not a stepped ladder
   (1500 → 3000 → 5000 → …) `PRODUCT.md` never asks for; jumping straight
   to the server's own ceiling is the smallest complete implementation of
   "allow the user to expand the search."
3. **No filter is active, and the radius is already at the maximum.**
   There is nothing left to offer within this app's supported radius.
   `PRODUCT.md`'s "do not imply that no toilet exists anywhere" rule means
   the copy states the search's own limit, not the world's.

## User-visible outcome

When results are empty (and the initial fetch for the current location/
filters/radius has actually finished — never a flash during loading), an
overlay replaces the preview (map view) or fills the list area (list
view), showing one of the three messages above with its matching action.

## Acceptance criteria

- A `searchRadius` state (default `DEFAULT_RADIUS_METERS`, capped at
  `MAX_RADIUS_METERS`) feeds the existing fetch effect, sent as
  `radiusMeters` in the request.
- The empty-state overlay never flashes before the first real fetch for
  the current location/filters/radius resolves.
- The three-state logic above is exact: filters-active always takes
  priority over radius state, since it is the more likely, more directly
  fixable cause.
- Clearing filters or expanding the radius from this overlay reuses the
  exact same state (`activeFilters`, `searchRadius`) the filter sheet and
  fetch effect already use — no parallel mechanism.

## In scope

- A `NoResultsState` component (or inline in `MapShell.tsx` if small
  enough) rendering the three messages/actions.
- `MapShell.tsx`: `searchRadius` state, a `toiletsLoaded` flag to avoid the
  loading-flash, wiring the fetch effect to `radiusMeters`.
- New `Dictionary` keys for the three messages and two actions
  (`BRAND.md`'s "No results" copy).
- An E2E test per state: filters-active, radius-expandable,
  radius-exhausted.
- `docs/adr/0012-no-results-diagnosis.md`.
- `docs/CODEMAP.md` and `PROGRESS.md` updates.

## Out of scope

Do **not**:

- add a stepped/progressive radius-expansion ladder;
- change `MAX_RADIUS_METERS`, `DEFAULT_RADIUS_METERS`, or the server-side
  cap logic itself;
- add outside-Warsaw detection (`TASK-018`'s job — a location outside the
  supported area is a different problem from a thin result set inside it);
- change filters or ranking themselves, only how their empty output is
  explained.

## Canonical context to read

- `AGENTS.md`
- `PROGRESS.md`
- `PRODUCT.md` section 6.2
- `DESIGN.md` section 9.8
- `BRAND.md` "No results" copy
- `docs/adr/0011-filter-semantics.md`

## Likely relevant code

- `components/map/MapShell.tsx`
- `lib/toilets/nearby-request.ts` (`DEFAULT_RADIUS_METERS`,
  `MAX_RADIUS_METERS`, already exported)

## Constraints

- No new dependency; no schema or API contract change (`radiusMeters`
  already exists in the request schema since `TASK-007`).

## Verification

Run and record:

- `pnpm lint`, `pnpm format:check`, `pnpm typecheck`
- `pnpm test:unit`
- `pnpm build`
- `pnpm test:e2e`, one test per diagnosis state
- inspect the complete git diff

## Definition of done

TASK-017 is complete only when:

- all three no-results states are real, correctly diagnosed, and never
  flash falsely during loading;
- expanding the radius and clearing filters both reuse existing state,
  no parallel mechanism;
- `docs/CODEMAP.md` and `PROGRESS.md` reflect the repository;
- the complete diff contains no unrelated changes.

Then stop. Do not begin TASK-018.

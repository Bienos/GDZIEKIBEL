# ADR 0012 — No-results diagnosis and radius expansion

Status: Accepted
Date: 2026-09-13
Scope: TASK-017 — No-results and radius expansion

## Context

`PRODUCT.md` section 6.2 assumes one cause for an empty result: nothing
suitable within the search radius, fixed by expanding it. `TASK-016`
introduced a second, real cause: an active filter can exclude every
candidate regardless of distance, since `docs/adr/0011-filter-semantics.md`
never lets `'unknown'` or `'limited'` satisfy a filter, and today's real
data is mostly unconfirmed. Showing one generic "nothing nearby, search
farther" message when the actual cause is a filter would send the user
toward an action — expanding the radius — that cannot possibly help.

## Decisions

### Three diagnosed states, filters checked first

1. A filter is active → point at the filter, offer to clear it.
2. No filter, radius below `MAX_RADIUS_METERS` → offer to expand the
   radius.
3. No filter, radius already at `MAX_RADIUS_METERS` → nothing left to
   offer within the app's supported radius; say so without implying
   nothing exists anywhere (`PRODUCT.md`'s explicit rule).

Filters are checked first because they are the more likely and more
directly fixable cause: expanding the radius cannot resolve an exclusion
that has nothing to do with distance, and offering it anyway would waste
the user's next action.

### Radius expansion jumps directly to the maximum

`SZUKAJ DALEJ` sets the search radius straight to `MAX_RADIUS_METERS`
(5000 m, already the server-controlled ceiling since `TASK-007`) rather
than a stepped ladder (1500 → 3000 → 5000 m or similar). `PRODUCT.md`
asks only that the user can "expand the search" — a single, complete
expansion satisfies that literally. A stepped ladder would need an
arbitrary choice of intermediate steps nothing in `PRODUCT.md` or
`DESIGN.md` specifies, for a benefit (letting the user stop partway) the
product text does not ask for either.

### The empty state must never flash during loading

An empty `toilets` array is indistinguishable from "still loading" unless
the component also tracks whether the current fetch has actually
completed. Without that, every location grant or filter change would
flash the no-results overlay for one render before real results (or a
real empty result) arrive.

## Consequences

- The three-state check must run in this order — filters, then radius —
  every time it renders, not be decided once and cached, since either can
  change independently (the user could clear filters and then still be at
  max radius with truly nothing nearby).
- If `TASK-018`'s outside-Warsaw handling and this task's radius-exhausted
  state ever need to be distinguished from each other, that is a separate,
  later decision — this ADR does not conflate "far outside Warsaw" with
  "inside Warsaw but genuinely thin."

## Not decided here

Whether a stepped expansion ladder is ever worth adding is left for real
usage data showing the single-jump behaviour is insufficient.

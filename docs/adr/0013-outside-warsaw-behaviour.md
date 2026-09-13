# ADR 0013 — Outside-Warsaw behaviour

Status: Accepted
Date: 2026-09-13
Scope: TASK-018 — Outside-Warsaw behaviour

## Context

`TASK-006`'s location flow has exactly two outcomes: `granted` (real
coordinates) or one shared `denied` screen covering every other case
(denied, unavailable, timeout, error) — none of which produce real
coordinates, so one honest "we don't know where you are" message covers
all of them. A grant from outside Warsaw does not fit either bucket: the
browser succeeds and the coordinates are real, so `denied`'s copy would be
false, but feeding those coordinates into the existing nearest-toilet
pipeline unchanged would silently recommend a toilet hundreds of
kilometres away.

## Decisions

### `isWithinWarsawBbox` is the one definition of "supported area"

`lib/geo/warsaw.ts` already defines `WARSAW_BBOX` and `isWithinWarsawBbox`,
used both by ingestion validation and by the map shell's own camera bounds
(`lib/map/warsaw-view.ts`). This task reuses it rather than introduce a
second, possibly diverging boundary. Its own doc-comment already records
that the box is coarse and provisional, pending a real administrative
boundary (`TASK-004`'s job) — that caveat is unchanged and out of scope
here.

### A new `LocationFlowState`, checked before any coordinate is stored

`'outside'` is checked immediately after a successful `requestLocation()`
grant, before `addUserLocationMarker` or `setGrantedCoords` run. An
out-of-area coordinate never reaches either: no location dot is placed for
a position the map's own `maxBounds` would clip anyway, and no downstream
consumer (the nearby fetch, the ranking, the marker-diff reconciliation)
needs to learn a second shape of "real" coordinate. This keeps every
existing consumer's contract exactly as `TASK-006`/`TASK-008`/`TASK-009`
left it: `grantedCoords` is either a usable Warsaw-area position or `null`,
never a coordinate the rest of the app must additionally distrust.

### One action, not the denied screen's two

The denied screen offers `SPRÓBUJ PONOWNIE` (retry) alongside `OTWÓRZ MAPĘ
WARSZAWY`, because permission denial or a transient GPS failure can
genuinely resolve on a second attempt. Being outside Warsaw is not
transient in that sense — re-requesting location will not change the
answer — so a retry action here would imply a false remedy. The outside
screen offers only `PLAN.md`'s named "manual Warsaw map path": it reuses
the denied screen's own `OTWÓRZ MAPĘ WARSZAWY` action and dictionary key,
transitioning to the same `'dismissed'` state, so every already-working
no-grant behaviour (default Warsaw-centred fetch, no location dot) is the
implementation of that path, not a second one.

## Consequences

- `MapShell.tsx` gains one more `LocationFlowState` value and one more
  `.scrim`/`.sheet` screen, reusing the same CSS classes as the ask/denied
  screens — no new CSS.
- If `WARSAW_BBOX` is later tightened to a real administrative boundary
  (`TASK-004`'s deferred work), this task's behaviour improves for free:
  it depends on the function, not a duplicated boundary.
- Real multi-city support remains explicitly out of scope
  (`PRODUCT.md` principle 7, "Warsaw first"): this task only detects and
  communicates the boundary, it does not widen it.

## Not decided here

Whether a coordinate near the box's edge (a coarse, generous box by
design) should ever get a softer "on the edge of our coverage" message is
left unaddressed — `PRODUCT.md` and `PLAN.md` ask only for a clear
supported-area message, not a graduated one.

# TASK-018 — Outside-Warsaw behaviour

## Goal

`PLAN.md`'s outcome: "users outside supported geography receive a clear
supported-area message/manual Warsaw map path." `PRODUCT.md` section 18
lists "user outside Warsaw" as an edge case the implementation must
explicitly handle; section 2 principle 7 ("Warsaw first") rules out
attempting any real multi-city support here.

## Why this is a real, reachable state

`TASK-006`'s location flow only ever distinguished "granted" from "every
non-grant outcome" (denied, unavailable, timeout, error) — one shared
screen for the latter, because none of those outcomes produce real
coordinates. A grant from outside Warsaw is different: the browser
succeeds, coordinates are real, but they are nowhere near the supported
area. Treating it as a "denied" screen would be dishonest (`NIE WIEMY,
GDZIE JESTEŚ.` is false — the app does know), and feeding those
coordinates into the existing nearest-toilet/ranking/marker-placement code
unchanged would recommend a "nearest" toilet hundreds of kilometres away
with no warning.

## Design decision: one definition of Warsaw, one new terminal-adjacent state

`docs/adr/0013-outside-warsaw-behaviour.md` records it. Summary:

- **Reuse `isWithinWarsawBbox`** (`lib/geo/warsaw.ts`), already the single
  definition of "Warsaw" for ingestion validation and the map's own camera
  bounds (`lib/map/warsaw-view.ts`). No second, possibly diverging
  definition of the supported area.
- **A new `LocationFlowState` member, `'outside'`**, distinct from
  `'denied'`: checked only after a successful grant, before the existing
  marker-placement/`grantedCoords` logic runs. Real coordinates outside the
  box never reach `addUserLocationMarker` or `setGrantedCoords` — every
  downstream consumer (the nearby fetch, the recommendation, the location
  dot) keeps working with the same "no real location" fallback the
  dismissed/denied paths already use, rather than learning to handle a
  second kind of coordinate.
- **One action, not two.** The existing denied screen offers both `SPRÓBUJ
  PONOWNIE` (retry — reasonable when permission or a transient GPS failure
  caused it) and `OTWÓRZ MAPĘ WARSZAWY`. Being in Kraków is not transient in
  the same way; a retry button implies re-asking will change the answer,
  which it will not. The outside screen offers only the "manual Warsaw map
  path" `PLAN.md` names: `OTWÓRZ MAPĘ WARSZAWY`, reusing the exact action
  (and dictionary key) the denied screen already uses to transition to
  `'dismissed'`.

## User-visible outcome

Sharing location from outside the Warsaw bounding box shows a dedicated
screen (same `.scrim`/`.sheet` modal pattern as every other location
screen) stating plainly that the app only covers Warsaw, with one action
that proceeds to the default Warsaw view — identical to what dismissing
the initial ask or the denied screen already does.

## Acceptance criteria

- A location grant with coordinates outside `WARSAW_BBOX` sets
  `locationFlow` to a new `'outside'` state, never `'granted'` or
  `'denied'`.
- No location marker is added and `grantedCoords` is never set to the
  out-of-area coordinates.
- The screen's one action transitions to `'dismissed'`, after which the
  app behaves exactly as it already does for a skipped/denied grant
  (default Warsaw-centred fetch, no location dot).
- A location grant inside `WARSAW_BBOX` is unaffected: unchanged
  `'granted'` path, marker, and coordinates.

## In scope

- The `'outside'` `LocationFlowState` value and its screen in
  `MapShell.tsx`, using existing `.scrim`/`.sheet`/`.sheetHeadline`/
  `.sheetBody`/`.sheetPrimary` — no new CSS.
- Two new `Dictionary` keys (headline, body); the action reuses
  `locationDeniedOpenMap`.
- Focus management for the new screen's heading, matching the ask/denied
  screens (`DESIGN.md` section 14).
- `docs/adr/0013-outside-warsaw-behaviour.md`.
- An E2E test granting a real out-of-Warsaw location.
- `docs/CODEMAP.md` and `PROGRESS.md` updates.

## Out of scope

Do **not**:

- add a second definition of the Warsaw area, or change `WARSAW_BBOX`;
- add a retry action to the outside screen;
- attempt real multi-city support (`PRODUCT.md` principle 7);
- change the mount-time, no-grant fetch behaviour, which already serves
  the default Warsaw view and already is this task's "manual Warsaw map
  path" once reached.

## Canonical context to read

- `AGENTS.md`
- `PROGRESS.md`
- `PRODUCT.md` sections 2 (principle 7) and 18
- `PLAN.md`'s `TASK-018` line
- `lib/geo/warsaw.ts`

## Likely relevant code

- `components/map/MapShell.tsx` (`LocationFlowState`, `handleShareLocation`)
- `lib/geo/warsaw.ts` (`isWithinWarsawBbox`, `WARSAW_BBOX`)

## Constraints

- No new dependency; no schema or API contract change.

## Verification

Run and record:

- `pnpm lint`, `pnpm format:check`, `pnpm typecheck`
- `pnpm test:unit`
- `pnpm build`
- `pnpm test:e2e`, including a real out-of-Warsaw geolocation grant
- inspect the complete git diff

## Definition of done

TASK-018 is complete only when:

- an out-of-Warsaw grant reaches a distinct, honest screen, never the
  `'denied'` copy;
- no out-of-area coordinate ever reaches the marker/fetch/ranking code;
- an in-Warsaw grant is provably unaffected;
- `docs/CODEMAP.md` and `PROGRESS.md` reflect the repository;
- the complete diff contains no unrelated changes.

Then stop. Do not begin TASK-019.

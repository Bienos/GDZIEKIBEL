# TASK-015 — List view

## Goal

`PLAN.md`'s outcome: "same result set can be used without relying on map
interaction." `DESIGN.md` section 9.5; `DESIGN.md` section 14's
accessibility rule: "Map has equivalent list representation."

## User-visible outcome

A toggle in the map shell switches between the map view (everything
`TASK-005`-`TASK-013` already built) and a list view: every toilet from
the same, already-ranked (`TASK-009`) `toilets` array, one row per toilet,
each showing name, distance + ETA, opening status, price, and up to two
feature badges. Tapping a row opens the same toilet detail sheet
(`TASK-011`) a marker or the preview already opens — one selection
mechanism, three entry points.

## Design decisions this task makes

- **Card content**: `DESIGN.md` section 9.5 specifies name, distance, ETA,
  status, price, "at most two key feature badges." This reuses
  `distanceLine` (already combines distance+ETA), `openingStatusLabel`/
  `openingStatusVariant`, and `priceAmountLabel` unchanged (`TASK-010`/
  `TASK-013`/`TASK-014`). The two feature badges are wheelchair and
  changing-table access — the two `PRODUCT.md` section 6.3 actually lists
  as filter dimensions (unlike payment methods, which section 6.3 never
  names as a filter) — and each renders only when its value is not
  `'unknown'`. Every toilet ingested today has both `'unknown'`, so no
  badge renders yet for real data; this is not a bug, the same shape of
  fact already recorded for ranking (ADR 0007) and opening status
  (ADR 0009) — showing an "UNKNOWN" badge on every single row in a
  potentially 30-row list would be exactly the clutter `DESIGN.md`'s "do
  not create marketplace-style oversized cards" warns against, without
  adding information a screen reader user does not already get from the
  detail sheet.
- **One selection mechanism**: tapping a list row sets the same
  `selectedId` state a marker click or the preview tap already sets
  (`TASK-008`/`TASK-010`), opening the identical `ToiletDetailSheet`. No
  new detail view is built.
- **The list replaces the map area, not the preview.** When the list view
  is active, the collapsed nearest-toilet preview (`TASK-010`) is hidden —
  the list already shows that same top-ranked toilet as its first row, so
  showing both would duplicate the same information. The toggle switches
  what fills the map area; the location ask/denied sheets and the detail
  sheet still overlay either mode unchanged.
- **Independent of tile state**, the same reasoning already applied to the
  fetch, the preview, and the detail sheet: the list needs only the
  `toilets` array, never the map canvas, so it is available and fully
  testable whether or not real tiles ever load.
- **Toggle placement**: a plain text button (`LISTA`/`MAPA`,
  `LIST`/`MAP`) in the map shell's own UI, opposite corner from
  MapLibre's `NavigationControl`. No icon: this project's established
  avoidance of an icon library (`TASK-008`'s "WC" badge, `TASK-011`'s
  `ZAMKNIJ` close button).

## Acceptance criteria

- `components/map/ToiletListView.tsx` renders one row per toilet in
  `toilets`, in the array's existing order (no separate sort: `DESIGN.md`
  9.5's "sort defaults to recommendation ranking" is already true of the
  API's own order).
- Each row is a real list item (`role="list"`/`"listitem"` or semantic
  `<ul>`/`<li>`), each a button with an accessible name including the
  toilet's name and distance.
- Tapping a row sets `selectedId`; the detail sheet opens exactly as it
  does today from a marker or the preview.
- The map/list toggle is reachable by keyboard, has an accessible name
  distinguishing "switch to list" from "switch to map," and works
  identically whether tiles are showing or the fallback state is.

## In scope

- `components/map/ToiletListView.tsx`.
- `MapShell.tsx`: a `viewMode` state, the toggle control, swapping the
  map/fallback area for the list view, hiding the preview in list mode.
- New `Dictionary` keys for the toggle labels and the list's accessible
  landmark label.
- Styles in `components/map/MapShell.module.css`.
- An E2E test: switch to list view, assert a row's real intercepted
  content, tap it, assert the same detail sheet opens; switch back.
- `docs/CODEMAP.md` and `PROGRESS.md` updates.

## Out of scope

Do **not**:

- add filters (`TASK-016`'s job) — the list shows the same, unfiltered
  `toilets` array the map does;
- add payment-method badges to the compact card (not a filter dimension
  per `PRODUCT.md` section 6.3; full detail remains one tap away);
- add virtualisation or pagination; `MAX_NEARBY_RESULTS` (30) is small
  enough that a plain scrollable list is sufficient;
- change ranking, the nearby API, or the detail sheet's own content.

## Canonical context to read

- `AGENTS.md`
- `PROGRESS.md`
- `PRODUCT.md` sections 6.3, 7 ("Toilet list view or list sheet")
- `DESIGN.md` sections 9.5, 14
- `docs/adr/0007-recommendation-ranking-formula.md`

## Likely relevant code

- `components/map/MapShell.tsx`, extended by this task
- `lib/toilets/preview-copy.ts`, `lib/toilets/detail-copy.ts`, reused
  unchanged

## Constraints

- No new dependency; no icon assets.

## Verification

Run and record:

- `pnpm lint`, `pnpm format:check`, `pnpm typecheck`
- `pnpm test:unit`
- `pnpm build`
- `pnpm test:e2e`, extended with the list-view toggle/row/detail-sheet flow
- inspect the complete git diff

## Definition of done

TASK-015 is complete only when:

- every toilet in `toilets` has an equivalent, fully accessible list row,
  reachable and usable without any map or tile rendering;
- selecting a row opens the same detail sheet a marker or the preview
  would, via the same `selectedId` mechanism;
- `docs/CODEMAP.md` and `PROGRESS.md` reflect the repository;
- the complete diff contains no unrelated changes.

Then stop. Do not begin TASK-016.

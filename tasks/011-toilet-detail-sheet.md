# TASK-011 — Toilet detail sheet

## Goal

Let the user open a detail sheet for one toilet — the recommended one from
the preview, or one selected by tapping a marker — showing every known
value `PRODUCT.md` FR-05 lists, with explicit unknown states, and nothing
fabricated. `DESIGN.md` section 9.4.

## What this resolves from TASK-010

`TASK-010`'s preview shipped with no CTA, because neither of its two
possible destinations existed: the detail sheet, or real navigation. This
task builds the first one. The nearest-toilet preview
(`components/map/NearestToiletPreview.tsx`) becomes tappable: tapping it
selects that toilet (the same `selectedId` state `TASK-008` already added
for marker clicks) and opens this sheet for it. A marker click already sets
`selectedId` too, so both entry points land on the same sheet, satisfying
`FR-04`'s "selected marker and selected detail card remain synchronised."

## What is deliberately still missing, and why

`DESIGN.md` section 9.4's information order has eight items. Two are
omitted here, each for a reason already established in this project rather
than an oversight:

4. **Primary CTA (`PROWADŹ MNIE`)** — `TASK-012 — External walking
   navigation` is specifically the task that makes this button launch a
   real navigation flow. A button with that label doing nothing would be
   the exact dead-ended affordance this project's `TASK-010` already
   avoided for the same reason; `PLAN.md`'s own TASK-011 outcome text asks
   only for "known metadata and explicit unknown states," not a working
   CTA.
6. **Hours** — the nearby API does not return opening-hours data at all
   yet (`docs/adr/0006-nearby-api-contract.md`: `opening_hours_raw` is
   stored by ingestion but never read by the query or the response shape).
   Showing hours would require extending that contract, which is not this
   task's job and not asked for by `PLAN.md`.
8. **Report issue** — `TASK-020 — Report incorrect data` owns the actual
   report flow, which does not exist yet. Same reasoning as the CTA: no
   destination, no button.

Everything else in the order — name, distance + ETA, opening status +
price, accessibility/features, confidence hint — has real data behind it
today and is built.

## User-visible outcome

Tapping the nearest-toilet preview, or a marker, opens a bottom sheet
(dimmed backdrop, matching the location sheets) showing:

- the toilet's name,
- distance + approximate walking time,
- opening-status and price badges (same copy as the preview),
- wheelchair access, baby changing, and unisex, each as a plain label +
  value (`yes`/`no`/`limited`/`unknown`, never collapsed),
- a data-confidence hint (`high`/`medium`/`low`).

A close control returns to the collapsed preview.

## Acceptance criteria

### Real values only

- Feature values render all four `FeatureState` members distinctly; none
  is ever collapsed into a boolean or dropped (`PRODUCT.md` section 9).
- The confidence hint renders the real `confidenceLevel` the API returns.
  Every toilet in the pipeline today carries `'low'` (nothing sets it
  higher yet — `TASK-019`'s job), and that is what is shown: an accurate
  statement that this data is not yet corroborated, not a fabricated
  higher confidence.
- No hours, CTA, or report control exists; see above.

### Interaction

- Tapping the preview sets `selectedId` to the recommended toilet and the
  detail sheet opens for it, replacing the collapsed preview (not shown
  simultaneously).
- A close control sets `selectedId` back to `null`, returning to the
  collapsed preview.
- Selecting a different marker while the sheet is open swaps its content to
  that toilet, reusing the same `selectedId` state — no new selection
  mechanism is introduced.

### Accessibility

- The sheet is reachable by a screen reader, focus moves to its heading on
  open, same pattern as the existing location sheets
  (`role="dialog"`, `aria-modal="false"`, a focused heading).
- The close control meets the 44×44 px touch-target minimum
  (`DESIGN.md` section 14).

## In scope

- `lib/toilets/detail-copy.ts`: pure functions mapping `FeatureState` and
  `ConfidenceLevel` to dictionary copy.
- `components/map/ToiletDetailSheet.tsx`.
- Making `NearestToiletPreview` tappable (an `onSelect` prop).
- New `Dictionary` keys and PL/EN copy for the close control, feature
  names/values, and confidence hint.
- Styles in `components/map/MapShell.module.css`, reusing the existing
  sheet/badge classes where the visual language already matches.
- Unit tests for the new pure copy functions.
- An E2E test: tap the preview, assert the sheet's real content, close it,
  assert the preview returns. (Marker-click selection is not covered here,
  for the same reason no existing test covers it: this environment cannot
  render live tiles or real markers — see `docs/adr/0005-map-tile-provider.md`.)
- `docs/CODEMAP.md` and `PROGRESS.md` updates.

## Out of scope

Do **not**:

- add the primary CTA or wire up real navigation (`TASK-012`);
- add hours display or extend the nearby-API response shape;
- add the report-issue flow (`TASK-020`);
- change `db/queries/nearby.ts`, `lib/toilets/rank-nearby.ts`, or the API
  response shape;
- add swipe/drag gestures or the "half-height" intermediate sheet state
  `DESIGN.md` section 10 lists as a recommendation, not a requirement; this
  task ships one collapsed state and one open state, not a graduated drag
  interaction.

## Canonical context to read

- `AGENTS.md`
- `PROGRESS.md`
- `PRODUCT.md` section 9 (confidence levels), FR-04, FR-05
- `DESIGN.md` sections 9.4, 10, 14
- `docs/adr/0006-nearby-api-contract.md`

## Likely relevant code

- `components/map/MapShell.tsx`, `NearestToiletPreview.tsx`, extended by
  this task
- `lib/toilets/nearby-response.ts`, the fields this reads
- `lib/toilets/preview-copy.ts`, reused for distance/status/price copy

## Constraints

- No new dependency.
- No new icon assets; plain text labels, matching the project's existing
  avoidance of an icon library (`TASK-008`'s "WC" badge, this project's
  established pattern).

## Verification

Run and record:

- `pnpm lint`, `pnpm format:check`, `pnpm typecheck`
- `pnpm test:unit`, including the new copy-function tests
- `pnpm build`
- `pnpm test:e2e`, extended with the detail-sheet open/close assertion
- inspect the complete git diff

## Definition of done

TASK-011 is complete only when:

- the sheet renders every value FR-05 lists that the API actually returns
  today, with no fabricated hours, CTA, or report control;
- opening and closing works from the preview, synchronised through the
  existing `selectedId` state;
- `docs/CODEMAP.md` and `PROGRESS.md` reflect the repository;
- the complete diff contains no unrelated changes.

Then stop. Do not begin TASK-012.

# TASK-010 — Nearest toilet preview

## Goal

Show a collapsed bottom preview of the single best-ranked nearby toilet —
its name, distance, approximate walking time, opening status, and price —
as soon as results load. `DESIGN.md` section 9.3's "Bottom sheet collapsed
state" and `PRODUCT.md` section 5 step 5/6.

## Why this reads `toilets[0]`, not `selectedId`

`TASK-008` added marker click-to-select, but that is a distinct concept
from this task's "best nearby option." `PRODUCT.md` section 5 step 5 says
the app "highlights the best nearby option" as soon as candidates load,
before the user has tapped anything. `TASK-009`'s ranking already makes
`toilets[0]` (the first element of the now-ordered array) that option. This
preview reads that directly and does not depend on `selectedId`.

## Why there is no CTA yet, though `DESIGN.md` shows one

`DESIGN.md` section 9.3 lists a CTA as part of the collapsed state, and
section 9.4's example CTA is `PROWADŹ MNIE`. Two things would have to exist
for that button to mean anything: a destination to open (the detail sheet,
`TASK-011`) or a real external navigation target (`TASK-012`). Neither
exists yet. A button labelled to promise either of those, that in fact does
nothing, is exactly the dead-ended, misleading affordance `PRODUCT.md`'s
"do not dead-end" rule (section 6.1) and this project's broader "never
fabricate" discipline warn against elsewhere. This task ships the
informational part only; the CTA is added by whichever of `TASK-011`/
`TASK-012` gives it a real destination first.

## User-visible outcome

Once the nearby-toilets fetch resolves with at least one result, and the
location step has been resolved (granted or skipped — the same condition
`TASK-006` already uses to decide the location sheet is no longer covering
the screen), a bottom card appears showing:

- the label `NAJBLIŻSZY SENSOWNY KIBEL` (`DESIGN.md` 9.3, `BRAND.md`'s "Map
  result" copy),
- the toilet's name,
- distance and approximate walking time as one literal line (`240 M · ~3
  MIN PIESZO`, matching `DESIGN.md` 9.4's own example formatting — a
  factual value, not a joke sentence, per `AGENTS.md`'s literal-label rule),
- an opening-status badge,
- a price badge.

The card is not modal: it does not dim or block the map, unlike the
location ask/denied sheets.

## Acceptance criteria

### Content is real, not fabricated

- The opening-status badge only ever renders the "unknown" copy today: the
  nearby API's `openingStatus` is typed as the literal `'UNKNOWN'`
  (`lib/toilets/nearby-response.ts`, per `docs/adr/0006-nearby-api-contract.md`)
  until `TASK-013` computes a real value, so there is nothing else this
  badge could honestly show yet. The mapping function is structured as a
  switch so adding real states later is additive, not a rewrite.
- The price badge renders all three real values (`free`/`paid`/`unknown`):
  unlike opening status, `price_state` already varies in ingested data
  (`lib/ingest/osm/normalize.ts` reads the OSM `fee` tag), so all three
  copy variants are genuinely reachable today.
- Distance and walking time are the API's own `distanceMeters` and
  `approxWalkingMinutes` (`TASK-007`); no new calculation is introduced.

### Independent of tile/map state

- The preview renders whenever ranked results exist, whether or not the map
  canvas itself is showing real tiles or the fallback state — the same
  reasoning `TASK-006`'s location ask and `TASK-008`'s fetch already use:
  the underlying data and behaviour are real and testable independent of
  live tiles, which this environment cannot render (`docs/adr/0005-map-tile-provider.md`).

### Accessibility

- The card is a labelled region (`role="region"`, `aria-label` matching its
  own headline), reachable by a screen reader, not a modal — it does not
  trap focus or require dismissal, since it does not block the map.

## In scope

- `lib/toilets/preview-copy.ts`: pure functions mapping `priceState` and
  `openingStatus` to dictionary copy, and formatting the distance/time line.
- `components/map/NearestToiletPreview.tsx`, rendered from `MapShell.tsx`.
- New `Dictionary` keys and PL/EN copy for the label, badges, and units.
- Styles in `components/map/MapShell.module.css`.
- Unit tests for the pure copy functions.
- An E2E test intercepting the nearby-API call, as `TASK-008` already does,
  asserting the preview renders the intercepted toilet's real values.
- `docs/CODEMAP.md` and `PROGRESS.md` updates.

## Out of scope

Do **not**:

- add a CTA button, per the reasoning above;
- add the "recommended" marker visual variant `DESIGN.md` section 8
  describes — now reachable in principle since `TASK-009`'s ranking exists,
  but it is a map-marker concern belonging with `TASK-008`'s marker code,
  not this preview card, and PLAN.md's TASK-010 outcome does not ask for it;
- build the detail sheet (`TASK-011`) or real navigation (`TASK-012`);
- compute a real opening status (`TASK-013`);
- change `db/queries/nearby.ts`, `lib/toilets/rank-nearby.ts`, or the API
  response shape.

## Canonical context to read

- `AGENTS.md`
- `PROGRESS.md`
- `PRODUCT.md` section 5 (steps 5-6), section 6.1
- `DESIGN.md` sections 8, 9.3, 9.4, 10
- `BRAND.md` "Map result", "Free / paid", "Open / closed / uncertain" copy
- `docs/adr/0006-nearby-api-contract.md`, `docs/adr/0007-recommendation-ranking-formula.md`

## Likely relevant code

- `components/map/MapShell.tsx`, extended by this task
- `lib/toilets/nearby-response.ts`, the fields this reads
- `lib/i18n/dictionaries.ts`

## Constraints

- No new dependency.
- No new colour tokens beyond what `app/tokens.css` already defines
  (`--status-uncertain` for the one reachable status badge state; the price
  badge stays a neutral outlined pill, since neither `PRODUCT.md` nor
  `DESIGN.md` specifies colour-coding for price).

## Verification

Run and record:

- `pnpm lint`, `pnpm format:check`, `pnpm typecheck`
- `pnpm test:unit`, including the new copy-function tests
- `pnpm build`
- `pnpm test:e2e`, extended with the preview-content assertion
- inspect the complete git diff

## Definition of done

TASK-010 is complete only when:

- the preview renders real API values with no fabricated status;
- no CTA, detail sheet, navigation, or marker-variant code exists that this
  task did not have to create;
- `docs/CODEMAP.md` and `PROGRESS.md` reflect the repository;
- the complete diff contains no unrelated changes.

Then stop. Do not begin TASK-011.

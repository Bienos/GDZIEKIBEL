# TASK-008 — Display nearby toilets on map

## Goal

Call the nearby-toilets API from the map shell and render its results as
markers. A clicked marker becomes visually selected. No ranking, no bottom
sheet, no filters — those are later tasks; this task only gets real toilets
onto the map and lets one be picked out.

## User-visible outcome

Toilets near the map's current view appear as markers as soon as the map
shell mounts, using the default Warsaw centre. Once the user grants
location (TASK-006), the results refresh centred on their real position.
Clicking a marker gives it a visibly distinct selected state. Nothing else
happens on click yet — no card, no sheet, no navigation.

## Acceptance criteria

### Fetch trigger, and why it does not wait on the map or on location

- A nearby-toilets fetch runs once on mount, centred on `WARSAW_CENTER`
  (`lib/map/warsaw-view.ts`), with the default radius. This is independent
  of whether the map's own tiles have loaded, for the same reason
  `TASK-006`'s location ask does not wait on tiles: there is a real,
  useful, testable behaviour here (the fetch and its result) whether or not
  a tile provider key happens to be configured in a given environment.
- When location is granted, the fetch runs again centred on the real
  coordinates. `PRODUCT.md` section 6.1 requires a denied/skipped user can
  still "browse a Warsaw map manually" usefully — an empty map with no
  toilets at all until location is granted would be a weak version of that,
  so the Warsaw-centred default fetch is not optional polish.
- Markers are reconciled onto the actual map only when a map instance
  exists (`mapRef.current`); when it does not (no tile key, or tiles still
  loading), the fetched results are held in state and rendered once the map
  becomes available. Fetching and rendering are deliberately two separate
  effects.

### Markers

- One marker per result, a compact pictogram (inline SVG, no icon library
  dependency and no emoji in the primary identity, per `BRAND.md` section 8,
  which is about the wordmark specifically, not map markers), high contrast,
  legible at small size, per `DESIGN.md` section 8.
- Only the "uncertain" visual variant is implemented. Every other variant
  `DESIGN.md` section 8 describes — recommended, open, known-closed — has
  no way to be reached yet: `TASK-007`'s API always returns
  `openingStatus: "UNKNOWN"`, and only returns `canonical_status = 'active'`
  toilets, so "known closed" cannot occur and no ranking exists to produce
  "recommended". Building unreachable visual states now would be dead code;
  the marker-styling function is structured so adding them is a small,
  contained change once `TASK-009` and `TASK-013` exist.
- Each marker has an accessible name built from the toilet's name (or the
  literal fallback per `lib/ingest/upsert.ts`'s `FALLBACK_TOILET_NAME`) and
  its distance, read by a screen reader.
- Markers reconcile against the previous set: an id no longer present is
  removed, a new id is added, nothing is destroyed and recreated
  needlessly.

### Selection

- Clicking a marker sets it as selected: visually distinct beyond colour
  alone (`DESIGN.md` section 8 requires scale, outline, or both), and any
  previously selected marker returns to its default appearance.
- Selection state lives in the map shell; nothing downstream reads it yet,
  since the detail sheet is `TASK-011`'s job. The state exists now because
  this task's own acceptance criterion is that markers "remain synced with
  selection," not because anything consumes it yet.

### Accessibility

- Marker accessible names exist, per above. A full accessible list-view
  equivalent to the map (`DESIGN.md` section 14) is explicitly `TASK-015`'s
  job, named as its own vertical slice in `PLAN.md`; this task does not
  build it, and does not claim to.

### Privacy

- The fetch sends only the coordinates the nearby API already accepts; nothing
  new is sent, logged, or persisted beyond what `TASK-007` already governs.

## In scope

- a client-side fetch helper for `POST /api/toilets/nearby`;
- marker creation, reconciliation, and the one implemented visual state;
- click-to-select behaviour;
- unit tests for the fetch helper and the marker-reconciliation logic (add,
  remove, update, independent of `maplibre-gl` or the DOM);
- an E2E test that intercepts the API call and asserts on the request made
  after a real location grant, since this environment cannot render live
  tiles to verify markers visually (see `docs/adr/0005-map-tile-provider.md`
  and `PROGRESS.md`'s existing notes on that limitation);
- `docs/CODEMAP.md` and `PROGRESS.md` updates.

## Out of scope

Do **not**:

- build the toilet detail sheet or bottom preview, `TASK-010`/`TASK-011`'s job;
- build the accessible list view, `TASK-015`'s job;
- implement ranking or ordering beyond what the API already returns,
  `TASK-009`'s job;
- add marker clustering; `DESIGN.md` section 8 says only if density proves
  it necessary, which is not knowable with zero live-ingested toilets;
- re-fetch on map pan/zoom; this task's trigger is mount and location grant
  only.

## Canonical context to read

- `AGENTS.md`
- `PROGRESS.md`
- `DESIGN.md` sections 8, 9.3 and 14
- `PRODUCT.md` section 6.1
- `docs/adr/0006-nearby-api-contract.md`, the response shape this consumes

## Likely relevant code

- `components/map/MapShell.tsx`, extended by this task
- `lib/toilets/nearby-response.ts`, the `NearbyToiletResult` type
- `lib/map/warsaw-view.ts`

## Constraints

- No new dependency; `fetch` and `maplibre-gl`'s existing `Marker` API are
  sufficient.
- No marker visual state is added unless the current data can actually
  produce it.

## Verification

Run and record:

- `pnpm lint`, `pnpm format:check`, `pnpm typecheck`
- `pnpm test:unit`, including the new fetch-helper and reconciliation tests
- `pnpm build`
- `pnpm test:e2e`, extended to intercept the nearby-API call and assert on
  the request coordinates after a real granted location
- inspect the complete git diff

## Definition of done

TASK-008 is complete only when:

- the fetch and marker-reconciliation logic is correct by inspection and by
  unit test, even though live marker rendering is unverified here, exactly
  as already recorded for the map shell and the location dot;
- no ranking, detail sheet, filter, or list-view code exists that this task
  did not have to create;
- `docs/CODEMAP.md` and `PROGRESS.md` reflect the repository and name the
  live-rendering verification gap explicitly;
- the complete diff contains no unrelated changes.

Then stop. Do not begin TASK-009.

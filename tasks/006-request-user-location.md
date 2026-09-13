# TASK-006 — Request and display user location

## Goal

Ask the user for their location, using the app's own explanation screen
before the browser's native permission prompt, and show their position on
the map shell TASK-005 built. Handle every outcome the browser's Geolocation
API can produce without dead-ending.

## User-visible outcome

Once the map has loaded, a light permission screen appears: an explanation,
a primary action to share location, and a secondary action to skip it. Only
clicking the primary action triggers the browser's own permission prompt —
the app never mimics that prompt itself.

- **Granted:** the screen dismisses and a location dot appears on the map at
  the user's position.
- **Denied, unavailable, or timed out:** a screen explains that the app does
  not know where the user is, offers a retry, and offers to dismiss straight
  to the plain Warsaw map.
- **Skipped:** the same dismissal to the plain map, without ever calling the
  browser's API.

No toilet data, ranking, or navigation appears anywhere in this task.

## Acceptance criteria

### Sequencing

- The permission ask appears immediately on load, independent of whether the
  map's own tiles have finished loading. `PRODUCT.md`'s primary journey asks
  for location "immediately," and `DESIGN.md` sections 9.1-9.3 place the
  permission screen before the main map screen, not gated behind it.
  Granting location while the map is still in its own fallback state is a
  handled case: there is simply nowhere to place a dot yet, and the app does
  not pretend otherwise.
- The browser's native permission prompt is triggered only by the user
  clicking the app's own "share location" button, never automatically and
  never on page load. `DESIGN.md` section 9.2 explicitly forbids mimicking
  OS permission UI.

### Copy

Exact strings from `BRAND.md`, both locales, added to
`lib/i18n/dictionaries.ts`:

- permission ask: headline `POZWÓL NAM ZNALEŹĆ KIBEL.`, body `Bez lokalizacji
  pokażemy Ci Warszawę. Z lokalizacją pokażemy Ci kibel.`, a second line as
  the privacy hint `DESIGN.md` section 9.2 asks for as its own element,
  taken from `BRAND.md`'s second body option, `Używamy lokalizacji tylko po
  to, żeby znaleźć coś blisko. Nie zapisujemy jej w bazie.`, primary
  `UDOSTĘPNIJ LOKALIZACJĘ`, secondary `NIE TERAZ`;
- denied/unavailable/timeout: headline `NIE WIEMY, GDZIE JESTEŚ.`, body
  `Bez lokalizacji możemy pokazać tylko ogólną mapę Warszawy.`, primary
  `SPRÓBUJ PONOWNIE`, secondary `OTWÓRZ MAPĘ WARSZAWY`.

English sides are direct, plain translations, not word-for-word renderings
of any Polish idiom, per the research's section 3.5 rule already applied to
the existing dictionary.

`BRAND.md` and `DESIGN.md` give one shared copy variant for every non-granted
outcome (denied, unavailable, timeout) rather than one each. This task uses
that single variant for all three and records the outcome internally
(`denied` | `unavailable` | `timeout` | `error`) for future refinement, but
does not invent three more screens neither source specifies.

### Geolocation handling

- `lib/geolocation/request-location.ts` wraps
  `navigator.geolocation.getCurrentPosition` in a promise resolving to a
  discriminated result: `granted` with coordinates and accuracy, or
  `denied` / `unavailable` / `timeout` / `error` with no coordinates.
- `navigator.geolocation` being absent (old browser, insecure context) is
  `unavailable` and never throws.
- The request uses `enableHighAccuracy: true` (distance to a toilet is the
  product's core function; coarse location is not good enough) and a
  `timeout` bounded well under a minute, so a hanging request cannot leave
  the UI stuck on "locating".
- `maximumAge: 0`: a stale cached position is not acceptable for this use.

### Location marker

- On success, a marker distinct from any future toilet marker is added to
  the map at the user's coordinates: a plain blue dot, not a brand-coloured
  pin, per `DESIGN.md` section 8, "never brand-colour this so heavily that
  it becomes ambiguous." A new `--color-location-blue` token is added to
  `app/tokens.css` for it, since none of the existing brand colours are
  meant for this.
- No accuracy halo in this task; `DESIGN.md` marks it optional and it adds
  no acceptance-relevant behaviour yet.
- The marker has an accessible label identifying it as the user's own
  location, distinct from `MapShell`'s existing map region label.

### Privacy

- The coordinates are held in component state only; nothing here persists
  them, in a cookie, `localStorage`, or otherwise. `PRODUCT.md` section 14
  forbids storing precise location by default and this task introduces no
  storage of any kind.
- Nothing here logs coordinates to the console or sends them anywhere; there
  is no server call in this task at all.

### Accessibility

- Both screens are real DOM content reachable by a screen reader, not purely
  visual overlays.
- Every button meets the 44×44 px touch target minimum.
- Focus moves to the permission screen's heading when it appears, and to the
  denied screen's heading when that replaces it, so a keyboard or
  screen-reader user is not left focused on a background element.

## In scope

- `lib/geolocation/request-location.ts` and its states;
- the permission-ask and denied UI, rendered by `MapShell` once the map has
  loaded;
- the location dot marker and its token;
- new dictionary keys for both screens;
- unit tests for `request-location.ts`'s result classification;
- E2E coverage of the skip path and the denied-path copy, using a mocked
  `navigator.geolocation` since this suite's browser has no real location
  permission flow to drive;
- `docs/CODEMAP.md` and `PROGRESS.md` updates.

## Out of scope

Do **not**:

- persist the user's choice (skip, granted, denied) across visits; every
  load asks again, and a "don't ask again" preference is not requested by
  any canonical source and is left for a later decision;
- add an accuracy halo around the dot;
- add a way to re-open the permission screen once dismissed within a
  session; TASK-006 only needs the first ask to work correctly;
- fetch or display any toilet data, which TASK-007 and TASK-008 own;
- send the coordinates anywhere, to an API or to analytics;
- add a "search by address" fallback; `PRODUCT.md` section 6.1 lists it as
  "later if implemented," not now.

## Canonical context to read

- `AGENTS.md`
- `PROGRESS.md`
- `PRODUCT.md` sections 5, 6.1 and 14; FR-02 in section 13
- `DESIGN.md` sections 8, 9.2, 9.9 and 14
- `BRAND.md` section 6, "Location permission" and "Location denied" only
- `docs/adr/0005-map-tile-provider.md`, for how `MapShell` already gates on
  `mapReady`

## Likely relevant code

- `components/map/MapShell.tsx`, which already tracks a load-before-error
  state this task extends
- `lib/i18n/dictionaries.ts`
- `app/tokens.css`
- `tests/unit/tile-provider.test.ts`, for the pure-function test pattern

## Constraints

- No new dependency; `navigator.geolocation` and `maplibre-gl`'s existing
  `Marker` API are sufficient.
- The permission screen must not resemble a browser or OS dialog.
- Do not call `getCurrentPosition` before a user click, under any state.

## Verification

Run and record:

- `pnpm lint`, `pnpm format:check`, `pnpm typecheck`
- `pnpm test:unit`, including the new geolocation result-classification tests
- `pnpm build`
- `pnpm test:e2e`, extended for the skip path and a mocked denial, since this
  environment cannot exercise a real browser permission grant
- inspect the complete git diff

## Definition of done

TASK-006 is complete only when:

- every acceptance criterion is satisfied and observable in the E2E suite
  wherever the environment allows it, with the real-grant path noted as
  unverified here rather than skipped silently;
- no toilet, ranking, or navigation code exists that this task did not have
  to create;
- `docs/CODEMAP.md` and `PROGRESS.md` reflect the repository;
- the complete diff contains no unrelated changes.

Then stop. Do not begin TASK-007.

# TASK-005 — Render Warsaw map shell

## Goal

Render the branded Warsaw map as the app's main surface. No geolocation, no
toilet markers, no bottom sheet content. This is the first of the vertical
Milestone 1 slices; TASK-006 adds the location request on top of what this
task builds.

## User-visible outcome

Opening the site shows a compact top bar (wordmark, language switch) and,
filling the rest of the viewport, an interactive MapLibre map centred on
Warsaw at a city-wide zoom. The user can pan and zoom within the Warsaw area.
Nothing on the map responds to the user's own location, and no toilet data
appears anywhere.

If the map cannot initialise (no tile provider key configured, or the browser
lacks WebGL), the screen shows the literal fallback state instead of a blank
or broken area, per `docs/adr/0005-map-tile-provider.md`.

## Acceptance criteria

### Map rendering

- MapLibre GL JS renders inside a Client Component, using the vanilla
  `maplibre-gl` API directly (no React wrapper library).
- The map is centred on Warsaw and constrained so a user cannot pan far outside
  the city; the existing coarse bounding box in `lib/geo/warsaw.ts` is reused
  as the pan boundary rather than a new constant.
- The basemap style is muted/dark per `DESIGN.md` section 8; use a MapTiler
  style that satisfies this without custom style authoring.
- Standard MapLibre zoom/pan controls are present and reachable by keyboard.
- No markers, no location dot, no bottom sheet, no filter chips. Those are
  later tasks.

### Configuration

- The tile provider key lives in one environment variable,
  `NEXT_PUBLIC_MAPTILER_KEY`, added to `.env.example` with no value.
- `lib/map/tile-provider.ts` builds the style URL from a key; this is the only
  place that knows the provider's URL shape, so switching provider later means
  changing this module only.
- The key is never read through `lib/env/server.ts`. It is a publishable,
  domain-restricted key by design, per ADR 0005, and belongs in a
  `NEXT_PUBLIC_` variable.

### Fallback state

- When `NEXT_PUBLIC_MAPTILER_KEY` is empty or absent, the component never
  imports or initialises `maplibre-gl`. It renders the two-layer error copy
  from `BRAND.md`'s "API/network error" list and `DESIGN.md` section 13:
  a punchline, a literal explanation naming the map specifically, and a
  retry action. Both locales are required, in `lib/i18n/dictionaries.ts`.
- The retry action reloads the map initialisation attempt. It does not need
  to reload the whole page if re-attempting client-side is straightforward;
  a full reload is an acceptable minimum.

### Accessibility

- The map container has an accessible name describing it as an interactive
  map of Warsaw, from the dictionary, in the active locale.
- The fallback state is real DOM content, not an empty region with only a
  visual message; a screen reader reaches the same two-layer copy.
- Zoom and pan controls meet the 44×44 px touch target minimum from
  `DESIGN.md` section 14.

### Copy accuracy

- The TASK-001 placeholder line stating the map does not work is removed; it
  is no longer true. No new marketing hero copy is added — that is
  `DESIGN.md` section 9.1's job and is not part of this task's scope.

## In scope

- `components/map/MapShell.tsx` and its fallback state;
- `lib/map/tile-provider.ts` and `docs/adr/0005-map-tile-provider.md`;
- reusing `lib/geo/warsaw.ts` for the pan boundary;
- updated `app/[locale]/page.tsx` layout: top bar plus map;
- new dictionary keys for the fallback state and the map's accessible name;
- `.env.example` update;
- unit tests for the pure style-URL builder;
- an E2E test that verifies the fallback state renders correctly, since no
  environment available to this task holds a real provider key.

## Out of scope

Do **not**:

- request geolocation or show a location dot, which TASK-006 owns;
- fetch or render toilet markers, which TASK-008 owns;
- build the bottom sheet, filter chips, or the first-open hero screen from
  `DESIGN.md` sections 9.1 and 9.3's overlay content; those need data or a
  separate task this one does not claim;
- add a React map wrapper library (react-map-gl or similar); vanilla
  `maplibre-gl` is sufficient for a shell with no marker layers yet;
- commit a real API key anywhere, including for local testing;
- finalise the commercial tile provider choice; ADR 0005 keeps it swappable.

## Canonical context to read

- `AGENTS.md`
- `PROGRESS.md`
- `ARCHITECTURE.md` sections 2 and 23
- `DESIGN.md` sections 3, 6, 8, 9.3, 12, 13 and 14
- `BRAND.md` section 6, "API/network error" only
- `docs/adr/0005-map-tile-provider.md`

## Likely relevant code

- `lib/geo/warsaw.ts`, the existing bounding box
- `lib/i18n/dictionaries.ts` and `lib/i18n/index.ts`
- `app/[locale]/page.tsx`, `app/[locale]/page.module.css`
- `app/globals.css`, for the MapLibre stylesheet import
- `e2e/home.spec.ts`, which currently asserts the placeholder copy this task
  removes and needs updating rather than leaving to fail

## Constraints

- No API key is committed, ever, including a "test" key.
- `maplibre-gl` is the only new dependency this task may add.
- Keep the language switch working exactly as it does today; it moves into
  the new top bar but its behaviour does not change.
- The fallback state must be indistinguishable in effort from a real error
  state — it is not a TODO comment, it is the actual required behaviour for
  every environment without a configured key.

## Verification

Run and record:

- `pnpm lint`, `pnpm format:check`, `pnpm typecheck`
- `pnpm test:unit`, including new tests for `lib/map/tile-provider.ts`
- `pnpm build`
- `pnpm test:e2e`, updated to verify the fallback state (this task's only
  available environment has no provider key) and that the language switch
  still works from the new layout
- manual note in `PROGRESS.md` that live tile rendering is unverified from
  this session, naming the exact blocker (no key, no egress to
  `api.maptiler.com`)
- inspect the complete git diff

## Definition of done

TASK-005 is complete only when:

- the map shell code path is complete and correct by inspection and by the
  fallback-state tests, even though live tiles were not visually observed;
- no geolocation, marker, ranking, or bottom-sheet code exists that this task
  did not have to create;
- the placeholder copy that is no longer true has been removed and nothing
  overclaims what the screen does;
- `docs/CODEMAP.md` and `PROGRESS.md` reflect the repository and name the
  live-verification gap explicitly;
- the complete diff contains no unrelated changes.

Then stop. Do not begin TASK-006.

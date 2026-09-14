# ADR 0026 — MapLibre's worker is served as a static asset from `public/`

Status: Accepted
Date: 2026-09-14
Scope: Owner-directed addition outside the task sequence (fix for the live
"map is not visible" report)

## Context

The project owner reported the map area staying permanently blank on the
live site — on an iPhone (Safari) and then on desktop Safari with Web
Inspector open: no console error, the location-permission dialog worked,
MapLibre's own zoom controls and attribution (`MapLibre | OpenFreeMap ©
OpenMapTiles Data from OpenStreetMap`) rendered, and the canvas showed
nothing, indefinitely. Server-side causes were ruled out first, directly
against production via `scripts/db/check-tile-style.ts` run from Vercel's
build environment: the style URL returns a real MapLibre style, the
vector source's TileJSON is reachable, and both carry
`access-control-allow-origin: *`.

The real cause was found by driving the production build in headless
Chromium (this sandbox has no egress to the tile host, so the style and
tiles were served by the test itself): MapLibre loaded the style and the
TileJSON, populated attribution from it, sized the canvas correctly — and
never requested a single tile. Its Web Worker had been created from the
URL of the page itself and closed at once.

MapLibre GL JS 6 is an ESM-only distribution whose tile-loading worker is
a separate module, `dist/maplibre-gl-worker.mjs`, importing
`./maplibre-gl-shared.mjs`. By default it locates that worker relative to
its own `import.meta.url`, guarded by `/^https?:/` — and falls back to an
empty URL otherwise. Under Turbopack (`next build`'s default bundler)
`import.meta.url` is not an http(s) URL, so the fallback wins and
`new Worker('', {type: 'module'})` starts the worker from the page URL,
which is HTML, so it dies immediately. Every tile load is dispatched to
that dead worker and never resolves: the style is "loaded", `load` never
fires, no `error` fires, and nothing is logged. Turbopack does emit the
worker under `/_next/static/media/` with a hashed filename, but the
worker's own `./maplibre-gl-shared.mjs` import is left unhashed, so even
that copy would 404 on its first import.

## Decision

The worker is served as a plain static file, copied from the installed
package on every `dev` and `build`, and named explicitly to MapLibre:

- `lib/map/worker-url.ts` — `MAP_WORKER_URL =
  '/maplibre-gl/maplibre-gl-worker.mjs'`, the one place the path is
  defined.
- `lib/map/worker-assets.ts` — copies the worker and every sibling module
  it imports by a `./` path (`./maplibre-gl-shared.mjs` in 6.9) from
  `node_modules/maplibre-gl/dist` into `public/maplibre-gl/`, keeping
  filenames so those imports resolve once served. A named sibling that
  does not exist fails the copy, at build time.
- `scripts/map/copy-maplibre-worker.ts` (`pnpm map:copy-worker`) runs it;
  `package.json`'s `dev` and `build` scripts run that first, so Vercel,
  CI, and the e2e suite's own build all produce it, and the served worker
  always matches the bundled library version. `public/maplibre-gl/` is
  gitignored.
- `components/map/MapShell.tsx` calls `setWorkerUrl(MAP_WORKER_URL)`
  after importing `maplibre-gl` and before constructing the first map,
  which is what starts the worker pool.

Verified before shipping, in headless Chromium against the production
build: the worker is now created from
`/maplibre-gl/maplibre-gl-worker.mjs` (served as
`application/javascript`), real tile requests follow for Warsaw's zoom-11
tiles, and a same-origin tile server outside the test runner's
interception sees those requests. Covered by an e2e test that serves its
own style, asserts a tile request is made, and asserts the fetched toilet
appears as a marker — which `MapShell` adds only once `load` has fired.

The 15-second `MAP_LOAD_TIMEOUT_MS` added just before this fix stays: it
is what turns any future silent hang of this kind into the visible retry
fallback instead of a blank area, and the e2e suite covers it separately.

## Alternatives considered

- Committing the two files into `public/`: ~530 KB of vendored minified
  code in git, and a Dependabot bump of `maplibre-gl` would silently
  leave the served worker on the old version while the bundled library
  moved — a mismatch nothing would catch. Copying at build time makes
  version drift impossible.
- Relying on Turbopack's emitted `_next/static/media` copies: the hashed
  worker filename is not knowable from code, and its unhashed
  `./maplibre-gl-shared.mjs` import would 404 regardless.
- A route handler reading the files from `node_modules` at request time:
  a 513 KB file through a serverless function per request, plus output
  file tracing to guarantee the files ship — more moving parts than a
  static file for no gain.
- Switching `next build` to webpack: a bundler change for one asset.

## Consequences

- Two extra static files (19 KB worker, 513 KB shared module,
  uncompressed) are served from `public/` with Next's default
  `Cache-Control: public, max-age=0`, so a browser revalidates after each
  deploy. The shared module's code is downloaded once more than a
  bundler-integrated worker would need; accepted for a first fix.
- `pnpm build` now depends on `node_modules/maplibre-gl/dist` existing at
  its expected path — true for pnpm's layout here, and the copy fails
  loudly if not.
- Both `tests/unit/worker-assets.test.ts` (pins the installed package's
  worker/shared layout) and the e2e test above fail before a MapLibre
  upgrade that changes this layout can ship a blank map again.

## Not decided here

Whether a future MapLibre or Next.js release resolves the worker URL
correctly under Turbopack, making the copy step unnecessary — worth
re-checking on the next `maplibre-gl` major, by removing the
`setWorkerUrl` call and seeing whether the e2e test still passes.

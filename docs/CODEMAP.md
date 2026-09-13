# Code map

Status: foundation created by TASK-001. Describes what actually exists in the
repository. Update only when stable module boundaries change.

## Canonical planning/control files

Repository root:

- `PRODUCT.md`
- `BRAND.md`
- `DESIGN.md`
- `ARCHITECTURE.md`
- `PLAN.md`
- `PROGRESS.md`
- `AGENTS.md`
- `CLAUDE.md`
- `README.md` — developer setup, commands and deployment path

Task specifications live in `tasks/`.

## Application code

```text
app/
  [locale]/
    layout.tsx        root layout, <html lang> per locale, metadata, hreflang
    page.tsx          top bar (wordmark, language switch) + the map shell
    page.module.css   styles for the top bar and page layout
  api/toilets/nearby/route.ts
                      POST only; bounded nearby active toilets, reordered by
                      rankNearbyToilets (TASK-009); no filters yet
  globals.css         reset, body defaults, imports tokens.css and maplibre-gl.css
  tokens.css          design tokens (colour, spacing, type) — single source
components/
  map/MapShell.tsx    the Warsaw map (TASK-005), the location permission
                      flow (TASK-006), and nearby toilet markers with
                      click-to-select (TASK-008); renders the tile fallback
                      when no provider key is configured or the map fails to
                      load before its first successful load, independent of
                      that, the location ask/denied screens on mount and the
                      nearby-toilets fetch centred on the default Warsaw view
  map/NearestToiletPreview.tsx
                      collapsed "nearest sensible toilet" preview (TASK-010):
                      the top-ranked (TASK-009) result's name, distance/ETA,
                      opening-status and price badges; a button — tapping it
                      opens the detail sheet (TASK-011)
  map/ToiletDetailSheet.tsx
                      toilet detail sheet (TASK-011): name, distance/ETA,
                      status/price, accessibility features, confidence hint;
                      no CTA, hours, or report control yet (see the task
                      file for why)
  map/MapShell.module.css
lib/
  env/server.ts       the only validated reader of server environment variables
  i18n/               supported locales and the copy dictionaries
  toilets/types.ts    enumerated values of the toilet model, mirroring the SQL types
  toilets/normalized-source-record.ts
                      Zod schema an ingestion adapter must emit (contract section 6)
  geo/warsaw.ts       coarse Warsaw bounding box, a first filter only
  map/tile-provider.ts  builds the MapTiler style URL from a key; the one
                      place that knows the provider's URL shape
  map/warsaw-view.ts  initial camera position and pan limits for the map shell
  geolocation/request-location.ts
                      wraps navigator.geolocation in one promise, classified
                      into granted/denied/unavailable/timeout/error
  toilets/walking-time.ts
                      distance -> approximate minutes, one named conservative
                      constant (ADR 0006)
  toilets/nearby-request.ts
                      validates a nearby-API request body; no filters field
                      yet, see ADR 0006
  toilets/nearby-response.ts
                      shapes one DB row into the nearby-API response item;
                      enum values pass through unchanged, never booleans
  toilets/fetch-nearby.ts
                      client-side call to the nearby API; never throws
  toilets/marker-diff.ts
                      pure add/remove reconciliation between a marker id set
                      and a new toilet list
  toilets/marker-element.ts
                      builds one toilet marker's DOM element and its
                      selected-state toggle
  toilets/marker-label.ts
                      accessible name for a marker: name + rounded distance
  toilets/rank-nearby.ts
                      reorders nearby results by distance + access-type
                      confidence, a named metre-penalty table (TASK-009,
                      ADR 0007); pure, no database
  toilets/preview-copy.ts
                      maps priceState/openingStatus to dictionary copy and
                      formats the distance/ETA line for the nearest-toilet
                      preview (TASK-010); pure, no React/DOM; reused by the
                      detail sheet
  toilets/detail-copy.ts
                      maps FeatureState/ConfidenceLevel to dictionary copy
                      for the toilet detail sheet (TASK-011); pure, no
                      React/DOM
  ingest/upsert.ts    source-agnostic write path; never deletes, marks not_seen_since
  ingest/osm/         the OpenStreetMap adapter: fetch, validate, normalize
db/
  queries/nearby.ts   the nearby-toilets PostGIS query (TASK-007); active-only,
                      distance order, server-capped result count
db/
  client.ts           shared pg connection pool
  postgis.ts          PostGIS availability/version read
  migrations/         timestamped SQL migrations run by node-pg-migrate
    *_enable-postgis.sql   baseline: the extension only
    *_toilet-schema.sql    toilets, toilet_source_records, ingestion_runs, enums
scripts/
  db/check-postgis.ts PostGIS health check (pnpm db:check)
  ingest/osm.ts       the ingestion command (pnpm ingest:osm)
  research/           one-off source probes; not application code, not in CI
tests/
  unit/               no external services
  integration/        real Postgres/PostGIS; skips when DATABASE_URL is unset
  fixtures/osm/       synthetic elements for the ingestion tests, not real data
e2e/
  home.spec.ts        Playwright smoke test
```

Ownership:

- `app/` = HTTP/UI composition. It holds no domain logic.
- `lib/` = framework-independent modules. Only `lib/env/server.ts` reads
  `process.env` for application configuration.
- `db/` = persistence and migrations.
- `scripts/` = operational scripts run outside request serving.

## Configuration

- `next.config.ts` — Next.js configuration, including the `/` to `/pl` redirect
- `tsconfig.json` — TypeScript strict, `@/*` path alias to the repository root
- `eslint.config.mjs` — flat config extending `eslint-config-next`
- `vitest.config.ts` — `unit` and `integration` projects
- `playwright.config.ts` — mobile viewport, builds and serves the app itself
- `.prettierrc.json`, `.prettierignore` — planning documents are excluded
- `.nvmrc`, `package.json` `engines` — Node runtime expectation
- `.env.example` — variable names only
- `vercel.json` — framework, lockfile-enforced install, security headers
- `.github/workflows/ci.yml` — `quality`, `database` and `e2e` jobs

## Decisions

- `docs/adr/0001-foundation-stack.md` — package manager, runtime, migration
  tooling, test runners, styling approach.
- `docs/adr/0002-locale-in-the-url.md` — why the locale is a route segment.
- `docs/adr/0003-first-data-source.md` — OpenStreetMap first, city dataset
  deferred, field-level source table, consequences for the schema.
- `docs/adr/0004-schema-conventions.md` — unknown is a value, trigger-maintained
  timestamps, never-delete provenance, and every departure from
  `ARCHITECTURE.md` section 5 with its reason.
- `docs/adr/0005-map-tile-provider.md` — MapTiler as the provisional,
  configurable tile provider, and why the map shell requires a fallback state.
- `docs/adr/0006-nearby-api-contract.md` — feature fields as enum strings not
  booleans, `openingStatus` always `UNKNOWN` until TASK-013, no `filters`
  field until TASK-016, the walking-time constant.
- `docs/adr/0007-recommendation-ranking-formula.md` — the nearby API's result
  order is distance plus a named per-`access_type` metre penalty; the other
  four PRODUCT.md section 11 ranking criteria are named as currently inert,
  not silently dropped.
- `docs/contracts/osm-toilets-source.md` — what OpenStreetMap provides and the
  shape the ingestion adapter consumes.
- `docs/research/` — dated research snapshots. Evidence, not a source of truth;
  see `docs/research/README.md`.

## Approved design reference

`docs/design/reference/gdziekibel-approved-direction.png`

## Not yet created

A Warsaw map shell renders, the location permission ask/grant/deny flow
works, and nearby toilets fetch and render as clickable, selectable markers
(one visual state only; see ADR 0006 and TASK-008's own notes on why). The
nearby API orders results by distance plus access-type confidence (TASK-009,
ADR 0007), verified against a real PostGIS database and a real running
production build (see PROGRESS.md), and the map shell shows that top-ranked
result as a collapsed preview card (TASK-010). Tapping the preview, or a
marker, now opens a toilet detail sheet (TASK-011) with name, distance/ETA,
status/price, accessibility features, and a confidence hint — all real
values, no fabricated ones. No primary navigation CTA, hours display, or
report control exists on that sheet yet (each is a later task's job; see
`tasks/011-toilet-detail-sheet.md`). No filters or accessible list view
exists yet. No deduplication, opening-hours parsing, real confidence
scoring, reporting, analytics or error-tracking code exists. Ingestion
exists but has never run against the live source, and the map — tiles, the
location dot, and the toilet markers — has never been visually observed
rendering for real from this session. Those areas are owned by later tasks.

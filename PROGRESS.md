# Project status

## Current baseline

- Product direction: defined in `PRODUCT.md`.
- Brand direction: defined in `BRAND.md`.
- Design direction: defined in `DESIGN.md`.
- Architecture proposal: defined in `ARCHITECTURE.md`.
- Ordered roadmap: defined in `PLAN.md`.
- Approved visual reference: `docs/design/reference/gdziekibel-approved-direction.png`.
- Production application code: foundation only (TASK-001). Next.js App Router
  application with a minimal shell page. No product feature is implemented.
- Database migrations: `1789277236377_enable-postgis.sql` (PostGIS) and
  `1789302217027_toilet-schema.sql` (TASK-003: `toilets`,
  `toilet_source_records`, `ingestion_runs`). No `toilet_reports` table yet.
  Tables are empty; no ingestion exists.
- Deployment: not deployed. Vercel-compatible configuration exists
  (`vercel.json`) and the preview path is documented in `README.md`.

## Completed planning artefacts

- PRODUCT.md
- BRAND.md
- DESIGN.md
- ARCHITECTURE.md
- PLAN.md
- AGENTS.md
- CLAUDE.md
- docs/CODEMAP.md
- tasks/001-project-foundation.md

## Completed tasks

### TASK-001 — Project foundation

Created: Next.js 16 App Router app with TypeScript strict mode, central CSS
design tokens, a Zod-validated server environment module, a `pg` connection
pool with a PostGIS health check, `node-pg-migrate` SQL migrations, Vitest unit
and integration projects, a Playwright smoke test, a GitHub Actions CI workflow
and Vercel build configuration. `docs/adr/0001-foundation-stack.md` records the
tooling decisions.

### TASK-002 — Data-source research and source decision

Verification run on 2026-09-13 (11:53–12:15 UTC) from a sandboxed agent
environment. Everything observed is recorded, with URL and time, in
`docs/research/2026-09-13-task-002-live-observations.md`. Outputs:

- `docs/adr/0002-toilet-data-sources.md` — source decision, OSM licence and
  share-alike position (flagged for legal review), periodic extract instead of
  live Overpass, Warsaw area = OSM relation 336074, metro rule, curated hub
  layer, field-level source table, licence compatibility conclusion.
- `docs/contracts/toilet-sources.md` — normalised source record and the
  mapping for the `osm`, `metro-rule` and `hub-curated` adapters; `warsaw-city`
  reserved but not contracted.
- `docs/research/README.md` and `docs/CODEMAP.md` updated for the new files.

Observed:

- Reachable: `warszawa19115.pl`, `overpass-api.de`, `wiki.openstreetmap.org`,
  `www.openstreetmap.org`, `osmfoundation.org`, `pkp.pl`.
- Unreachable: `dane.um.warszawa.pl`, `api.um.warszawa.pl`, `iot.warszawa.pl`
  (proxy opens the tunnel, TLS handshake reset by peer on every attempt;
  HTTP 503 via the probe and via a second fetch path). Blocked at the proxy
  (HTTP 403 to CONNECT): `um.warszawa.pl`, `mapa.um.warszawa.pl`,
  `metro.waw.pl`, `opendatacommons.org`, `dane.gov.pl`,
  `download.geofabrik.de`, every public Overpass instance other than
  `overpass-api.de`.
- `pnpm research:probe -- --full`: all 16 catalogue requests HTTP 503; the
  three Overpass requests HTTP 503 (Node `fetch` through the proxy); script
  exited non-zero, as designed. Overpass was subsequently reached with `curl`
  GET requests.
- OSM `amenity=toilets` inside relation 336074: 562 (448 nodes, 114 ways),
  data timestamp 2026-09-13T12:01:20Z. Bounding-box fallbacks: 604
  `amenity=toilets`, 224 features with any `toilets=*` tag. Tag coverage
  over the 604: `fee` 70%, `wheelchair` 68%, `changing_table` 44%, `access`
  32%, `opening_hours` 27%, `name` 0.8%.
- Overpass main instance returned HTTP 429 once and HTTP 504 "server is
  probably too busy" on most area queries; every other public instance was
  blocked. The egress relay cuts responses slower than about ten seconds.
- Metro rule read from the 19115 page (updated 2026-09-10): all stations,
  daily 06:00–22:00, free, outside the ticket zone.
- PKP: no structured feed found; toilet facts observed for Warszawa
  Zachodnia, Wschodnia and Centralna; ten further Warsaw stations listed with
  no toilet fact observed.
- OSM licence, attribution guidelines and the Collective Database, Horizontal
  Layers, Substantial, Produced Work and Trivial Transformations guidelines
  read and quoted at source. The ODbL legal text itself could not be fetched.

Decision: TASK-004 ingests OSM (periodic extract) plus the metro rule and the
curated hub layer. The Warsaw city dataset is **not** a first source, because
none of its ten acceptance items could be observed and an unverified licence
blocks ingestion. It remains the intended authoritative source for city-listed
facilities once verified.

Repository checks after the change: `pnpm lint`, `pnpm format:check`,
`pnpm typecheck` and `pnpm test:unit` (23 tests, 3 files) all pass on
2026-09-13. No application code, schema or dependency changed.

### TASK-003 — Canonical toilet schema + first source contract

Specified in `tasks/003-canonical-toilet-schema.md` (written at the start of
the task, from the `PLAN.md` entry, `ARCHITECTURE.md` 4/5/6/19 and the TASK-002
contract). Implemented on 2026-09-13:

- `db/migrations/1789302217027_toilet-schema.sql` — `toilets` (geography
  point, GiST index, CHECK-constrained sets, three-state facility columns),
  `toilet_source_records` (unique `(source_name, source_record_id)`,
  `source_url NOT NULL`, `missing_since`, FK `ON DELETE SET NULL`),
  `ingestion_runs` (nullable counts, lifecycle CHECKs), one `updated_at`
  trigger function. Down migration drops exactly those objects.
- `lib/toilets/source-record.ts` — `SourceToiletRecord` Zod schema and
  `parseSourceToiletRecord`; strict objects, unknown → `null`, booleans only,
  http(s) `source_url`, bounded WGS84 position, no value echoed in errors.
- `tests/unit/source-record.test.ts` (10 tests) and
  `tests/integration/toilet-schema.test.ts` (10 tests against real PostGIS).
- `docs/adr/0003-toilet-schema.md` — departures from the suggested fields.
- `docs/contracts/toilet-sources.md` points at the module and tables;
  `docs/CODEMAP.md` and `README.md` updated.

Verification observed on 2026-09-13 against local PostgreSQL 16.13 with
PostGIS 3.4.2 (package installed in the session; the cluster was present but
stopped), database `gdziekibel_test`:

| Command | Result |
| --- | --- |
| `pnpm lint` | pass |
| `pnpm format:check` | pass |
| `pnpm typecheck` | pass |
| `pnpm test:unit` | pass, 33 tests in 4 files |
| `pnpm db:migrate` (empty DB) | pass, both migrations applied |
| `pnpm db:migrate:down` | pass; `to_regclass` of all three tables and the function count read NULL/0 afterwards |
| `pnpm db:migrate` (again) | pass |
| `pnpm db:check` | `PostGIS OK — installed version 3.4.2` |
| `pnpm test:integration` | pass, 12 tests in 2 files |
| `pnpm build` | pass, `/` and `/_not-found` static |

No adapter, reconciliation, API, UI or report code was created. No dependency
changed.

## Verification at current baseline

All commands run on 2026-09-13 against Node v22.22.2, pnpm 10.33.0 and a local
PostgreSQL 16.13 with PostGIS 3.4.2. `node_modules` and `.next` were deleted
before the run.

| Command                   | Result                                              |
| ------------------------- | --------------------------------------------------- |
| `pnpm install --frozen-lockfile` | pass, lockfile satisfied                     |
| `pnpm lint`               | pass, no findings                                    |
| `pnpm format:check`       | pass, all matched files match Prettier style         |
| `pnpm typecheck`          | pass, no diagnostics                                 |
| `pnpm test:unit`          | pass, 23 tests in 3 files                            |
| `pnpm build`              | pass, `/` and `/_not-found` prerendered as static     |
| `pnpm db:migrate`         | pass, baseline applied to an empty database          |
| `pnpm db:check`           | pass, `PostGIS OK — installed version 3.4.2`         |
| `pnpm test:integration`   | pass, 2 tests                                        |
| `pnpm test:e2e`           | pass, 1 test in the `mobile-chromium` project        |

Also observed:

- `pnpm dev --port 3210` served the shell with HTTP 200 and the GdzieKibel.pl
  wordmark in the response body.
- `pnpm test:integration` skips both tests cleanly when `DATABASE_URL` is unset,
  rather than failing or reporting a fabricated pass.
- Running `pnpm build` after `pnpm format` leaves `tsconfig.json` unchanged, so
  Next.js and Prettier do not fight over that file.
- A clean `git clone` of the pushed branch builds with the exact commands
  `vercel.json` pins (`pnpm install --frozen-lockfile`, then `pnpm build`) with
  `DATABASE_URL` unset. This confirms the lazy environment validation does not
  break a deployment build.

## Observed facts worth recording

- `next dev` detects an AI coding agent and appends a marked
  `nextjs-agent-rules` block to `AGENTS.md`, re-adding it if removed. The block
  is committed as tool-managed content. It adds framework guidance only and
  changes no project rule.
- `@playwright/test` is pinned to 1.56.0 rather than the newest release because
  that is the version matching the Chromium build available in the verification
  environment, which allowed the E2E smoke test to be observed passing. CI
  installs its own browser, so the pin can be raised in a later task.
- CI runs E2E in a separate job. It was not deferred.
- The `enable-postgis` down migration is deliberately a no-op, because dropping
  PostGIS would cascade into every geometry column.

## Known unresolved decisions

- Warsaw city toilet dataset: identifier, endpoint, schema, count, cadence,
  licence, pagination, deletion semantics, timestamps and status field are
  all unobserved (TASK-002 blocker below). Which service to consume when
  reachable is decided: `dane.um.warszawa.pl`.
- OSM share-alike reach: ADR 0002 takes the conservative reading (toilet
  layer is an ODbL Derivative Database) and flags it for legal review.
- Final production map tile provider.
- Final analytics provider.
- Real-data deduplication thresholds.

These are intentionally unresolved and must not be silently treated as facts.

Resolved by TASK-001: the migration/schema tooling choice is now
`node-pg-migrate` with plain SQL files, recorded in
`docs/adr/0001-foundation-stack.md`.

Resolved by TASK-002: first ingestion sources (OSM extract, metro rule,
curated hub layer), Warsaw area definition (OSM relation 336074), periodic
extract rather than live Overpass, and the field-level source table, recorded
in `docs/adr/0002-toilet-data-sources.md`.

## Unresolved blockers

TASK-002, one blocker: the Warsaw city toilet dataset could not be verified.
On 2026-09-13 `dane.um.warszawa.pl`, `api.um.warszawa.pl` and
`iot.warszawa.pl` reset the TLS handshake on every attempt from the agent
environment (previous environment: HTTP 403 at the proxy). Nothing about the
dataset was observed. Until the ten items in
`tasks/002-data-source-research.md` ("Warsaw city open data") are observed
from a network that can reach those hosts, no city adapter is written and no
product field is sourced from the city. `pnpm research:probe` is the
re-verification tool; its output goes to the gitignored `.research-output/`.

None for TASK-001.

Not verifiable in this environment, and therefore not claimed:

- No Vercel preview deployment was created; the deployment path is documented
  but unexercised. The Vercel integration available to this session reports no
  team, and linking a git project is refused without a team ID, so the
  deployment could not be created or inspected from here. Direct network access
  to Vercel hosts is also blocked by the environment's egress policy.
- CI has not been observed running on GitHub; the workflow is untested there.
- The TASK-002 verification of the Warsaw city dataset (see blocker above).
  The OSM, 19115 and PKP parts of TASK-002 were observed on 2026-09-13 from a
  later environment that could reach those hosts.

## Next approved task

`TASK-004 — Ingest first Warsaw toilet dataset`, per `PLAN.md`. No task file
exists yet. Inputs: `docs/contracts/toilet-sources.md`,
`lib/toilets/source-record.ts`, ADR 0002 D3–D6 and ADR 0003. The TASK-002
city-dataset blocker stops only the city adapter, not the OSM, metro-rule or
hub-curated adapters.

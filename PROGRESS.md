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
- Database migrations: two. `1789277236377_enable-postgis.sql` enables the
  extension; `1789312508934_toilet-schema.sql` creates `toilets`,
  `toilet_source_records`, `ingestion_runs` and their enumerated types. The
  tables hold no rows.
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

Decision made and recorded; observation gaps remain and are listed below. Desk
research was supplied by the project owner on 2026-09-13 and
is committed verbatim at `docs/research/2026-09-13-warsaw-toilet-sources.md`.
The task specification exists at `tasks/002-data-source-research.md`.

The research states in its own limitations section that the Warsaw open-data
toilet dataset endpoint, schema and licence were not verified against the live
service. That verification is the remaining work and has not been done.

A probe that performs the observable part of it exists at
`scripts/research/probe-sources.ts`, run with `pnpm research:probe`. Observed on
2026-09-13: every request it makes is refused from this environment with HTTP
403 at the egress proxy, and the script reports that as a blocker and exits
non-zero rather than producing a result. Its success path has therefore never
run.

Reviewed and extended later the same day. The probe originally read only the
dataset catalogue, which cannot reveal a field list, a record count or an
example record, all three of which the task requires as observed values. It now
samples each catalogue resource that carries a datastore id with one
`datastore_search` call at `limit=1`, capped at ten per run, and writes the
observed fields, total and first record into the report. Catalogue and datastore
calls time out after 30 seconds instead of three minutes; Overpass keeps three
minutes to match its own query timeout. The User-Agent now carries the
repository URL as the contact point Overpass policy expects. Its parsers are
covered by fourteen unit tests against recorded response shapes, which assert
that a missing licence reads as null, that a missing total reads as null rather
than zero, and that a malformed payload yields nothing.

Dry run observed on 2026-09-13 with `RESEARCH_OUTPUT_DIR` pointed outside the
repository: 18 requests, every one answered HTTP 403 by the egress proxy, raw
bodies saved, report written with the schema section marked UNVERIFIED, exit
code 1. That is the failure path behaving as designed, not a result.

First run from an environment that permits the hosts, reported by the project
owner on 2026-09-13:

- Overpass answered HTTP 200 for the `amenity=toilets` count, and HTTP 504 for
  the venue `toilets=*` count.
- All 16 Warsaw catalogue requests answered HTTP 503. Both hosts, both CKAN
  paths, all four search terms. A 503 is a response from Warsaw's own servers,
  unlike the proxy's 403, so the network allowlist works and the catalogue
  itself did not serve the request.
- No dataset, field list, record count, example record or licence has therefore
  been observed. Every one of them remains UNVERIFIED.

What the 503 means is not yet known. It could be the service being down, the
CKAN assumption in the probe being wrong for the current platform, or a gateway
refusing the request. The probe now records the content type and the first 240
characters of every failed body, so the next run distinguishes these instead of
reporting a bare status code. The Overpass 504 is ordinary overload, and each
Overpass query is now retried once after a pause.

The run also exposed a reporting defect the owner spotted: the script exited 0
because a single request succeeded, although the catalogue question it exists to
answer was untouched. It now exits 2 in that case, and 1 only when everything
fails.

**Decision, project owner, 2026-09-13: the city dataset is deferred.** Rather
than block the roadmap on a service returning 503 to every request,
OpenStreetMap becomes the first ingestion source and the city dataset is
revisited in a later task. `tasks/002-data-source-research.md` was rewritten
around that decision. The deferral is recorded as a deferral, not as an
evaluation: nothing about the city dataset has been observed, and its
identifier, schema, cadence and licence all remain unverified.

What this costs, from the research: the city's private-venue agreements,
official opening hours for municipal toilets, and the metro rule as an official
record. The schema in TASK-003 keeps source records separate from the canonical
toilet, so adding the city later is additive rather than a rebuild.

**Deliverables written on 2026-09-13**, from a session whose egress denies
every OpenStreetMap and Warsaw host, so nothing in them was observed live from
that session:

- `docs/contracts/osm-toilets-source.md`: acquisition, area, element shape,
  identity, change detection, field mapping with unknown semantics, validation
  rules, and what the source does not provide. Every statement is marked
  OBSERVED, DECIDED or UNVERIFIED.
- `docs/adr/0003-first-data-source.md`: OpenStreetMap first, weekly bounded
  Overpass pull with an extract fallback, Warsaw administrative boundary as the
  area, a hand-curated anchor layer for metro and stations, the city dataset
  deferred with its evidence, a field-level source table, and the consequences
  for the TASK-003 schema.

**Still unverified, and what closes each:**

| Item | Closes when |
| --- | --- |
| `amenity=toilets` count in the probe bbox | `pnpm research:probe -- --full` from the GdzieKibel environment; paste the value and query into ADR 0003 section 6 |
| `toilets=*` venue count | same run |
| Tag coverage for opening hours, fee, access, wheelchair, changing table, operator, name, level | same run |
| ODbL name, version and attribution wording, quoted and dated | a live read of the Legal FAQ and the OSMF attribution guidelines |
| Share-alike design choice | legal review; the schema keeps both designs open meanwhile |
| Warsaw administrative boundary relation id | TASK-004 |

The one run that returned HTTP 200 from Overpass on 2026-09-13 produced a
count, but the value was not carried into the repository. It is not recorded
here because it was not seen here.

### TASK-003 — Canonical toilet schema + first source contract

Complete on 2026-09-13. Specified in `tasks/003-canonical-toilet-schema.md`.

Created: one reversible SQL migration with six enumerated types, the three
tables from `ARCHITECTURE.md` section 5 minus `toilet_reports` (TASK-020),
GiST indexes on both geography columns, and trigger-maintained `updated_at`.
Every inferable attribute is an enum with an explicit `unknown` member as its
default; no boolean defaults to `false`. TypeScript mirrors the enums in
`lib/toilets/types.ts`, and a test reads the migration to keep them in step.
The adapter contract is `lib/toilets/normalized-source-record.ts`, a strict
Zod schema that requires every field so an adapter must state `unknown` on
purpose. `docs/adr/0004-schema-conventions.md` records each departure from the
architecture with its reason.

Observed:

- the migration applies to an empty PostGIS database and `pnpm db:check`
  passes afterwards;
- `pnpm db:migrate:down` drops exactly the objects the up step created, leaves
  PostGIS installed, and `pnpm db:migrate` recreates them; integration tests
  pass again after the round trip;
- ten integration tests prove the unknown defaults, enum rejection, the
  `ST_DWithin` radius query, the GiST index, the unique constraint on source
  records, the `updated_at` trigger, unlink-not-delete on toilet removal, and
  the ingestion run time check.

Not created, by design: any row, any adapter, any query module, any report
table.

### TASK-004 — Ingest first Warsaw toilet dataset (OpenStreetMap)

Code complete on 2026-09-13; **not run against the live source**. Specified in
`tasks/004-ingest-osm-toilets.md`.

Created: `lib/ingest/osm/` (fetch, validate, normalize), the source-agnostic
`lib/ingest/upsert.ts`, and the command `pnpm ingest:osm`. The Warsaw
administrative boundary is resolved at run time by tags and printed; the command
aborts rather than guess when the answer is not a single admin_level 6 relation.
OSM account fields are stripped before a response is saved or stored. The whole
upsert is one transaction.

Observed on 2026-09-13, replaying `tests/fixtures/osm/elements.json` against a
freshly migrated database:

| Run | Fetched | Created | Unchanged | Rejected |
| --- | --- | --- | --- | --- |
| first | 4 | 4 | 0 | 2 |
| second | 4 | 0 | 4 | 2 |

The two rejections are the fixture's deliberate bad cases: an element with no
position and one outside the coarse Warsaw box. Both were reported by key and
reason, never by dumping the element.

The stored rows show the unknown rule holding: a node carrying only
`amenity=toilets` reads back with access, price, wheelchair and changing table
all `unknown`, while a node with `access=customers` reads `customers_only` and
`wheelchair=no`. Absence and negation stayed distinct through the whole
pipeline.

**Still to do before TASK-004 can be called complete:** one live run from the
GdzieKibel cloud environment, recording the boundary relation it resolved and
its counts. This session's egress denies `overpass-api.de`.

Not created, by design: any deduplication, opening-hours parsing, confidence
scoring, scheduled workflow, query module or UI.

### Owner-directed additions outside the task sequence

**Polish/English language switch, 2026-09-13.** Requested by the project owner
after TASK-001 and after the first production deployment. The locale is a route
segment, `/pl` and `/en`, with the bare domain redirecting to `/pl`. Copy lives
in `lib/i18n/dictionaries.ts`. Recorded in `docs/adr/0002-locale-in-the-url.md`.

This is not part of TASK-001 or TASK-002. It is logged here so the roadmap
reflects what the repository actually contains.

**First production deployment, 2026-09-13.** Deployed to Vercel at
`https://gdziekibel-bienos.vercel.app`, confirmed loading by the owner. The
deployment was made by uploading files directly, not by linking the GitHub
repository, because the Vercel integration available to this session has no
team read access: `list_teams` returns an empty list and reads against the
`bienos` scope are refused with HTTP 403. Consequences, which stand until the
repository is imported from the Vercel dashboard:

- pushes to the repository do not rebuild the site;
- the live site was built from eight uploaded files and a trimmed
  `package.json`, not from the committed tree;
- `vercel.json` was not exercised by that build.

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
| `pnpm test:unit`          | pass, 73 tests in 8 files                            |
| `pnpm build`              | pass, `/pl` and `/en` prerendered as static HTML      |
| `pnpm db:migrate`         | pass, both migrations applied to an empty database   |
| `pnpm db:check`           | pass, `PostGIS OK — installed version 3.4.2`         |
| `pnpm test:integration`   | pass, 19 tests in 3 files                            |
| `pnpm test:e2e`           | pass, 2 tests in the `mobile-chromium` project       |

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

- Warsaw city open-data toilet dataset: deferred, unobserved. See ADR 0003
  section 4.
- OpenStreetMap licence text and attribution wording: cited by the research,
  not yet read live and quoted.
- Whether the product database is a Derivative Database under ODbL share-alike:
  flagged for legal review; the schema keeps both designs open.
- Final production map tile provider.
- Final analytics provider.
- Real-data deduplication thresholds.

These are intentionally unresolved and must not be silently treated as facts.

Resolved by TASK-001: the migration/schema tooling choice is now
`node-pg-migrate` with plain SQL files, recorded in
`docs/adr/0001-foundation-stack.md`.

Resolved by TASK-002: the first data source is OpenStreetMap, acquired by a
weekly bounded Overpass pull, recorded in `docs/adr/0003-first-data-source.md`
and `docs/contracts/osm-toilets-source.md`.

## Unresolved blockers

None for TASK-001.

Not verifiable in this environment, and therefore not claimed:

- No Vercel preview deployment was created; the deployment path is documented
  but unexercised. The Vercel integration available to this session reports no
  team, and linking a git project is refused without a team ID, so the
  deployment could not be created or inspected from here. Direct network access
  to Vercel hosts is also blocked by the environment's egress policy.
- CI has not been observed running on GitHub; the workflow is untested there.
- A separate cloud environment with an allowlist for the Warsaw and
  OpenStreetMap hosts was created on 2026-09-13. No session has yet reported a
  successful probe run from it; the one session that ran after its creation
  recorded the same HTTP 403 denials. Whether that session used the new
  environment is not recorded.
- The TASK-002 source verification could not be started from this environment.
  On 2026-09-13 the egress proxy answered HTTP 403 to CONNECT for
  `dane.um.warszawa.pl`, `api.um.warszawa.pl`, `iot.warszawa.pl`,
  `warszawa19115.pl` and `overpass-api.de`. No Warsaw or OpenStreetMap value has
  been observed, so none is recorded as fact.

## Next approved task

One live ingestion run, from a session in the GdzieKibel cloud environment:

```
git pull && pnpm install --frozen-lockfile
pnpm db:migrate
pnpm ingest:osm
```

Record the boundary relation it resolves and its counts here. That closes
TASK-004 and, with the same run, most of the TASK-002 observation gaps.

Then `TASK-005 — Render Warsaw map shell` per `PLAN.md`, which needs a
`tasks/005-*.md` file and a decision on the map tile provider, still open in
`ARCHITECTURE.md` section 23.

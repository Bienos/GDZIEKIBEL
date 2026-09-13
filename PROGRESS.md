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
- Database migrations: one baseline migration,
  `db/migrations/1789277236377_enable-postgis.sql`, which only enables the
  PostGIS extension. No product-domain tables exist.
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

Not complete. Desk research was supplied by the project owner on 2026-09-13 and
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
run. Its parsers are covered by nine unit tests against recorded response
shapes, which assert that a missing licence reads as null and that a malformed
payload yields nothing.

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

- Final Warsaw toilet data source(s) and licences.
- Final production map tile provider.
- Final analytics provider.
- Real-data deduplication thresholds.

These are intentionally unresolved and must not be silently treated as facts.

Resolved by TASK-001: the migration/schema tooling choice is now
`node-pg-migrate` with plain SQL files, recorded in
`docs/adr/0001-foundation-stack.md`.

## Unresolved blockers

None for TASK-001.

Not verifiable in this environment, and therefore not claimed:

- No Vercel preview deployment was created; the deployment path is documented
  but unexercised. The Vercel integration available to this session reports no
  team, and linking a git project is refused without a team ID, so the
  deployment could not be created or inspected from here. Direct network access
  to Vercel hosts is also blocked by the environment's egress policy.
- CI has not been observed running on GitHub; the workflow is untested there.
- The TASK-002 source verification could not be started from this environment.
  On 2026-09-13 the egress proxy answered HTTP 403 to CONNECT for
  `dane.um.warszawa.pl`, `api.um.warszawa.pl`, `iot.warszawa.pl`,
  `warszawa19115.pl` and `overpass-api.de`. No Warsaw or OpenStreetMap value has
  been observed, so none is recorded as fact.

## Next approved task

`TASK-002 — Data-source research and source decision`. Specified in
`tasks/002-data-source-research.md`. Blocked on network access to the Warsaw and
OpenStreetMap services, which this environment denies.

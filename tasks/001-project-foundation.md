# TASK-001 — Project foundation

## Goal

Create the minimum deployable and testable project foundation for GdzieKibel.pl without implementing user-facing toilet functionality.

At completion, a new developer/agent can install dependencies, run the app locally, run quality checks/tests, connect to a development Postgres/PostGIS database, and deploy a minimal shell.

## User-visible outcome

A minimal branded shell can load successfully, but it does **not** yet show a map, request location, query toilets or implement product features.

The shell should prove the stack and deployment path only.

## Acceptance criteria

### Repository / framework

- Next.js App Router application exists.
- TypeScript strict mode is enabled.
- Package manager and lockfile are committed.
- Node/runtime version expectation is documented or pinned.
- App starts locally with one documented command.

### Minimal visual shell

- Root page renders a minimal GdzieKibel.pl shell using approved base colours/type tokens.
- It may display the wordmark and a non-functional placeholder line only.
- It must not implement the hero flow, map, geolocation, toilet data or navigation.

### Styling/design tokens

- Central CSS/design tokens exist for at least:
  - background,
  - text,
  - signal yellow,
  - hot pink,
  - open/closed/uncertain states,
  - spacing baseline.
- No broad component library should be built yet.

### Environment/config

- Environment access is validated through one typed/validated configuration module.
- `.env.example` exists with variable names only.
- Secrets are not committed.
- `DATABASE_URL` is supported for development/test environments.

### Database baseline

- PostgreSQL connection tooling is installed/configured.
- PostGIS requirement is documented and a health/check script or test verifies the extension is available in the configured development/test DB.
- A migration mechanism is chosen and documented.
- No product-domain tables beyond the migration baseline are required in this task.

### Quality tooling

- lint command works.
- typecheck command works.
- unit test command works with at least one trivial foundation test.
- production build command works.
- formatting tooling may be configured if it does not create noisy repository-wide rewrites.

### Integration/E2E baseline

- Playwright (or accepted E2E tool from architecture) is configured.
- One smoke test proves the home page loads and contains the GdzieKibel.pl identity.
- Do not create product-flow E2E tests yet.

### CI

A CI workflow runs at minimum:

- dependency install with lockfile enforcement,
- lint,
- typecheck,
- unit tests,
- build.

E2E may run in CI if setup is stable at this stage; otherwise document why it is deferred to the next relevant task.

### Deployment baseline

- Vercel-compatible build/deploy configuration exists.
- A preview/staging deployment path is documented.
- No production deployment is required unless explicitly instructed outside this task.

### Documentation/state

- `docs/CODEMAP.md` is updated to describe the actual created module/entry-point structure.
- `PROGRESS.md` records observed verification results and any unresolved blockers.

## In scope

- project scaffold,
- Next.js + TypeScript,
- styling/token baseline,
- environment validation,
- Postgres/PostGIS connectivity baseline,
- migration tooling decision/setup,
- lint/typecheck/test/build tooling,
- E2E smoke setup,
- CI baseline,
- deployable shell,
- code map/progress update.

## Out of scope

Do **not** implement:

- map rendering,
- MapLibre,
- map tile provider integration,
- geolocation permission,
- user location marker,
- toilet tables/domain schema,
- Warsaw source ingestion,
- nearby toilet API,
- toilet markers,
- ranking,
- opening-hours logic,
- filters,
- external navigation,
- report form,
- analytics,
- Sentry,
- user accounts,
- admin UI.

If a dependency would only be needed for one of these later features, do not add it now.

## Canonical context to read

Read:

- `AGENTS.md`
- `PROGRESS.md`
- `ARCHITECTURE.md` sections 1–4, 16–20
- `DESIGN.md` sections 3–6 for baseline tokens only
- `BRAND.md` only as needed for the minimal shell identity

Do not read the full visual/copy library unless required.

## Constraints

- Prefer stable, widely used packages.
- Avoid dependency upgrades unrelated to foundation.
- Do not introduce a UI component framework unless there is a clear approved need.
- Do not introduce microservices.
- Do not create product schema speculatively.
- Do not copy precise mockup layouts into the foundation shell.
- Keep secrets and precise personal location out of logs/config examples.
- Do not modify product/brand/design/architecture requirements merely to fit scaffold defaults.

## Read-only preflight

Before editing:

1. inspect repository contents;
2. inspect git status/diff;
3. confirm whether a framework scaffold already exists;
4. confirm package manager if already established;
5. report a concise implementation plan based on actual repository state.

Do not overwrite an existing application scaffold without evidence that replacement is required.

## Verification

Run and record the exact project commands for:

- install from lockfile,
- lint,
- typecheck,
- unit tests,
- production build,
- PostGIS connectivity/extension check,
- E2E smoke test if configured to run locally.

Also inspect the complete git diff.

## Definition of done

TASK-001 is complete only when:

- all acceptance criteria are satisfied;
- the minimal app runs locally;
- required verification is observed passing or an explicit blocker is recorded;
- `docs/CODEMAP.md` reflects the actual repository;
- `PROGRESS.md` contains factual results;
- no toilet/product feature has leaked into scope;
- the complete diff contains no unrelated changes.

Then stop. Do not begin TASK-002.

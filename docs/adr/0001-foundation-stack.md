# ADR 0001 — Foundation tooling choices

Status: Accepted
Date: 2026-09-13
Scope: TASK-001 — Project foundation

## Context

`ARCHITECTURE.md` fixes the stack direction (Next.js App Router, TypeScript
strict, PostgreSQL + PostGIS, Vercel, Playwright) but deliberately leaves the
package manager, migration tooling and unit test runner to the foundation task.
Section 23 lists them among the decisions still requiring validation.

## Decisions

### Package manager: pnpm

Committed `pnpm-lock.yaml`, `packageManager` pinned in `package.json`, and CI
installs with `pnpm install --frozen-lockfile`. Vercel detects pnpm from the
lockfile. Chosen for strict, non-flat `node_modules`, which surfaces missing
direct dependencies at development time rather than in a production build.

### Runtime: Node 22 LTS

Pinned via `.nvmrc` and the `engines` field, and consumed in CI through
`node-version-file`. One source of truth for the expected runtime.

### Migrations: node-pg-migrate with plain SQL files

Migrations live in `db/migrations/` as timestamped `.sql` files with
`-- Up Migration` / `-- Down Migration` sections, applied by `pnpm db:migrate`.

Chosen over an ORM-owned schema because `ARCHITECTURE.md` 6 and 19 require
hand-written PostGIS DDL (geography columns, GiST indexes) and reviewable
versioned SQL. No ORM is introduced at foundation stage; `pg` is used directly
with parameterised queries.

The baseline migration only runs `CREATE EXTENSION IF NOT EXISTS postgis`. Its
down migration is a deliberate no-op: dropping PostGIS would cascade into every
geometry column, and `AGENTS.md` requires destructive changes to be in explicit
task scope.

### Unit tests: Vitest

Two projects are configured: `unit` (no external services) and `integration`
(real Postgres/PostGIS). Chosen for native ESM and TypeScript handling with no
extra transform configuration.

### E2E: Playwright

One mobile-viewport smoke test, matching the mobile-first design baseline in
`DESIGN.md` 3.

### Styling: CSS custom properties, no component framework

Tokens live in `app/tokens.css` and are consumed through CSS Modules. No UI
component library is added: `ARCHITECTURE.md` 2 keeps design tokens
framework-agnostic and TASK-001 forbids building a component library yet.

### Validation: Zod

Used first for the environment module, and available for request/response
validation in later slices as `ARCHITECTURE.md` 2 anticipates.

## Consequences

- Schema changes are reviewed as SQL, in version control.
- Swapping the styling approach later does not require re-deriving token values.
- Integration tests need a reachable PostGIS database; they skip cleanly when
  `DATABASE_URL` is absent rather than failing or faking a result.

## Not decided here

Tile provider, analytics provider, error tracking and Warsaw data sources remain
open, as recorded in `PROGRESS.md`. No dependency for them is added yet.

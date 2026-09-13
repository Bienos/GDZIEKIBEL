# GdzieKibel.pl

Warsaw public toilet finder. This repository currently contains the project
foundation only: a minimal branded shell, database connectivity baseline and
quality tooling. No map, geolocation or toilet data is implemented yet.

Planning and control documents own their own subjects; see `AGENTS.md`.

## Requirements

- Node.js 22 LTS (`.nvmrc` pins the exact version; `nvm use` picks it up)
- pnpm 10 (`corepack enable pnpm`)
- PostgreSQL 16 with the **PostGIS** extension available

PostGIS is a hard requirement, not an optional add-on: the geospatial query
strategy in `ARCHITECTURE.md` depends on it. On managed Postgres, confirm the
selected plan provides PostGIS before provisioning.

## Setup

```bash
pnpm install --frozen-lockfile
cp .env.example .env.local   # then fill in DATABASE_URL
pnpm db:migrate              # enables PostGIS and creates the toilet schema
pnpm db:check                # verifies the extension is installed
```

`.env.example` lists variable names only. Never commit real values.

## Commands

| Command                | Purpose                                             |
| ---------------------- | --------------------------------------------------- |
| `pnpm dev`             | Start the app locally on http://localhost:3000       |
| `pnpm build`           | Production build                                     |
| `pnpm start`           | Serve the production build                           |
| `pnpm lint`            | ESLint                                               |
| `pnpm typecheck`       | TypeScript, no emit                                  |
| `pnpm test:unit`       | Unit tests (no database needed)                      |
| `pnpm test:integration`| Integration tests against a real PostGIS database     |
| `pnpm test:e2e`        | Playwright smoke test (builds and serves the app)     |
| `pnpm db:migrate`      | Apply SQL migrations from `db/migrations/`            |
| `pnpm db:check`        | PostGIS availability health check                     |
| `pnpm format:check`    | Prettier check (planning documents are excluded)      |

Integration tests skip themselves when `DATABASE_URL` is unset, so the unit
suite stays runnable without a database.

## Local database

Any PostgreSQL 16 with PostGIS works. For example:

```bash
docker run --name gdziekibel-db -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=gdziekibel_dev -p 5432:5432 -d postgis/postgis:16-3.4
```

```
DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/gdziekibel_dev
```

## Migrations

Versioned SQL files in `db/migrations/`, applied with `node-pg-migrate`. Create
a new one with:

```bash
pnpm exec node-pg-migrate create <name> -m db/migrations -j sql
```

Rationale and rules are in `docs/adr/0001-foundation-stack.md`. Destructive
changes require explicit task scope.

## CI

`.github/workflows/ci.yml` runs on every push and pull request:

- **quality**: lockfile install, lint, typecheck, unit tests, production build
- **database**: PostGIS service container, migrations, health check, integration tests
- **e2e**: Playwright smoke test against the production build

## Deployment

Vercel serves web and API; the database is external (Neon is the v1
recommendation). `vercel.json` pins the framework, the lockfile-enforced install
command and baseline security headers.

Preview/staging path:

1. Link the repository to a Vercel project (`vercel link`).
2. Set `DATABASE_URL` in the Vercel project for the Preview environment,
   pointing at a non-production database.
3. Push a branch or open a pull request. Vercel builds a preview deployment per
   commit; verify the shell loads there before promoting.
4. Production promotion stays manual and is out of scope for TASK-001.

Migrations are not run by the Vercel build. Apply them deliberately against the
target database before or after a deployment that needs them.

## Privacy

Precise user location is never logged or persisted, and raw coordinates are
never sent to analytics. See `AGENTS.md` and `ARCHITECTURE.md` 8 and 17.

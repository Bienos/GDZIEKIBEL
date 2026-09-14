# ADR 0025 — Migrations run as part of the Vercel build

Status: Accepted
Date: 2026-09-14
Scope: Owner-directed addition outside the task sequence

## Context

`ARCHITECTURE.md` section 19 requires version-controlled, reviewed
migrations but names no mechanism for actually applying them to a real
deployment; `vercel.json`'s `buildCommand` was, until now, plain `pnpm
build`. The first real production `DATABASE_URL` this project has had
(a Supabase project, connected via its transaction-pooler host) exposed
the gap directly: the live database's schema was several migrations
behind the committed ones — `analytics_rate_limit_windows` (TASK-029)
did not exist, causing a real `500` on every analytics write — because
nothing had ever run `pnpm db:migrate` against it since it was
provisioned earlier in this session.

No session's own sandbox can reach this database directly (confirmed
twice, directly: the connection string's direct host fails DNS
resolution instantly, `ENOTFOUND`; its pooler host's connection hangs to
timeout — this sandbox's egress blocks both, the same class of
restriction recorded all session for MapTiler, Overpass, and Vercel
itself before its own access was fixed). Vercel's own build/runtime
environment, proven directly (a real `POST /api/toilets/nearby` `200`
against this same database), can reach it. That asymmetry is the actual
reason for this decision, not a preference for build-time migrations in
the abstract.

## Decision

`vercel.json`'s `buildCommand` becomes `pnpm db:migrate && pnpm build`.
Every deployment now applies any pending migration from `db/migrations/`
before building, using the exact same reviewed, committed migration
files this project already treats as its schema's source of truth —
`AGENTS.md`'s "no agent may edit production schema manually as an
implementation shortcut" rules out hand-run SQL as a substitute for this,
not the sanctioned migration runner itself.

### Verified safe before wiring it in, not assumed

`db:migrate`'s script (`node-pg-migrate -m db/migrations --envPath
.env.local up`) reads `--envPath .env.local` — a file that does not
exist in Vercel's build environment (it is gitignored, never committed).
Tested directly, against the local database, with `.env.local` moved out
of the way and `DATABASE_URL` supplied only as a real environment
variable (exactly how Vercel provides it, no file): the command still
ran and attempted the real connection from `DATABASE_URL`, rather than
erroring on the missing file. `node-pg-migrate`'s own `--envPath`
loading is a best-effort `dotenv` read that no-ops when the file is
absent, leaving `process.env` — and therefore Vercel's own injected
`DATABASE_URL` — untouched and authoritative.

## Consequences

- A migration error, or the database being briefly unreachable, now
  fails the entire build, blocking the deploy. This is a real, accepted
  trade-off: the alternative — a deploy going out with a schema
  mismatch, exactly what caused the `analytics_rate_limit_windows`
  gap — is worse for a project this size, and no session has a working
  alternative path to apply migrations to this database at all.
- `node-pg-migrate` tracks applied migrations in its own table, so this
  is safe to run on every single deploy: an already-migrated database
  does nothing extra, cheaply confirmed by re-running it.
- No new environment variable, secret, or infrastructure was added —
  this reuses `DATABASE_URL`, already required for the app to run at
  all.

## Not decided here

Whether a larger team, or a schema change large enough to need a real
maintenance window, should move to a manual or gated migration step
instead of an automatic one on every push is a future decision, once
real usage or a real team justifies revisiting it — the same category of
"first pass" judgment as `docs/adr/0016-report-rate-limiting.md`'s rate
limit and `docs/adr/0024-openfreemap-tile-provider.md`'s provider
choice.

# TASK-021 — Report abuse protection

## Goal

`PLAN.md`'s outcome: "report endpoint has measured rate/abuse controls
without storing unnecessary personal data." `ARCHITECTURE.md` section 16
lists "report endpoint spam" as an MVP threat priority and "rate limiting
for report writes" as a required control. `TASK-020` explicitly deferred
this: `docs/adr/0015-toilet-reports.md`'s own words, "adding unreviewed
abuse-tracking fields now... would be premature."

## The design question `ARCHITECTURE.md` leaves open

Section 23's "decisions still requiring validation" names it directly:
"whether report rate limiting needs an external store/provider." Section
20 lists "report rate-limit provider key only if one is adopted" as a
possible environment variable — phrasing that treats an external provider
as optional, not assumed. Section 21 rules out "Redis for ordinary reads"
as a non-goal "without evidence." This task has to answer the question,
not defer it again.

## Design decisions

### Postgres, not a new external store

The deployment target is serverless (`ARCHITECTURE.md` section 22:
"Vercel serves web/API"). A per-process in-memory counter would not
coordinate across function instances or survive a cold start, so it would
not actually limit anything under real traffic — worse than no control at
all, since it would look implemented without being effective. An external
provider (Redis, a dedicated rate-limit service) is available but
`ARCHITECTURE.md` section 21 treats introducing one as something that
needs evidence first, and none exists yet. Postgres (Neon) is already
provisioned, already the source of truth for everything else this project
persists, and a small counter table needs no new service, credential, or
dependency. This resolves section 23's open question for the MVP: no
external store/provider, revisit only if real traffic shows Postgres
contention.

### A hashed IP, a short-lived counter, nothing else

`PLAN.md`'s own phrase, "without storing unnecessary personal data,"
rules out logging or retaining a client's raw IP address indefinitely.
The limiter stores a SHA-256 hash of the request's IP (from
`x-forwarded-for`, the header Vercel's edge network sets — no new
dependency; `@vercel/functions`'s `ipAddress()` helper is a convenience
wrapper around the same header, not a different data source), keyed to a
one-hour window, holding only a count. Windows older than the retention
period are deleted on every write, so no historical log of report
attempts accumulates. The hash is unsalted — a determined attacker with a
specific candidate IP could still confirm a match by brute force, since
IPv4 space is small enough to hash-and-compare. A per-deployment secret
pepper would close that gap; this task does not add one, since it would
need a new required environment variable and a real threat-model
justification neither `PRODUCT.md` nor `ARCHITECTURE.md` currently
provides (see "Not decided here").

### A fixed window, not a sliding one or a token bucket

Five report writes per hashed IP per rolling-hour-boundary window (a
first, defensible pass, the same category of decision as
`VERIFICATION_FRESHNESS_DAYS` in `docs/adr/0014-computed-confidence-level.md`).
A fixed window is simpler to reason about and implement correctly than a
sliding window or token bucket, and "measured... controls" does not ask
for precision at the edges — only that spam is bounded, which a fixed
window does.

### Per-endpoint, not per-toilet

The limit counts every report write from one client across every toilet,
not per toilet id: `ARCHITECTURE.md`'s own phrase is "report endpoint
spam," and a spammer flooding many different toilet ids is exactly the
threat, not a special case of it.

## User-visible outcome

A client that exceeds five report submissions within an hour receives a
`429` with a literal explanation instead of a silent failure or a
misleading generic error; the detail sheet's existing failure/retry copy
covers this the same way it covers any other submission failure — no new
UI, since `PLAN.md`'s outcome is about the endpoint's controls, not a new
screen.

## Acceptance criteria

- A sixth report from the same client within the same hour is rejected
  with `429`, verified against a real database, not a fixture.
- No raw IP address is ever written to the database; only a SHA-256 hash
  and a count.
- Rate-limit rows older than the retention window are deleted as part of
  normal request handling, not accumulated indefinitely.
- The existing validation/existence/insert flow (`TASK-020`) is
  unaffected for a client under the limit.

## In scope

- A migration adding a small rate-limit counter table.
- `lib/reports/rate-limit.ts` (the pure window/limit logic, given an
  explicit `now`) and `db/queries/report-rate-limit.ts` (the
  increment-and-check database call).
- Wiring into `app/api/toilets/[id]/reports/route.ts`, before the existing
  existence check.
- `docs/adr/0016-report-rate-limiting.md`.
- `docs/CODEMAP.md` and `PROGRESS.md` updates.

## Out of scope

Do **not**:

- introduce Redis or any external rate-limiting provider;
- store a raw IP address anywhere;
- change the report schema (`TASK-020`'s `toilet_reports` table) or the
  request/response contract for a client under the limit;
- add CAPTCHA, proof-of-work, or any other abuse control beyond rate
  limiting — `PLAN.md`'s outcome names rate/abuse controls in the
  aggregate but this task's concrete scope is the rate limiter alone,
  the one control `ARCHITECTURE.md` section 16 names explicitly.

## Canonical context to read

- `AGENTS.md`
- `PROGRESS.md`
- `ARCHITECTURE.md` sections 16, 20, 21, 23
- `docs/adr/0015-toilet-reports.md`

## Likely relevant code

- `app/api/toilets/[id]/reports/route.ts`
- `db/queries/reports.ts` (the pattern to mirror)

## Constraints

- No new dependency; no new required environment variable.

## Verification

Run and record:

- `pnpm lint`, `pnpm format:check`, `pnpm typecheck`
- `pnpm test:unit`
- `pnpm db:migrate`, `pnpm test:integration` (a real sequence of writes
  crossing the limit, observed against a real database)
- `pnpm build`
- a real curl smoke test against a running production build proving the
  429

## Definition of done

TASK-021 is complete only when:

- a real sequence of report submissions past the limit is provably
  rejected with `429`, verified against a real database and a real
  running server;
- no raw IP is ever persisted;
- old rate-limit rows do not accumulate indefinitely;
- `docs/CODEMAP.md` and `PROGRESS.md` reflect the repository;
- the complete diff contains no unrelated changes.

Then stop. Do not begin TASK-022.

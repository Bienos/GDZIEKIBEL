# TASK-024 — Error tracking / privacy scrubbing

## Goal

`PLAN.md`'s outcome: "runtime errors are observable and location/
request-body leakage is prevented." `ARCHITECTURE.md`'s "Error tracking"
entry names "Sentry or equivalent" and requires it to "scrub request
bodies/headers where they could contain location or user-entered notes."
Section 8 (Location privacy) is more specific still: "Sentry/request
tracing must be configured to avoid body capture for location endpoints."
Section 17 (Observability) names what to track (request error rate,
nearby query latency, DB errors, ingestion failures, report submission
failures, map/provider load failures where measurable) and what never to
log (precise user coordinates, full request bodies for the location
endpoint, secrets, excessive raw source datasets). `PRODUCT.md` section 20
folds this into MVP readiness: "logging/error tracking is configured
without leaking sensitive values."

Today, none of this exists: no route handler catches an unexpected
exception, so a genuine runtime failure (a DB error, a connection drop) is
invisible — nothing logs it anywhere, and Next.js's own default handling
is all a client or an operator ever sees.

## Design decision: first-party structured logging, not a named provider

No Sentry (or equivalent) account or DSN exists or can be created from
this session — the same shape of open question `TASK-021` (rate limiting)
and `TASK-023` (analytics) already answered the same way, and
`ARCHITECTURE.md` section 21 rules out adopting new infrastructure
without evidence. This task builds the minimal thing instead: a pure,
testable error logger that emits structured JSON to `console.error`,
which Vercel's own log pipeline already captures — real observability
with no new service, no new environment variable, and no account this
session cannot create. `docs/adr/0019-runtime-error-logging.md` records
this in full.

## Prevent leakage by construction, not by inspecting a request afterward

The safest way to guarantee a route's request body or coordinates never
reach a log is to never hand them to the logger in the first place — the
same principle this project already applies to the report rate limiter
(a hash, never the raw IP) and to analytics (an enum member, never a
free-text field). Every call site passes only a fixed route identifier and
the caught `error` object, never `request` or any parsed body. As a second
layer — since an *unexpected* error (a database driver error, for
instance) is the one place text this project did not itself write could
appear — the logger scrubs the final message/stack text through a small,
bounded pattern matcher before it is ever written anywhere, the same
"bounded grammar over cleverness" style as `parse-charge.ts` and
`parse-opening-hours.ts`.

## User-visible outcome

None on the success path. On a genuine unexpected failure, a client now
sees one generic `{ error: 'Unexpected server error.' }` with `500`
instead of whatever Next.js's own default failure handling would have
returned.

## Acceptance criteria

- Each of the three route handlers (`/api/toilets/nearby`,
  `/api/toilets/[id]/reports`, `/api/analytics/events`) catches an
  unexpected throw, logs it once via the new logger, and returns a
  generic `500` — never the framework default.
- The logger never receives a request object, a parsed body, or a
  coordinate directly from any call site.
- A coordinate-shaped or `lat`/`lng`-keyed substring inside an error's own
  message/stack is redacted before the log line is emitted, proven by a
  unit test.
- No existing test's expected response for a validation failure (400),
  a not-found (404), or a rate-limit rejection (429) changes — those are
  existing, handled returns, not throws, and must keep passing through
  unaffected.

## In scope

- `lib/observability/scrub-sensitive-text.ts` — pure, bounded redaction.
- `lib/observability/log-runtime-error.ts` — the one structured
  `console.error` sink and its route-name type.
- A `try`/`catch` added around each of the three route handlers' bodies.
- `docs/adr/0019-runtime-error-logging.md`.
- `docs/CODEMAP.md` and `PROGRESS.md` updates.

## Out of scope

Do **not**:

- adopt a named third-party error-tracking provider (no account/DSN
  exists to configure one honestly);
- change any existing handled failure path (400/404/429) or its response
  body/status;
- add request tracing, breadcrumbs, source maps, or any feature a real
  Sentry-equivalent would eventually need — this task is the minimum that
  makes a genuine runtime failure observable and safe to log, nothing more;
- touch client-side error handling (`fetchNearbyToilets`, `submitReport`,
  `reportEvent` already never throw; that is existing, correct behaviour
  outside this task's scope).

## Canonical context to read

- `AGENTS.md`
- `PROGRESS.md`
- `PRODUCT.md` section 20
- `ARCHITECTURE.md` sections 2 (Error tracking), 8, 17, 20, 21, 23

## Likely relevant code

- `app/api/toilets/nearby/route.ts`
- `app/api/toilets/[id]/reports/route.ts`
- `app/api/analytics/events/route.ts`
- `db/queries/analytics.ts` (its own doc comment already names this task
  as where its swallowed write failure stops being silent)
- `db/client.ts` (the pool's own `'error'` event — an idle client can fail
  with no request in flight at all; found by this task's own smoke test)
- `lib/toilets/parse-charge.ts` (the bounded-grammar style to mirror)

## Constraints

- No new dependency; no new required environment variable.
- No change to any route's success-path response shape.

## Verification

Run and record:

- `pnpm lint`, `pnpm format:check`, `pnpm typecheck`
- `pnpm test:unit`
- `pnpm test:integration`
- `pnpm build`
- `pnpm test:e2e`
- A real smoke test against a running production build that forces a
  genuine unexpected failure in at least one route and confirms: a
  generic `500` is returned, a structured log line is emitted, and that
  line contains no coordinate or raw request body.

## Definition of done

TASK-024 is complete only when:

- all three routes catch an unexpected throw and log it through the one
  shared logger, verified with a real forced failure, not just a unit
  test of the logger in isolation;
- every existing test (unit, integration, e2e) still passes unmodified;
- `docs/CODEMAP.md` and `PROGRESS.md` reflect the repository, including
  any real gap named honestly (no external provider, no request tracing);
- the complete diff contains no unrelated changes.

Then stop. Do not begin TASK-025.

# ADR 0019 — First-party runtime error logging

Status: Accepted
Date: 2026-09-14
Scope: TASK-024 — Error tracking / privacy scrubbing

## Context

`PLAN.md`'s outcome: "runtime errors are observable and location/
request-body leakage is prevented." `ARCHITECTURE.md`'s "Error tracking"
entry names "Sentry or equivalent," requiring it to "scrub request
bodies/headers where they could contain location or user-entered notes";
section 8 sharpens this to "Sentry/request tracing must be configured to
avoid body capture for location endpoints." No Sentry (or equivalent)
account or DSN exists or can be created from this session. Today, no
route handler catches an unexpected exception at all: a genuine runtime
failure is invisible to this project, not merely unscrubbed.

## Decisions

### A first-party structured logger, not a named provider

The same resolution `docs/adr/0016-report-rate-limiting.md` and
`docs/adr/0018-first-party-analytics.md` already reached for their own
open provider questions: build the minimal thing on infrastructure this
project already has, rather than wait on a decision only the project
owner can make. Here that infrastructure is simpler still — no database
table, just a pure function that emits one structured JSON line to
`console.error`. Vercel's own log pipeline already captures `stdout`/
`stderr` from serverless functions, which is real, queryable
observability for an MVP with no new service, account, or environment
variable. `ARCHITECTURE.md` section 21 rules out adopting new
infrastructure without evidence; there is none here either. Section 20's
"error tracking DSN (if enabled)" stays exactly that — optional, unset
today — and a real Sentry (or equivalent) integration could later replace
`logRuntimeError`'s own body without any call site changing, the same
swap-later shape `docs/adr/0018-first-party-analytics.md` designed for.

### Leakage prevented by construction, then scrubbed as a second layer

The load-bearing guarantee is not a scrubber inspecting a request after
the fact — it is that no call site ever hands the logger a request
object, a parsed body, or a coordinate. Every one of the three route
handlers calls `logRuntimeError(route, error)` with only a fixed route
name and whatever was actually thrown; `request`/`body`/`filters`/`note`
are never in scope at the call site. This mirrors how the rate limiter
never sees a raw IP (only its hash) and analytics never sees a free-text
field (only an enum member) — the property holds even if a future call
site is written carelessly, because the function's own signature makes
the leak impossible to pass in, not merely discouraged.

The second, defense-in-depth layer exists because an *unexpected* error —
by definition, one this project did not itself construct the message
for — is the one place text this codebase did not write could still
surface: a database driver's own error message, for instance.
`scrubSensitiveText` redacts a decimal coordinate pair (comma-separated,
however spaced) and any `lat`/`lng`/`lon`/`latitude`/`longitude`-keyed
number, before the message or stack is ever serialised. It is bounded and
conservative like `lib/toilets/parse-charge.ts` and
`lib/opening-hours/parse-opening-hours.ts`: it redacts a recognisable
coordinate shape, never any bare decimal (a price, an ETA, a distance),
so it cannot turn an ordinary error message unreadable to chase a risk
that was already closed off by construction.

### A fourth, non-route call site: the analytics write path itself

`db/queries/analytics.ts`'s own doc comment already named this task as the
place its swallowed write failure would stop being silent:
`insertAnalyticsEvent` still never throws (a write failure there must
never turn a successful nearby search or report submission into a failed
response), but its `catch` now calls `logRuntimeError` too, so a real,
previously-invisible failure mode — analytics silently not writing — is
now observable without changing that function's contract. Because this
call site is not an HTTP route, the exported type is named `LogContext`,
not `RouteName`; only three of its members are literal route identifiers,
this one is `db/queries/analytics.ts:insertAnalyticsEvent`.

### A fifth call site, found by this task's own smoke test: the pool itself

Forcing a real failure (stopping Postgres under a running production
build) surfaced a failure mode no per-route `try`/`catch` can reach: an
idle client already sitting in the pool can fail with no request in
flight at all, and `node-postgres`'s own documentation is explicit that
an unhandled listener for this turns into an uncaught exception — which
is exactly what happened, as a large, unstructured `Client` object dumped
straight to `stderr`, twice, before any route-level log line appeared.
`db/client.ts`'s `getPool()` now attaches `pool.on('error', ...)` once, at
creation, routed through the same `logRuntimeError`. This is not
speculative hardening added for its own sake — it is a real gap this
task's own verification step found, and leaving it unfixed would mean
"runtime errors are observable" was still false for the one failure mode
most likely to happen during an actual database outage.

### Every route now catches its own unexpected throw

`app/api/toilets/nearby/route.ts`, `app/api/toilets/[id]/reports/route.ts`,
and `app/api/analytics/events/route.ts` each wrap their existing body in
one `try`/`catch`. Every already-handled failure (a 400 for bad JSON or a
failed validation, a 404 for a missing toilet, a 429 for a rate-limited
client) is an existing `return`, not a `throw`, so none of it is touched
by this change — only a genuine, previously-invisible exception now
produces a logged line and a generic `{ error: 'Unexpected server
error.' }` `500`, instead of whatever Next.js's own default handling
would have returned.

## Consequences

- `lib/observability/log-runtime-error.ts` is the one place a runtime
  error becomes observable. A later real provider swap touches this one
  file's body, not any of the three route handlers.
- A client-visible `500` after an unexpected failure is now always the
  same generic body, never a stack trace or the original driver error —
  an incidental hardening this task did not have to design for separately.
- `scrubSensitiveText` is a second layer, not the primary guarantee; it is
  still tested directly since it is the one part of this design that
  processes text this project did not itself construct.

## Not decided here

Whether a real Sentry (or equivalent) account is ever adopted, request
tracing/breadcrumbs, source-map upload, or alerting on the logged output
are all separate, later decisions this task does not make. Client-side
error handling is unchanged: `fetchNearbyToilets`, `submitReport`, and
`reportEvent` already never throw, which remains correct and is outside
this task's scope.

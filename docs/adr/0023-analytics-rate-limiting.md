# ADR 0023 — Analytics rate limiting

Status: Accepted
Date: 2026-09-14
Scope: TASK-029 — Security/privacy review

## Context

`docs/adr/0018-first-party-analytics.md` shipped `POST
/api/analytics/events` deliberately unrate-limited, naming it "a real,
recorded gap" and leaving the actual design ("a shared table with a
scope column, or a second one, and a different limit suited to
analytics' much higher expected volume") for a later task. `PLAN.md`'s
outcome text for this task names "write abuse" as one of the things a
release candidate must be reviewed for; `ARCHITECTURE.md` section 16
lists rate limiting among the controls expected against MVP threats
generally, not only for the report endpoint. TASK-029's own audit
confirmed the gap is still open: the endpoint's only bound is that
`eventName` must match one of nine enum values, so a client can still
flood the table with unlimited valid-shaped inserts.

## Decisions

### A second table, not a shared one with a scope column

`docs/adr/0018-first-party-analytics.md` named both options. A shared
table would need a scope column, a composite consideration in every
query, and a single limit constant doing double duty for two endpoints
with very different legitimate traffic shapes. A second table
(`analytics_rate_limit_windows`, alongside the existing
`report_rate_limit_windows`) keeps each endpoint's counters, and its own
limit, independent — the same reasoning `docs/adr/0016-report-rate-limiting.md`
already applied to keep this per-endpoint rather than per-toilet.

### A much higher limit: 120 requests per hour

Five per hour (the report endpoint's limit) would break legitimate
analytics traffic immediately: a single session can fire `app_opened`,
one location outcome, several `toilet_selected` events while browsing
results, and a `navigation_clicked` — comfortably more than five without
any abuse. 120 per hour per hashed IP is a first, defensible pass in the
same spirit as the report endpoint's five: generous enough for a shared
IP (NAT, a school, a corporate network) running several real sessions,
bounded enough that an unlimited flood is no longer free. Not calibrated
against real traffic, since none exists yet — the same caveat
`docs/adr/0016-report-rate-limiting.md` already carries for its own
number.

### Same window/key mechanism, checked first — a deliberate sibling module, not a shared import

The fixed one-hour window, the SHA-256-hashed IP client key, and the
24-hour retention/pruning-on-every-write behaviour are all reused
unchanged from `docs/adr/0016-report-rate-limiting.md` — no new
trade-off to make there. The check happens first, before the request
body is parsed, matching `/api/toilets/[id]/reports`'s existing order:
a client already over the limit should not spend the endpoint's other
validation work either.

`lib/analytics/rate-limit.ts` duplicates `lib/reports/rate-limit.ts`'s
small pure functions rather than importing them from a shared module.
`AGENTS.md`'s scope discipline rules out refactoring the already-shipped,
tested report limiter as part of this review task; the duplicated
surface is a handful of small, stable pure functions, not a design that
is likely to need to change in two places at once. If a third rate
limiter is ever needed, extracting a shared window/hash module becomes
worth its own scope decision — not before.

### The rate-limit check can now fail the request; the analytics write itself still cannot

`docs/adr/0018-first-party-analytics.md` established that a failure in
`insertAnalyticsEvent` must never turn a successful request into a
failed one — that contract is unchanged. Adding a database-backed rate
limiter necessarily adds a new path that *can* fail the request: an
unexpected error from `checkAndIncrementAnalyticsRateLimit` itself
(not a limit being exceeded, an actual query failure) is caught by the
route's existing top-level `try`/`catch` and answered with the generic
`500`, exactly as `/api/toilets/[id]/reports` already accepts for its
own rate limiter. This is a narrow, pre-existing precedent being
extended to a second endpoint, not a new risk invented here.

## Consequences

- A client over the limit receives `429` with a `Retry-After` header
  naming the seconds until the current window ends, matching the report
  endpoint's response shape.
- `db/queries/analytics-rate-limit.ts` and `lib/analytics/rate-limit.ts`
  are near-duplicates of the report endpoint's equivalents; a future
  change to the shared mechanism (the window length, the hash algorithm)
  needs to be made in both places until/unless a shared module is
  extracted.

## Not decided here

Whether the hash should be salted (the same open question
`docs/adr/0016-report-rate-limiting.md` already left unresolved for the
report limiter) is left for the same future threat-model review, for
both limiters together. Whether 120 per hour is the right number is a
first pass left for real traffic data, exactly as the report endpoint's
five per hour was.

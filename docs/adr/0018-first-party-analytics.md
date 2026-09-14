# ADR 0018 — First-party analytics

Status: Accepted
Date: 2026-09-14
Scope: TASK-023 — Analytics instrumentation

## Context

`PLAN.md`'s outcome: "core funnel events are captured without precise
location." `PRODUCT.md` section 13's FR-09 names eight funnel points;
section 14 sets the privacy bar. `PROGRESS.md`'s "Known unresolved
decisions" and `ARCHITECTURE.md` section 23 both list the analytics
provider as unresolved — no account or key exists to configure a real
one honestly.

## Decisions

### A first-party Postgres table, not a named provider

The same resolution `docs/adr/0016-report-rate-limiting.md` already
reached for the rate limiter's open "external store or not" question:
build the minimal thing on infrastructure this project already has, not
wait on a provider decision only the project owner can make.
`ARCHITECTURE.md` section 21 rules out adopting new infrastructure
without evidence; there is none here either. `event_name` and a
server-assigned `occurred_at` are the entire schema — nothing that would
need to migrate awkwardly if a real provider is adopted later, since the
event-producing call sites (the two existing routes, the five client
trigger points) would only need their write target swapped, not their
triggers rewritten.

### Nine events; four logged server-side with no new round trip

FR-09's "location granted/denied" bullet becomes two events,
`location_granted` and `location_denied`, matching the two distinct
outcomes `locationFlow` already tracks in code — not a single ambiguous
event that would need a property to tell them apart later.

Four events are already visible to a route handler that exists today, so
they are logged directly there rather than through a client round trip
that would just tell the server something it already knows:

- `POST /api/toilets/nearby` already computes the ranked result count and
  already receives `filters` — `results_loaded`/`no_results` and
  `filter_applied` are logged from the same response-building code.
- `POST /api/toilets/:id/reports` already knows the instant `insertReport`
  succeeds — `report_submitted` is logged there.

The remaining five (`app_opened`, `location_granted`, `location_denied`,
`toilet_selected`, `navigation_clicked`) only ever happen in the browser;
`POST /api/analytics/events` exists for exactly those, accepting only a
known `eventName`.

### No location, no properties, no session identifier — first pass

`PRODUCT.md`'s rule is "without precise location." This task does not
even store coarse location, a device identifier, a session id, or a user
agent: nothing in `PLAN.md` or `PRODUCT.md` asks for any of those, and
each one is a fact a later privacy review would have to separately
justify. A bare `event_name` cannot leak anything about who performed it
or where.

### Analytics logging never fails the request it is attached to

Both existing routes wrap their new analytics call in a way that cannot
turn a successful nearby search or report submission into a failed
response — an analytics write is observability, not a product
requirement, and a bug in it must never look like the product itself
broke.

### The new endpoint is not rate-limited — a named gap, not a silent one

`TASK-020` shipped its report endpoint without rate-limiting first,
naming it explicitly and letting `TASK-021` solve it as its own task.
`PLAN.md`'s outcome text for this task does not mention abuse controls,
unlike the explicit "validated... rate-limited" split `PRODUCT.md` FR-08
draws for reports. Extending `docs/adr/0016-report-rate-limiting.md`'s
mechanism to a second endpoint would need its own scope decision (a
shared table with a scope column, or a second one, and a different limit
suited to analytics' much higher expected volume) that this task's literal
ask does not call for. Left as a real, recorded gap.

## Consequences

- `db/queries/analytics.ts` is the one place that writes
  `analytics_events`; every future event source calls the same function,
  so a later provider swap touches one file, not every call site.
- A public, unauthenticated, unrate-limited write endpoint exists. Its
  blast radius is bounded by what it can do: insert a row containing only
  one of nine known enum values, nothing else — the worst case is table
  growth, not data exposure or a route with real side effects.

## Not decided here

Whether any event ever needs a property (a locale, a filter dimension, a
coarse district) is left for whoever actually needs to answer a question
this event log alone cannot. Whether `POST /api/analytics/events` needs
rate limiting, and what a real third-party provider integration would
look like, are both separate, later decisions.

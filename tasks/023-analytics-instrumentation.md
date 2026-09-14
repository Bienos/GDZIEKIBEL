# TASK-023 — Analytics instrumentation

## Goal

`PLAN.md`'s outcome: "core funnel events are captured without precise
location." `PRODUCT.md` section 13's FR-09 names the funnel: app opened,
location granted/denied, nearby results loaded, toilet selected,
navigation clicked, filter applied, report submitted, no-results state.
Section 14's privacy requirements are the real constraint: no precise
coordinates in analytics events, avoid third-party trackers not needed
for the product, document any external service that receives
IP/location-derived information.

## Design decision: a first-party Postgres event log, not a named provider

`PROGRESS.md`'s "Known unresolved decisions" lists "Final analytics
provider" as unresolved, and `ARCHITECTURE.md` section 23 lists "exact
analytics provider" the same way. No account or API key for any
third-party analytics provider (PostHog, Plausible, GA4, or otherwise)
exists or can be created from this session, and section 21 rules out
adopting new infrastructure without evidence. This is the same shape of
open question `TASK-021` already resolved for rate limiting: build the
minimal thing using infrastructure this project already has (Postgres),
document the real gap (no provider decision made), and let a later task
swap or add a real provider without this task's event-producing code
needing to change.

`docs/adr/0018-first-party-analytics.md` records the design in full.

## Nine events, four already server-observable

FR-09's eight bullets become nine concrete events: "location
granted/denied" is one bullet naming two distinct, already-distinct-in-code
outcomes (`locationFlow`'s own `'granted'`/`'denied'` states), so it
becomes `location_granted` and `location_denied` separately.

Four of the nine never need a new client round-trip at all — the server
already sees the moment they happen:

- `results_loaded` / `no_results` — `POST /api/toilets/nearby` already
  computes the ranked result count before responding.
- `filter_applied` — the same route already receives `filters` in the
  request body.
- `report_submitted` — `POST /api/toilets/:id/reports` already knows the
  instant a report is actually inserted.

These are logged directly in the existing route handlers. The remaining
five (`app_opened`, `location_granted`, `location_denied`,
`toilet_selected`, `navigation_clicked`) only ever happen in the browser,
so a new endpoint, `POST /api/analytics/events`, is added for the client
to report them — accepting only a known `eventName`, nothing else.

## No location, no properties, no rate limiting — first pass, named as such

- The stored row is `event_name` and a server-assigned `occurred_at`.
  Nothing else. No coordinates, coarse or precise; no session/device
  identifier; no user agent. `PRODUCT.md`'s rule is "without precise
  location," but this task does not even add coarse location, since
  nothing in `PLAN.md` or `PRODUCT.md` asks for it and every additional
  dimension is one more thing to get privacy-review-wrong later.
- `POST /api/analytics/events` is intentionally not rate-limited in this
  task, the same category of decision `TASK-020` made about its own
  endpoint before `TASK-021` existed. `PLAN.md`'s outcome text for this
  task does not mention abuse controls (unlike the explicit
  validated/rate-limited split for reports), so this is named as a real,
  known gap rather than solved unasked.

## User-visible outcome

None. This is instrumentation, not a feature — no new UI.

## Acceptance criteria

- All nine events have a real trigger point in existing code, verified by
  exercising each one (four server-side, five via the new endpoint) and
  observing a real row land in `analytics_events`.
- No row in `analytics_events` ever contains a coordinate, coarse or
  precise.
- `POST /api/analytics/events` rejects an unknown `eventName`.

## In scope

- A migration adding `analytics_events` and `analytics_event_name`.
- `lib/analytics/types.ts` (`EVENT_NAMES`).
- `db/queries/analytics.ts` (`insertAnalyticsEvent`).
- `lib/analytics/report-event.ts` (client-side, fire-and-forget, mirrors
  `lib/reports/submit-report.ts`).
- `app/api/analytics/events/route.ts`.
- Server-side logging added to the two existing route handlers.
- Client-side calls added at the five client-only trigger points in
  `MapShell.tsx` / `ToiletDetailSheet.tsx`.
- `docs/adr/0018-first-party-analytics.md`.
- `docs/CODEMAP.md` and `PROGRESS.md` updates.

## Out of scope

Do **not**:

- adopt a named third-party analytics provider (no account/key exists to
  configure one honestly);
- store any coordinate, session id, device identifier, or user agent;
- add rate-limiting to the new endpoint (a real, named gap, not silently
  skipped);
- change any existing route's response shape or behaviour for its actual
  feature — analytics logging must never be able to fail the request it
  is attached to.

## Canonical context to read

- `AGENTS.md`
- `PROGRESS.md`
- `PRODUCT.md` sections 13 (FR-09) and 14
- `ARCHITECTURE.md` sections 20, 21, 23

## Likely relevant code

- `app/api/toilets/nearby/route.ts`
- `app/api/toilets/[id]/reports/route.ts`
- `components/map/MapShell.tsx`, `ToiletDetailSheet.tsx`
- `lib/reports/submit-report.ts` (the client-side pattern to mirror)

## Constraints

- No new dependency; no new required environment variable.

## Verification

Run and record:

- `pnpm lint`, `pnpm format:check`, `pnpm typecheck`
- `pnpm test:unit`
- `pnpm db:migrate`, `pnpm test:integration`
- `pnpm build`
- `pnpm test:e2e` covering at least one client-triggered event actually
  reaching the endpoint

## Definition of done

TASK-023 is complete only when:

- all nine events are provably reachable and land a real row with no
  location data, verified against a real database;
- the two existing routes' own behaviour and response shape are
  unchanged for every existing test;
- `docs/CODEMAP.md` and `PROGRESS.md` reflect the repository, including
  the real gaps (no provider, no rate limiting) named honestly;
- the complete diff contains no unrelated changes.

Then stop. Do not begin TASK-024.

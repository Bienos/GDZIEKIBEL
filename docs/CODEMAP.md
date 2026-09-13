# Code map

Status: foundation created by TASK-001. Describes what actually exists in the
repository. Update only when stable module boundaries change.

## Canonical planning/control files

Repository root:

- `PRODUCT.md`
- `BRAND.md`
- `DESIGN.md`
- `ARCHITECTURE.md`
- `PLAN.md`
- `PROGRESS.md`
- `AGENTS.md`
- `CLAUDE.md`
- `README.md` — developer setup, commands and deployment path

Task specifications live in `tasks/`.

## Application code

```text
app/
  [locale]/
    layout.tsx        root layout, <html lang> per locale, metadata, hreflang
    page.tsx          top bar (wordmark, language switch) + the map shell
    page.module.css   styles for the top bar and page layout
  api/toilets/nearby/route.ts
                      POST only; bounded nearby active toilets, filtered
                      (TASK-016, ADR 0011) and reordered by
                      rankNearbyToilets (TASK-009)
  api/toilets/[id]/reports/route.ts
                      POST only; a validated, anonymous, rate-limited
                      report (TASK-020 ADR 0015, TASK-021 ADR 0016): the
                      rate limit is checked first (429 with Retry-After
                      over 5/hour per hashed IP), then 400 for a malformed
                      id or invalid body, 404 for a well-formed but unknown
                      toilet id, 201 with the created report's id on success
  globals.css         reset, body defaults, imports tokens.css and maplibre-gl.css
  tokens.css          design tokens (colour, spacing, type) — single source
components/
  map/MapShell.tsx    the Warsaw map (TASK-005), the location permission
                      flow (TASK-006), and nearby toilet markers with
                      click-to-select (TASK-008); renders the tile fallback
                      when no provider key is configured or the map fails to
                      load before its first successful load, independent of
                      that, the location ask/denied screens on mount and the
                      nearby-toilets fetch centred on the default Warsaw view;
                      owns the map/list `viewMode` toggle (TASK-015), the
                      active filters feeding that same fetch (TASK-016), and
                      the search radius plus the no-results diagnosis
                      (TASK-017, ADR 0012): a `SearchParams`-comparison
                      derives `toiletsLoaded`/`noResultsDismissed` instead of
                      resetting them with a synchronous `setState` in the
                      fetch effect; a real grant outside `WARSAW_BBOX`
                      (TASK-018, ADR 0013) is checked before either the
                      marker or `grantedCoords` are touched, so it never
                      reaches the fetch/ranking/marker code, and gets its
                      own `outside` screen distinct from `denied`
  map/NearestToiletPreview.tsx
                      collapsed "nearest sensible toilet" preview (TASK-010):
                      the top-ranked (TASK-009) result's name, distance/ETA,
                      opening-status and price badges; a button — tapping it
                      opens the detail sheet (TASK-011); hidden in list view
  map/ToiletListView.tsx
                      accessible list view (TASK-015, DESIGN.md 9.5): every
                      toilet, in the API's own ranked order, name/distance/
                      ETA/status/price plus up to two feature badges (only
                      when known); a row tap opens the same detail sheet a
                      marker or the preview would
  map/ToiletDetailSheet.tsx
                      toilet detail sheet (TASK-011): name, distance/ETA,
                      status/price, a real navigation CTA (TASK-012),
                      accessibility features, confidence hint, and a report
                      control (TASK-020, ADR 0015) that opens ReportSheet in
                      place of this sheet; no hours yet (see the task file
                      for why)
  map/ReportSheet.tsx  the report flow (TASK-020, DESIGN.md 9.4 position 8,
                      ADR 0015): the seven BRAND.md "Reporting" reasons as
                      radios, an optional note, WYŚLIJ ZGŁOSZENIE; success
                      replaces the form, failure keeps whatever was picked/
                      typed so retrying is not starting over; no
                      rate-limiting (TASK-021's job)
  map/FiltersSheet.tsx
                      the five MVP filters (TASK-016, DESIGN.md 9.6): four
                      sections, toggles bound to a draft state; POKAŻ WYNIKI
                      applies it, WYCZYŚĆ clears and reapplies; no live
                      result count (see the task file for why)
  map/NoResultsState.tsx
                      no-results overlay (TASK-017, ADR 0012): diagnoses an
                      active filter, an expandable radius, or an exhausted
                      radius, filters checked first, and offers only the one
                      action that can actually help; same component for both
                      the map view's bottom-anchored placement and the list
                      view's full-area placement
  map/MapShell.module.css
lib/
  env/server.ts       the only validated reader of server environment variables
  i18n/               supported locales and the copy dictionaries
  toilets/types.ts    enumerated values of the toilet model, mirroring the SQL types;
                      also PaymentMethods (TASK-014), the cash/cards/coins shape
  toilets/normalized-source-record.ts
                      Zod schema an ingestion adapter must emit (contract section 6)
  geo/warsaw.ts       coarse Warsaw bounding box, a first filter only;
                      `isWithinWarsawBbox` is also the outside-Warsaw check
                      the location flow uses (TASK-018)
  map/tile-provider.ts  builds the MapTiler style URL from a key; the one
                      place that knows the provider's URL shape
  map/warsaw-view.ts  initial camera position and pan limits for the map shell
  geolocation/request-location.ts
                      wraps navigator.geolocation in one promise, classified
                      into granted/denied/unavailable/timeout/error
  toilets/walking-time.ts
                      distance -> approximate minutes, one named conservative
                      constant (ADR 0006)
  toilets/nearby-request.ts
                      validates a nearby-API request body; accepts an
                      optional `filters` object since TASK-016 (ADR 0006,
                      ADR 0011); exports DEFAULT_RADIUS_METERS and
                      MAX_RADIUS_METERS, the latter also the no-results
                      overlay's search-farther target (TASK-017)
  toilets/filter-nearby.ts
                      the five MVP filters' matching predicate and the
                      server-side filter step (TASK-016, ADR 0011): a
                      filter only keeps a positively-confirmed fact, never
                      'unknown' or 'limited'; pure, no database
  toilets/nearby-response.ts
                      shapes one DB row into the nearby-API response item;
                      enum values pass through unchanged, never booleans;
                      openingStatus is now computed by
                      computeOpeningStatus, given an explicit `now` (TASK-013);
                      paymentMethods is never null in the response — a null
                      row value becomes all-unknown (TASK-014); open24h is
                      also exposed, the raw fact TASK-016's filter reads;
                      confidenceLevel is now computed by
                      computeConfidenceLevel from verifiedAt/accessRaw, the
                      same `now` (TASK-019, ADR 0014), not a stored column
  toilets/compute-confidence.ts
                      computes confidence_level (never 'high') from
                      verified_at freshness and a non-uncertain access basis
                      (TASK-019, ADR 0014); pure, no database
  toilets/fetch-nearby.ts
                      client-side call to the nearby API; never throws;
                      omits the `filters` key entirely when none is active
                      (TASK-016), and the `radiusMeters` key at the default
                      radius (TASK-017)
  toilets/marker-diff.ts
                      pure add/remove reconciliation between a marker id set
                      and a new toilet list
  toilets/marker-element.ts
                      builds one toilet marker's DOM element and its
                      selected-state toggle
  toilets/marker-label.ts
                      accessible name for a marker: name + rounded distance
  toilets/rank-nearby.ts
                      reorders nearby results by distance + access-type
                      confidence, a named metre-penalty table (TASK-009,
                      ADR 0007); pure, no database
  toilets/preview-copy.ts
                      maps priceState/openingStatus to dictionary copy and a
                      status-colour variant, and formats the distance/ETA
                      line, for the nearest-toilet preview (TASK-010, status
                      variants added TASK-013); priceAmountLabel (TASK-014)
                      shows a parsed charge amount when one exists; pure, no
                      React/DOM; reused by the detail sheet
  toilets/parse-charge.ts
                      parses a bounded `<amount> <currency>` grammar
                      (TASK-014, ADR 0010) into { amountMinor, currency };
                      pure, source-agnostic, reused by any adapter
  opening-hours/types.ts, warsaw-time.ts, parse-opening-hours.ts, compute-status.ts
                      TASK-013: a bounded OSM opening_hours grammar parser,
                      an Intl-based Warsaw weekday/time helper, and status
                      computation qualified by confidence_level (ADR 0009);
                      all pure, no I/O
  toilets/detail-copy.ts
                      maps FeatureState/ConfidenceLevel to dictionary copy
                      for the toilet detail sheet (TASK-011); pure, no
                      React/DOM
  external-navigation/build-navigation-url.ts
                      builds a destination-only Google Maps walking URL
                      (TASK-012, ADR 0008); Apple Maps deferred until a
                      session can test real app-opening behaviour
  reports/types.ts    the seven MVP issue types (TASK-020, ADR 0015),
                      mirroring the SQL toilet_report_issue_type enum
  reports/report-request.ts
                      validates a report request body and the toilet :id
                      path segment (TASK-020); a malformed id is a 400, a
                      well-formed but absent one is the route's own 404
  reports/submit-report.ts
                      client-side call to POST /api/toilets/:id/reports;
                      never throws; a blank note is omitted, never sent as ''
  reports/rate-limit.ts
                      the report endpoint's rate limiter (TASK-021, ADR
                      0016): one-hour fixed window, 5 requests, a SHA-256
                      hash of the client's IP (never the raw address); pure
                      window/key logic plus x-forwarded-for extraction
  ingest/upsert.ts    source-agnostic write path; never deletes, marks
                      not_seen_since; writes open_24h/opening_hours_normalized
                      since TASK-013, price_amount_minor/currency and the
                      normalised payment_methods since TASK-014, and
                      access_raw since TASK-019 (ADR 0014)
  ingest/osm/         the OpenStreetMap adapter: fetch, validate, normalize
                      (normalize.ts derives opening-hours fields since
                      TASK-013, and charge/payment-method fields since TASK-014;
                      accessRaw was already produced since TASK-002/003, only
                      stored on the canonical row since TASK-019)
db/
  queries/nearby.ts   the nearby-toilets PostGIS query (TASK-007); active-only,
                      distance order, server-capped result count; selects
                      open_24h/opening_hours_normalized since TASK-013,
                      price_amount_minor/currency/payment_methods since
                      TASK-014, and verified_at/access_raw since TASK-019 (in
                      place of the unused confidence_level column)
  queries/reports.ts  toiletExists and insertReport (TASK-020, ADR 0015);
                      thin, source-agnostic, no location/IP/device data ever
                      written
  queries/report-rate-limit.ts
                      checkAndIncrementRateLimit (TASK-021, ADR 0016): one
                      atomic INSERT ... ON CONFLICT ... RETURNING, prunes
                      windows older than the retention cutoff first
db/
  client.ts           shared pg connection pool
  postgis.ts          PostGIS availability/version read
  migrations/         timestamped SQL migrations run by node-pg-migrate
    *_enable-postgis.sql   baseline: the extension only
    *_toilet-schema.sql    toilets, toilet_source_records, ingestion_runs, enums
    *_add-confidence-access-raw.sql
                      adds toilets.access_raw (TASK-019, ADR 0014)
    *_add-toilet-reports.sql
                      adds toilet_reports, toilet_report_issue_type,
                      toilet_report_status (TASK-020, ADR 0015)
    *_add-report-rate-limit.sql
                      adds report_rate_limit_windows (TASK-021, ADR 0016)
scripts/
  db/check-postgis.ts PostGIS health check (pnpm db:check)
  ingest/osm.ts       the ingestion command (pnpm ingest:osm); logs a
                      warning summary for raw opening-hours text that did
                      not parse (TASK-013), never a silent drop
  research/           one-off source probes; not application code, not in CI
tests/
  unit/               no external services
  integration/        real Postgres/PostGIS; skips when DATABASE_URL is unset
  fixtures/osm/       synthetic elements for the ingestion tests, not real data
e2e/
  home.spec.ts        Playwright smoke test
```

Ownership:

- `app/` = HTTP/UI composition. It holds no domain logic.
- `lib/` = framework-independent modules. Only `lib/env/server.ts` reads
  `process.env` for application configuration.
- `db/` = persistence and migrations.
- `scripts/` = operational scripts run outside request serving.

## Configuration

- `next.config.ts` — Next.js configuration, including the `/` to `/pl` redirect
- `tsconfig.json` — TypeScript strict, `@/*` path alias to the repository root
- `eslint.config.mjs` — flat config extending `eslint-config-next`
- `vitest.config.ts` — `unit` and `integration` projects
- `playwright.config.ts` — mobile viewport, builds and serves the app itself
- `.prettierrc.json`, `.prettierignore` — planning documents are excluded
- `.nvmrc`, `package.json` `engines` — Node runtime expectation
- `.env.example` — variable names only
- `vercel.json` — framework, lockfile-enforced install, security headers
- `.github/workflows/ci.yml` — `quality`, `database` and `e2e` jobs

## Decisions

- `docs/adr/0001-foundation-stack.md` — package manager, runtime, migration
  tooling, test runners, styling approach.
- `docs/adr/0002-locale-in-the-url.md` — why the locale is a route segment.
- `docs/adr/0003-first-data-source.md` — OpenStreetMap first, city dataset
  deferred, field-level source table, consequences for the schema.
- `docs/adr/0004-schema-conventions.md` — unknown is a value, trigger-maintained
  timestamps, never-delete provenance, and every departure from
  `ARCHITECTURE.md` section 5 with its reason.
- `docs/adr/0005-map-tile-provider.md` — MapTiler as the provisional,
  configurable tile provider, and why the map shell requires a fallback state.
- `docs/adr/0006-nearby-api-contract.md` — feature fields as enum strings not
  booleans, `openingStatus` always `UNKNOWN` until TASK-013, no `filters`
  field until TASK-016, the walking-time constant.
- `docs/adr/0007-recommendation-ranking-formula.md` — the nearby API's result
  order is distance plus a named per-`access_type` metre penalty; the other
  four PRODUCT.md section 11 ranking criteria are named as currently inert,
  not silently dropped.
- `docs/adr/0008-external-navigation-url.md` — a destination-only Google
  Maps web URL as the sole navigation provider; Apple Maps deferred until
  testable on a real device.
- `docs/adr/0009-opening-hours-status.md` — a bounded `opening_hours` grammar
  (24/7 and simple weekly rules, not public holidays or date ranges), and
  qualifying a real day/time match into `LIKELY_OPEN`/`LIKELY_CLOSED` unless
  `confidence_level` is `'high'`.
- `docs/adr/0010-price-and-payment-normalisation.md` — a bounded
  `<amount> <currency>` grammar for `charge` (PLN/EUR/USD only), and three
  payment-method flags (cash/cards/coins) normalised from OSM's `payment:*`
  tags, not the full namespace.
- `docs/adr/0011-filter-semantics.md` — a filter only keeps a toilet whose
  relevant fact is positively confirmed; `'unknown'` and `'limited'` never
  satisfy an active filter, applied server-side within the existing
  nearest-30-candidate cap.
- `docs/adr/0012-no-results-diagnosis.md` — three diagnosed causes for an
  empty result, filters checked first since they are the more directly
  fixable cause; radius expansion jumps straight to `MAX_RADIUS_METERS`
  rather than a stepped ladder; the exhausted state names this search's own
  limit, never the world's.
- `docs/adr/0013-outside-warsaw-behaviour.md` — `isWithinWarsawBbox` as the
  one definition of the supported area; a real out-of-area grant is
  checked before any coordinate is stored, so it never reaches the
  fetch/ranking/marker code; one action, not the denied screen's two, since
  being outside Warsaw will not change on a retry.
- `docs/adr/0014-computed-confidence-level.md` — `confidence_level` is
  computed at request time from `verified_at`/`access_raw`, never a stored
  column; `'high'` stays unreachable until real cross-source corroboration
  exists (`TASK-022`), resolving `PRODUCT.md` section 9's own HIGH/LOW
  wording tension conservatively.
- `docs/adr/0015-toilet-reports.md` — `issue_type` is a real enum, not
  `text`, mirroring `BRAND.md`'s seven reasons exactly; existence checked
  before insert rather than a raw FK violation; `status` exists with a
  default but nothing reads it yet; no rate-limiting or abuse metadata
  (`TASK-021`'s job); no location, IP, or device identifier ever stored.
- `docs/adr/0016-report-rate-limiting.md` — Postgres, not Redis or an
  external provider, resolving `ARCHITECTURE.md` section 23's open
  question; a SHA-256 hash of the client IP, never the raw address; a
  fixed one-hour window, five writes, pruned on every request.
- `docs/contracts/osm-toilets-source.md` — what OpenStreetMap provides and the
  shape the ingestion adapter consumes.
- `docs/research/` — dated research snapshots. Evidence, not a source of truth;
  see `docs/research/README.md`.

## Approved design reference

`docs/design/reference/gdziekibel-approved-direction.png`

## Not yet created

A Warsaw map shell renders, the location permission ask/grant/deny flow
works, and nearby toilets fetch and render as clickable, selectable markers
(one visual state only; see ADR 0006 and TASK-008's own notes on why). The
nearby API orders results by distance plus access-type confidence (TASK-009,
ADR 0007), verified against a real PostGIS database and a real running
production build (see PROGRESS.md), and the map shell shows that top-ranked
result as a collapsed preview card (TASK-010). Tapping the preview, or a
marker, opens a toilet detail sheet (TASK-011) with name, distance/ETA,
status/price, accessibility features, and a confidence hint, plus a real
`PROWADŹ MNIE` navigation CTA (TASK-012, ADR 0008) that opens a destination-
only Google Maps walking-directions link — this completes Milestone 1's
first core journey end to end, though this session cannot verify the link
actually reaches a working Google Maps route (no egress to `google.com`).
`openingStatus` is now a real, computed value (TASK-013, ADR 0009): a
bounded `opening_hours` grammar (24/7 and simple weekly rules; not public
holidays or date ranges) parsed at ingestion time, evaluated against the
current Warsaw-local moment at request time, and qualified into
`LIKELY_OPEN`/`LIKELY_CLOSED` unless `confidence_level` is `'high'` — which
nothing produces yet, so every status computed today is qualified, correct
given today's single, uncorroborated source. The price badge shows a real
parsed amount (`2 PLN`) when a toilet's `charge` tag fits a bounded
`<amount> <currency>` grammar (TASK-014, ADR 0010, PLN/EUR/USD only), and
the detail sheet shows three normalised payment facts — cash, card, coin
accepted — none fabricated. A map/list toggle (TASK-015) switches to an
accessible list view showing the same, already-ranked `toilets` array —
name, distance/ETA, status, price, up to two feature badges — where a row
tap opens the identical detail sheet a marker or the preview would;
`DESIGN.md` section 14's "map has equivalent list representation" is now
real, not aspirational. The five MVP filters (TASK-016, ADR 0011) apply
server-side, within the existing nearest-30-candidate cap, to markers, the
list, and the preview alike, since all three read the one filtered
`toilets` state; a filter only keeps a positively-confirmed fact, so
against today's mostly-unconfirmed real data a filter can honestly return
few or no results. An empty result is now diagnosed, not just shown
(TASK-017, ADR 0012): a `NIC BLISKO.` overlay tells an active filter (offer
to clear it) apart from an expandable radius (`SZUKAJ DALEJ` jumps straight
to `MAX_RADIUS_METERS`, no stepped ladder) apart from a radius already at
that maximum (an honest `ROZUMIEM`-dismissible state naming this search's
own limit, never the world's) — filters checked first, since they are the
more likely, more directly fixable cause. A real location grant from
outside the coarse `WARSAW_BBOX` (TASK-018, ADR 0013) gets its own
`JESTEŚ POZA WARSZAWĄ.` screen, distinct from the `denied` copy — the app
does know where the user is, just not somewhere it covers — with one
action, not the denied screen's two, since a retry cannot change the
answer; the out-of-area coordinate never reaches the marker, fetch, or
ranking code. `confidence_level` is now a real, computed value (TASK-019,
ADR 0014), not the schema's `'low'` default forever: `MEDIUM` for a toilet
verified within the last year with a non-uncertain access basis, `LOW`
otherwise, `HIGH` deliberately unreachable until a second source can
actually corroborate one (`TASK-022`) — the already-built detail-sheet
confidence hint and the opening-status qualification (`TASK-011`, ADR
0009) both pick this up with no further change. A validated, anonymous
report can now be submitted (TASK-020, ADR 0015): `ZGŁOŚ PROBLEM` on the
detail sheet opens `ReportSheet`'s seven `BRAND.md` reasons plus an
optional note, `POST /api/toilets/:id/reports` checks the toilet exists
before inserting, and the stored row carries no location, IP, or device
identifier — verified with a real curl smoke test against a running
production build and a real PostGIS database, insert/404/400 all
observed. The endpoint is now also rate-limited (TASK-021, ADR 0016): a
real Postgres-backed counter, keyed to a SHA-256 hash of the client's IP
(never the raw address) and a one-hour window, rejects a sixth report
from the same client within the hour with `429` and a `Retry-After`
header — verified the same way, a real curl sequence against a running
production build crossing the limit and a different IP staying
unaffected. No moderation UI reads `toilet_reports.status` yet. No
deduplication, analytics or error-tracking code exists. Ingestion exists
but has never run against the
live source — so the opening-hours and charge parsers, and the confidence
computation, have never seen a real OSM string, only constructed fixtures
matching their documented grammars — and the map — tiles, the location
dot, and the toilet markers — has never been visually observed rendering
for real from this session. Those areas are owned by later tasks.

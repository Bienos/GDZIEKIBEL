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
    layout.tsx        root layout, <html lang> per locale, metadata, hreflang;
                      also the app's effective root layout (no page exists
                      outside `[locale]`), so `metadataBase` lives here
                      (TASK-027, ADR 0022) — required once `openGraph`
                      uses a relative image path, or the build fails;
                      `generateMetadata` also sets `openGraph`/`twitter`
                      blocks from the same real per-locale copy
    page.tsx          top bar (wordmark, language switch) + the map shell
    page.module.css   styles for the top bar and page layout
    opengraph-image.tsx
                      code-generated, locale-aware share image via
                      `next/og` (TASK-027, ADR 0022): no design asset
                      pipeline exists, so this reads `tokens.css` colours
                      and the real `metaTitle`/`metaDescription` copy;
                      `generateStaticParams` makes it build-time static,
                      not per-request
  icon.tsx            code-generated favicon via `next/og` (TASK-027, ADR
                      0022): the same "WC" mark
                      `lib/toilets/marker-element.ts` puts on every map
                      marker, so the tab icon and in-app marker share one
                      visual language
  robots.ts           allows crawling, points at the real sitemap
                      (TASK-027, ADR 0022)
  sitemap.ts          lists `/pl` and `/en` — the only two real,
                      indexable pages; the bare `/` redirect target is
                      deliberately excluded (TASK-027, ADR 0022)
  api/toilets/nearby/route.ts
                      POST only; an oversized body (>8 KiB `content-length`)
                      is rejected with 413 before it is even parsed
                      (TASK-029); bounded nearby active toilets, filtered
                      (TASK-016, ADR 0011) and reordered by
                      rankNearbyToilets (TASK-009); also logs the
                      server-observed `results_loaded`/`no_results` and,
                      when a filter is active, `filter_applied` analytics
                      events (TASK-023, ADR 0018); an unexpected throw past
                      validation is caught, logged, and answered with a
                      generic 500 (TASK-024, ADR 0019)
  api/toilets/[id]/reports/route.ts
                      POST only; an oversized body is rejected with 413
                      before even the rate limit is checked (TASK-029); a
                      validated, anonymous, rate-limited report (TASK-020
                      ADR 0015, TASK-021 ADR 0016): the rate limit is
                      checked first (429 with Retry-After over 5/hour per
                      hashed IP), then 400 for a malformed id or invalid
                      body, 404 for a well-formed but unknown toilet id,
                      201 with the created report's id on success, which
                      also logs the server-observed `report_submitted`
                      analytics event (TASK-023, ADR 0018); an unexpected
                      throw anywhere in the handler is caught, logged, and
                      answered with a generic 500 (TASK-024, ADR 0019)
  api/analytics/events/route.ts
                      POST only; an oversized body is rejected with 413,
                      then a rate limit is checked before the body is even
                      parsed (429 with Retry-After over 120/hour per hashed
                      IP — TASK-029, ADR 0023, closing the gap TASK-023 left
                      open), then 400 for an unrecognised `eventName`, 201
                      on success; the write itself never fails the request
                      (insertAnalyticsEvent never throws); an unexpected
                      throw from the rate-limit check or `getPool()` itself
                      is caught, logged, and answered with a generic 500
                      (TASK-024, ADR 0019)
  globals.css         reset, body defaults, imports tokens.css; maplibre-gl's
                      own stylesheet is not imported here (TASK-025, ADR
                      0020) — it loads only alongside the script that needs
                      it, from MapShell.tsx itself
  tokens.css          design tokens (colour, spacing, type) — single source;
                      `--color-muted-500` is contrast-checked against
                      `--color-paper-50` (4.76:1, WCAG AA requires 4.5:1 —
                      TASK-026, ADR 0021), not merely eyeballed
components/
  map/MapShell.tsx    the Warsaw map (TASK-005), the location permission
                      flow (TASK-006), and nearby toilet markers with
                      click-to-select (TASK-008); always attempts a real
                      OpenFreeMap load (ADR 0024 — no key to gate on
                      anymore) and renders the tile fallback only if that
                      load fails before its first success; independent of
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
                      own `outside` screen distinct from `denied`; also
                      fires the client-only analytics events (TASK-023, ADR
                      0018) — `app_opened` on mount, `location_granted`/
                      `location_denied` from the permission flow, and
                      `toilet_selected` wherever a marker, list row, or the
                      preview selects a toilet — each via `reportEvent`,
                      which never throws; the `maplibre-gl` script and its
                      stylesheet load together via one `Promise.all` (TASK-025,
                      ADR 0020), so the map's own DOM is never created before
                      its styles have loaded, on every mount now (ADR 0024);
                      its three location-flow `role="dialog"` screens
                      (`asking`, `denied`, `outside`) are each named via
                      `aria-labelledby` pointing at their own heading
                      (TASK-026, ADR 0021)
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
                      for why); the navigation CTA also fires the
                      client-only `navigation_clicked` analytics event
                      (TASK-023, ADR 0018); its `role="dialog"` is named via
                      `aria-labelledby` pointing at its own heading (TASK-026,
                      ADR 0021), not just "dialog" alone
  map/ReportSheet.tsx  the report flow (TASK-020, DESIGN.md 9.4 position 8,
                      ADR 0015): the seven BRAND.md "Reporting" reasons as
                      radios, an optional note, WYŚLIJ ZGŁOSZENIE; success
                      replaces the form, failure keeps whatever was picked/
                      typed so retrying is not starting over; no
                      rate-limiting (TASK-021's job); its `role="dialog"` is
                      named via `aria-labelledby` (TASK-026, ADR 0021) —
                      previously wired to its own fieldset only, not the
                      dialog itself
  map/FiltersSheet.tsx
                      the five MVP filters (TASK-016, DESIGN.md 9.6): four
                      sections, toggles bound to a draft state; POKAŻ WYNIKI
                      applies it, WYCZYŚĆ clears and reapplies; no live
                      result count (see the task file for why); its
                      `role="dialog"` is named via `aria-labelledby`
                      (TASK-026, ADR 0021)
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
  site-url.ts         resolves the site's own absolute base URL (TASK-027,
                      ADR 0022): an explicit `SITE_URL` override, else
                      Vercel's own auto-provided `VERCEL_URL`, else
                      `localhost` — never a hardcoded, unsettled domain;
                      server-only, so not `NEXT_PUBLIC_`; feeds
                      `metadataBase`, `robots.ts`, `sitemap.ts`
  i18n/               supported locales and the copy dictionaries;
                      `metaDescription` is real, current copy from
                      `BRAND.md`'s own approved lines (TASK-027, ADR
                      0022), not the TASK-001 "Foundation build" leftover
  toilets/types.ts    enumerated values of the toilet model, mirroring the SQL types;
                      also PaymentMethods (TASK-014), the cash/cards/coins shape
  toilets/normalized-source-record.ts
                      Zod schema an ingestion adapter must emit (contract section 6)
  geo/warsaw.ts       coarse Warsaw bounding box, a first filter only;
                      `isWithinWarsawBbox` is also the outside-Warsaw check
                      the location flow uses (TASK-018)
  map/tile-provider.ts  `MAP_STYLE_URL`: the fixed OpenFreeMap style URL
                      (ADR 0024, superseding ADR 0005's MapTiler-key
                      setup) — no key needed; the one place that knows
                      the provider's URL
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
  analytics/types.ts  EVENT_NAMES, the nine documented FR-09 events
                      (TASK-023, ADR 0018), mirroring the SQL
                      analytics_event_name enum
  analytics/analytics-request.ts
                      validates an analytics POST body: exactly one known
                      `eventName`, nothing else (TASK-023)
  analytics/report-event.ts
                      client-side call to POST /api/analytics/events; never
                      throws and never rejects — a caller fires it without
                      awaiting, and a failure here must never look like the
                      feature it is attached to broke (TASK-023)
  analytics/rate-limit.ts
                      the analytics endpoint's rate limiter (TASK-029, ADR
                      0023): same one-hour fixed window and SHA-256 IP hash
                      as reports/rate-limit.ts, but its own 120-requests
                      limit and its own table — a deliberate sibling, not a
                      shared import, so the already-shipped report limiter
                      is never touched by this task
  http/content-length.ts
                      exceedsMaxRequestBodyBytes (TASK-029): a fast,
                      pre-parse `content-length` check (8 KiB) shared by
                      all three POST routes; a best-effort guard, not a
                      guarantee — a request with no `content-length` relies
                      on the hosting platform's own size limit instead
  observability/log-runtime-error.ts
                      the one place a runtime error becomes observable
                      (TASK-024, ADR 0019): a structured JSON `console.error`
                      line — no request body, coordinate, or property beyond
                      a fixed `LogContext` and the caught error ever reaches
                      it, by construction; the message/stack still passes
                      through `scrubSensitiveText` as a second layer
  observability/scrub-sensitive-text.ts
                      redacts a decimal coordinate pair, a `lat`/`lng`/
                      `lon`-keyed number, a URL's `user:password@` segment,
                      or a `password`/`secret`/`token`-keyed value from free
                      text (TASK-024 ADR 0019; credential/secret patterns
                      added TASK-029); bounded like `parseCharge`/
                      `parseOpeningHours` — a bare decimal or an ordinary
                      credential-free URL is left alone
  ingest/upsert.ts    source-agnostic write path; never deletes, marks
                      not_seen_since; writes open_24h/opening_hours_normalized
                      since TASK-013, price_amount_minor/currency and the
                      normalised payment_methods since TASK-014, and
                      access_raw since TASK-019 (ADR 0014); the `!previous`
                      branch now calls lib/ingest/dedup.ts before creating a
                      canonical toilet (TASK-022, ADR 0017) — the earlier
                      claim that a second source "reuses this without
                      change" did not survive building that requirement
  ingest/dedup.ts     cross-source matching (TASK-022, ADR 0017): pure —
                      computeNameSimilarity (a from-scratch Levenshtein, no
                      dependency; null on a missing or placeholder name,
                      never a false 100) and decideMatch (new/merge/
                      ambiguous from spatial + name-similarity thresholds,
                      all first-pass and named as such)
  ingest/fallback-name.ts
                      FALLBACK_TOILET_NAME ("Toaleta"), split out of
                      upsert.ts so dedup.ts can import it without a
                      circular dependency; re-exported from upsert.ts for
                      the existing import path
  ingest/osm/         the OpenStreetMap adapter: fetch, validate, normalize
                      (normalize.ts derives opening-hours fields since
                      TASK-013, and charge/payment-method fields since TASK-014;
                      accessRaw was already produced since TASK-002/003, only
                      stored on the canonical row since TASK-019); still the
                      only real adapter — TASK-022 built the matching engine
                      a second one would need, not a second adapter itself,
                      since no real second source is reachable (see PROGRESS.md)
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
  queries/dedup-candidates.ts
                      findCrossSourceSpatialCandidates and
                      insertDedupCandidate (TASK-022, ADR 0017); the spatial
                      query itself excludes same-source toilets, the one
                      guarantee that keeps today's single-source ingestion
                      provably unaffected
  queries/analytics.ts
                      insertAnalyticsEvent (TASK-023, ADR 0018): writes
                      `event_name` and a server-assigned `occurred_at`
                      only; wrapped so a write failure never throws —
                      analytics must never fail the request it is
                      attached to — but is no longer silent: the caught
                      error is logged via `logRuntimeError` (TASK-024,
                      ADR 0019)
  queries/analytics-rate-limit.ts
                      checkAndIncrementAnalyticsRateLimit (TASK-029, ADR
                      0023): the same atomic INSERT ... ON CONFLICT ...
                      RETURNING shape as report-rate-limit.ts, against its
                      own `analytics_rate_limit_windows` table
db/
  client.ts           shared pg connection pool; `pool.on('error', ...)`
                      routes an idle client's own failure through
                      `logRuntimeError` (TASK-024, ADR 0019) — found by that
                      task's own smoke test as an unstructured, uncaught
                      exception no per-route try/catch could reach
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
    *_add-dedup-candidates.sql
                      adds dedup_candidates, dedup_candidate_status
                      (TASK-022, ADR 0017)
    *_add-analytics-events.sql
                      adds analytics_events, analytics_event_name
                      (TASK-023, ADR 0018); no location/session/device
                      column
    *_add-analytics-rate-limit.sql
                      adds analytics_rate_limit_windows (TASK-029, ADR
                      0023) — same shape as report_rate_limit_windows, a
                      separate table so the two endpoints' very different
                      limits never share one counter
scripts/
  db/check-postgis.ts PostGIS health check (pnpm db:check)
  db/reconcile-migration-history.ts
                      one-time fix (ADR 0025) for a database whose schema
                      was created out of band, so node-pg-migrate's own
                      bookkeeping table doesn't know what already exists;
                      records each migration whose real object already
                      exists as already-run, stopping at the first one
                      that genuinely is not, so db:migrate applies only
                      what is truly missing
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
- `vercel.json` — framework, lockfile-enforced install, security headers,
  and `pnpm db:reconcile-migration-history && pnpm db:migrate && pnpm
  build` as the build command (ADR 0025) — every deploy reconciles then
  applies pending migrations first; the reconcile step is a one-time fix
  for a real historical mismatch, planned for removal once confirmed
  caught up
- `.github/workflows/ci.yml` — `quality`, `database` and `e2e` jobs
- `.github/dependabot.yml` — weekly npm and github-actions update checks
  (TASK-029)

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
- `docs/adr/0017-cross-source-deduplication.md` — cross-source matching
  only ever considers a toilet already backed by a *different* source,
  proving today's single-source ingestion unaffected; spatial (30 m) +
  name-similarity (80, from-scratch Levenshtein) thresholds, both a first
  pass; an ambiguous match stays unlinked (`toilet_id = NULL`) and flagged,
  never becomes a new toilet; a merge never overwrites the existing
  toilet's own columns. No real second source is reachable — a fresh
  egress check from the Warsaw/OSM-allowlisted environment on 2026-09-14
  confirmed it, so the matching engine is proven against fixtures only.
- `docs/adr/0018-first-party-analytics.md` — Postgres, not an external
  provider, resolving `ARCHITECTURE.md`'s open analytics-provider question
  the same way `ADR 0016` resolved rate limiting; `analytics_events` holds
  only `event_name` and a server-assigned `occurred_at` — no coordinate,
  session, or device column exists to leak; `insertAnalyticsEvent` never
  throws, so a write failure can never fail the request it is attached to;
  the endpoint is deliberately not rate-limited, a named gap mirroring
  `TASK-020`'s own reports endpoint before `TASK-021`.
- `docs/adr/0019-runtime-error-logging.md` — a first-party structured
  `console.error` logger, not Sentry (no account/DSN exists), the same
  resolution shape as ADR 0016/0018; leakage prevented by construction
  (no call site ever hands the logger a request, body, or coordinate),
  `scrubSensitiveText` as a bounded second layer; all three routes and
  `insertAnalyticsEvent`'s own swallowed catch now log through it; the
  pool's own `'error'` event is wired too — a real gap this task's own
  forced-failure smoke test found (an idle client's connection failing
  with no request in flight was an unstructured, uncaught exception
  before this fix).
- `docs/adr/0020-lazy-load-map-library-styles.md` — a real mobile
  Lighthouse run against the fallback path found `maplibre-gl.css` (~83 KB
  raw) loading unconditionally from `globals.css`, 98% flagged unused;
  moved into the same `Promise.all` that already lazy-loads the script,
  so the CSS follows the exact rule the script's own doc comment already
  stated but did not itself apply to its stylesheet. Measured: the
  `unused-css-rules` audit went from 0.5 to a perfect 1.0, total byte
  weight on the fallback page dropped 257→247 KiB. No performance budget
  is set — `PRODUCT.md` section 16 explicitly defers concrete numbers to
  after baseline measurement, and this session cannot measure the
  real-tile-provider path (no `NEXT_PUBLIC_MAPTILER_KEY`/egress here).
- `docs/adr/0021-accessible-dialog-names-and-contrast.md` — the same real
  Lighthouse run's accessibility category found `aria-dialog-name` and
  `color-contrast` both scoring 0; checking every other `role="dialog"`
  found the identical missing-name gap in all six (not just the one
  Lighthouse's single-page snapshot saw), fixed the same way everywhere;
  `--color-muted-500` darkened from a real computed WCAG ratio (4.06→4.76:1).
  Measured: accessibility score 92→100. A manual code-level review records
  what automated tooling could not check (touch targets, colour-alone
  status, marker labels, reduced motion, focus-visible) — all already
  passing, read directly rather than assumed; real screen-reader/keyboard
  and real-map-tile checks remain unverifiable from this session.
- `docs/adr/0022-seo-share-baseline.md` — code-generated `icon`/
  `opengraph-image` via `next/og` (no design asset pipeline exists),
  built from `tokens.css` colours and `BRAND.md`'s already-approved copy;
  `metaDescription`'s stale TASK-001 "Foundation build" text replaced with
  real, current, on-brand copy; `SITE_URL` → `VERCEL_URL` → localhost
  resolves `metadataBase`/`robots.ts`/`sitemap.ts` rather than hardcoding
  the recorded-as-unofficial `gdziekibel-bienos.vercel.app` deployment as
  a settled domain. Verified with a real curl smoke test against a
  running production build: real favicon, real per-locale OG images
  (visually confirmed on-brand), real `robots.txt`/`sitemap.xml`, and a
  complete `openGraph`/`twitter` `<head>` block with absolute URLs.
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
unaffected. No moderation UI reads `toilet_reports.status` yet. A second
source can now be ingested without creating obvious duplicate toilets
(TASK-022, ADR 0017): `lib/ingest/upsert.ts`'s `!previous` branch runs
real spatial-plus-name matching against any existing toilet already
backed by a *different* source before deciding to create, merge, or flag
for review — proven against a real database with synthetic fixtures under
a second, explicitly fictional source name, since no real second source
is reachable (a fresh egress check from the Warsaw/OSM-allowlisted cloud
environment on 2026-09-14 confirmed `dane.um.warszawa.pl`,
`api.um.warszawa.pl`, `overpass-api.de` and `iot.warszawa.pl` all still
fail). Today's real, single-source OSM ingestion is provably unaffected:
same-source candidates are never even queried, verified by the complete
pre-existing ingestion test suite passing unmodified. No moderation UI
reads `dedup_candidates.status` yet. First-party analytics now exists
(TASK-023, ADR 0018): nine `PRODUCT.md` FR-09 events — `app_opened`,
`location_granted`, `location_denied`, `results_loaded`, `no_results`,
`toilet_selected`, `navigation_clicked`, `filter_applied`,
`report_submitted` — are logged to a real `analytics_events` table holding
only an event name and a server-assigned timestamp, never a coordinate,
session, or device identifier. Four are already server-observed inside the
two existing route handlers; five are genuinely client-only and reach
`POST /api/analytics/events` through `reportEvent`, which never throws —
verified with a real curl/DB smoke test against a running production
build covering all nine events, an insert/400 pair on the endpoint
itself, and a direct `information_schema` query confirming the table's
three columns. The endpoint is not rate-limited, a named gap mirroring
the report endpoint's own gap before TASK-021. Runtime errors are now
observable (TASK-024, ADR 0019): all three route handlers, plus
`insertAnalyticsEvent`'s own swallowed catch and the connection pool's own
`'error'` event, log through one structured `console.error` sink — no
Sentry (or equivalent) account/DSN exists, so this is a first-party
minimum, not a named provider. No call site ever hands the logger a
request body or a coordinate; a bounded `scrubSensitiveText` redacts a
coordinate-shaped substring from an error's own message/stack as a second
layer. A client now sees one generic `500` on a genuine unexpected
failure, never a stack trace or the framework default. Verified with a
real forced failure (stopping Postgres under a running production build):
all three routes returned the generic `500`, the pool's own idle-client
error logged cleanly instead of the raw, uncaught-exception dump this
task's own smoke test first found, and no request body or coordinate
(including one deliberately placed in a report's `note`) ever reached a
log line. A real mobile performance baseline now exists for the fallback
path (TASK-025, ADR 0020): a Lighthouse run against `pnpm build && pnpm
start` found `maplibre-gl.css` loading unconditionally and 98% unused;
moving it into the same lazy-load gate as the script it already
dynamically imports fixed that measurably (`unused-css-rules` 0.5→1.0,
257→247 KiB total byte weight), proven by a real Playwright test that
fails without the fix. No numeric performance budget is set yet —
`PRODUCT.md` section 16 defers that until baseline measurement exists,
and the real-tile-provider path (the one a user actually experiences with
a working map) still cannot be measured from this session (no
`NEXT_PUBLIC_MAPTILER_KEY`/egress here). An accessibility pass now closes
the two real, automated findings that same Lighthouse run's accessibility
category caught (TASK-026, ADR 0021): every `role="dialog"` in the app —
all six across `MapShell.tsx`'s three location screens,
`ToiletDetailSheet.tsx`, `FiltersSheet.tsx`, and `ReportSheet.tsx` — now
has a real accessible name via `aria-labelledby`, not just the one
Lighthouse's single-page snapshot happened to see; `--color-muted-500`
is now a real, computed 4.76:1 against `--color-paper-50`, up from 4.06:1
(WCAG AA needs 4.5:1). Measured: accessibility score 92→100. A direct
code-level review, not a blanket claim, confirmed touch targets
(44×44 px+ throughout), colour-never-alone status badges, real
`<button>`+`aria-label` markers, and broad `:focus-visible` styling were
already correct; reduced motion is trivially satisfied since this app's
own CSS has no animation to gate. Real screen-reader/keyboard-only
testing and anything depending on real map tiles remain unverifiable
from this session, named honestly rather than assumed. A real SEO/share
baseline now exists (TASK-027, ADR 0022): a code-generated favicon and
locale-aware Open Graph/Twitter image (no design asset pipeline exists,
so both are built from `tokens.css` colours and `BRAND.md`'s already-
approved copy, reusing the exact "WC" mark every map marker already
shows), a `metadataBase`/`robots.ts`/`sitemap.ts` resolved through
`SITE_URL` → Vercel's own `VERCEL_URL` → localhost rather than a guessed
domain, and a `metaDescription` no longer describing a TASK-001
foundation state twenty-six tasks out of date. Verified with a real curl
smoke test against a running production build. The real production
domain remains an open, project-owner decision — `SITE_URL` is the one
setting a future session needs once it exists. Ingestion exists but has
never run against the live source — so
the opening-hours and charge parsers, and the confidence computation,
have never seen a real OSM string, only constructed fixtures matching
their documented grammars — and the map — tiles, the location dot, and
the toilet markers — has never been visually observed rendering for real
from this session. Those areas are owned by later tasks.

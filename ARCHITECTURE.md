# GDZIEKIBEL.PL — Architecture v1

Status: Proposed production architecture for MVP  
Scope: Warsaw-only mobile-first web app  
Principle: boring infrastructure, strong data model, small vertical slices

## 1. Architecture goals

Optimise for:

1. very fast mobile experience;
2. reliable geospatial search;
3. explicit data provenance/confidence;
4. low operational burden;
5. low initial cost;
6. privacy-conscious location handling;
7. simple deployment;
8. clear AI-agent task boundaries;
9. ability to scale without an early rewrite.

## 2. Chosen stack

### Web application

- **Next.js** (App Router)
- **TypeScript** with strict mode
- React
- CSS variables + project-owned component styles; utility CSS may be used if chosen in foundation, but the design tokens remain framework-agnostic.

### Map rendering

- **MapLibre GL JS**
- Production vector/raster tiles from a commercial/production-safe OSM-compatible tile provider.
- Do not rely on the public OpenStreetMap tile servers for production traffic.

The specific tile provider remains configurable through environment variables until pricing/terms are validated.

### Database

- **PostgreSQL**
- **PostGIS** extension
- Managed hosting: **Neon** is the default recommendation for v1, assuming PostGIS support is available on the selected plan.

Why:

- proper geospatial indexing,
- reliable relational model,
- easy SQL inspection,
- low operational burden,
- straightforward migration path.

### Backend/API

- Next.js Route Handlers / server-side modules in the same repository.
- No separate microservice for MVP.
- Domain/database logic remains separate from HTTP handlers to preserve testability.

### Validation

- **Zod** (or a comparable schema library if foundation chooses differently) for request/response/input validation.

### Testing

- Unit tests for pure domain/data utilities.
- Integration tests against a real test Postgres/PostGIS database where database behaviour matters.
- Playwright for critical browser/E2E journeys.

### Analytics

- **PostHog** or **Plausible** after privacy review.
- Do not send precise location.

### Error tracking

- **Sentry** or equivalent.
- Scrub request bodies/headers where they could contain location or user-entered notes.

### Hosting

- Web/API: **Vercel**.
- Database: **Neon**.
- Scheduled data ingestion: **GitHub Actions** initially, writing to Neon via restricted credentials.

This avoids tying long-running imports to request-serving infrastructure.

## 3. High-level system

```text
Browser / PWA
    |
    | HTTPS
    v
Next.js application on Vercel
    |
    | server-side domain/data modules
    v
PostgreSQL + PostGIS (Neon)
    ^
    |
    | scheduled ingestion/upsert
GitHub Actions ingestion jobs
    |
    +--> Warsaw/open data sources
    +--> OpenStreetMap / Overpass where legally/operationally appropriate
    +--> other validated sources

Browser
    |
    +--> map tile provider
    +--> external navigation provider on "Prowadź mnie"
```

## 4. Repository boundaries

Recommended structure after foundation:

```text
app/
  (public)/
  api/
components/
  ui/
  map/
  toilets/
lib/
  env/
  geo/
  toilets/
  reports/
  analytics/
  external-navigation/
db/
  migrations/
  schema/
  queries/
scripts/
  ingest/
tests/
  integration/
e2e/
```

Exact folder names may evolve, but ownership should stay clear:

- `app/` = HTTP/UI composition.
- `lib/toilets/` = domain operations/ranking.
- `db/` = persistence and migrations.
- `scripts/ingest/` = offline/scheduled imports.
- `components/` = reusable UI created only when slices need them.

## 5. Database model

The model separates **canonical toilets** from **source records** so multiple sources can describe the same real-world toilet.

### 5.1 `toilets`

Canonical user-facing record.

Suggested fields:

- `id uuid primary key`
- `slug text unique null`
- `name text not null`
- `address text null`
- `district text null`
- `geom geography(Point, 4326) not null`
- `access_type enum/text null`
- `price_state enum('free','paid','unknown')`
- `price_amount_minor integer null`
- `currency char(3) null`
- `open_24h boolean null`
- `opening_hours_normalized jsonb null`
- `opening_hours_raw text null`
- `wheelchair_accessible boolean null`
- `baby_changing boolean null`
- `unisex boolean null`
- `public_access boolean null`
- `seasonal boolean null`
- `canonical_status enum('active','temporarily_closed','removed')`
- `confidence_level enum('high','medium','low')`
- `confidence_score smallint null`
- `verified_at timestamptz null`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`

Indexes:

- GiST index on `geom`.
- normal indexes only where query evidence justifies them.

### 5.2 `toilet_source_records`

Stores provenance and source-specific data.

Suggested fields:

- `id uuid primary key`
- `source_name text not null`
- `source_record_id text not null`
- `toilet_id uuid null references toilets(id)`
- `source_url text null`
- `raw_payload jsonb null`
- `normalized_payload jsonb not null`
- `source_updated_at timestamptz null`
- `fetched_at timestamptz not null`
- `source_confidence smallint null`
- unique (`source_name`, `source_record_id`)

### 5.3 `toilet_reports`

- `id uuid primary key`
- `toilet_id uuid not null`
- `issue_type text not null`
- `note text null`
- `status enum('new','reviewed','accepted','rejected')`
- `created_at timestamptz not null`
- abuse/rate-limit metadata only if needed and privacy-reviewed.

Do not store precise user location with a report.

### 5.4 `ingestion_runs`

- source
- start/end
- success/failure
- records fetched
- records created/updated
- duplicates/ambiguous matches
- error summary

Do not store huge raw logs in this table.

## 6. Geospatial query strategy

Use PostGIS `ST_DWithin` + `ST_Distance` on `geography`.

Conceptual query:

1. find active toilets within configurable radius;
2. calculate distance from user point;
3. apply hard filters;
4. derive availability state;
5. rank by deterministic utility rules;
6. return bounded result set.

Never load all Warsaw toilets into server memory to rank them.

## 7. Nearby API design

For privacy, prefer a request body instead of raw latitude/longitude in a URL.

### `POST /api/toilets/nearby`

Request concept:

```json
{
  "location": { "lat": 52.2297, "lng": 21.0122 },
  "radiusMeters": 1500,
  "filters": {
    "openNow": false,
    "freeOnly": false,
    "wheelchairAccessible": false,
    "babyChanging": false,
    "open24h": false
  }
}
```

Response concept:

```json
{
  "results": [
    {
      "id": "...",
      "name": "...",
      "lat": 52.0,
      "lng": 21.0,
      "distanceMeters": 240,
      "approxWalkingMinutes": 3,
      "openingStatus": "open",
      "priceState": "free",
      "confidenceLevel": "high",
      "features": {
        "wheelchairAccessible": true,
        "babyChanging": null,
        "unisex": true
      }
    }
  ]
}
```

Contract rules:

- `null` = unknown where appropriate.
- API never fabricates a boolean from missing data.
- coordinates are validated and bounded.
- maximum radius/results are server-controlled.
- response does not expose unnecessary source raw data.

### `GET /api/toilets/:id`

Returns canonical detail.

### `POST /api/toilets/:id/reports`

Creates a validated report with rate limiting.

## 8. Location privacy

Requirements:

- Browser location remains in browser memory unless needed for the nearby request.
- Backend uses coordinates only to calculate results; do not persist them.
- `POST` body is preferred over query-string coordinates.
- Application logs must not log request bodies containing location.
- Analytics never receive raw lat/lng.
- Sentry/request tracing must be configured to avoid body capture for location endpoints.

## 9. Ranking architecture

Keep ranking in a pure/testable domain function after database retrieval.

Suggested deterministic stages:

### Stage A: exclusions

Exclude:

- `removed`,
- known closed when `openNow` filter is active,
- records that fail requested hard accessibility filters.

### Stage B: base priority

Distance is the dominant continuous factor.

### Stage C: trust adjustments

Small boosts/penalties for:

- confidence level,
- known open vs unknown,
- clear public access vs uncertain access.

### Stage D: deterministic tie-break

Tie-break by distance, confidence, then stable ID.

Do not create an opaque ML ranking system for MVP.

The exact scoring constants must live with tests and can be revised after real data/user evidence.

## 10. Opening-hours architecture

Source data may arrive in multiple formats.

Design:

1. preserve `opening_hours_raw`;
2. normalise where possible during ingestion;
3. compute current user-facing status server-side using Warsaw timezone (`Europe/Warsaw`);
4. retain `UNKNOWN` if parsing or source confidence is insufficient.

Do not silently discard malformed hours; record ingestion warnings.

## 11. Approximate walking time

MVP recommendation:

- derive `approxWalkingMinutes` from geodesic distance with a documented conservative multiplier/walking speed;
- prefix UI with `~` or equivalent;
- external navigation provides exact routing.

Post-MVP, a routing service can replace approximation if user evidence justifies cost/complexity.

## 12. External navigation

Generate safe navigation URLs server/client-side from canonical toilet coordinates.

Provide at least a Google Maps web fallback. Platform-specific Apple Maps support may be added when tested.

Do not embed private user coordinates into shareable URLs unnecessarily; destination-only external links are sufficient when the map app can use current location.

## 13. Data ingestion

### Initial pattern

Each source gets an adapter:

```text
fetch -> validate -> normalise -> stage/match -> upsert source record -> reconcile canonical toilet
```

### Adapter contract

Each adapter should produce a shared normalised shape and retain raw source payload only when licensing/privacy allows.

### Scheduling

Use GitHub Actions initially:

- source-specific cadence,
- manual trigger,
- failure visibility,
- restricted database credential.

Do not schedule a source more frequently than its update cadence/terms justify.

## 14. Deduplication

Do not hard-code an exact distance threshold before inspecting real datasets.

Suggested approach:

1. nearby spatial candidate match;
2. compare normalised name/address/source identifiers;
3. auto-merge only above a conservative confidence threshold;
4. flag ambiguous candidates for manual review/data task;
5. preserve each original source record regardless of canonical merge.

A future ADR should record final matching rules after source research.

## 15. Caching

### Nearby search

Default `no-store` because request contains current location and DB query should be cheap with PostGIS index.

Do not create shared caches keyed by precise user coordinates.

### Static/config data

Cache:

- public design assets,
- app shell,
- static metadata,
- map provider assets according to provider terms.

### Toilet detail

May use short revalidation later if beneficial.

## 16. Security

MVP threat priorities:

- report endpoint spam,
- oversized/malformed input,
- injection attempts,
- source ingestion poisoning/malformed datasets,
- exposed database credentials,
- accidental location logging.

Controls:

- schema validation,
- parameterised queries/ORM or safe SQL bindings,
- server-controlled limits,
- rate limiting for report writes,
- CSRF considerations for write endpoints where applicable,
- least-privilege database credentials,
- secrets only in environment/secret stores,
- dependency scanning in CI,
- security headers.

No authentication subsystem is needed for public MVP user flows.

## 17. Observability

Track:

- request error rate,
- nearby query latency,
- DB errors,
- ingestion failures,
- report submission failures,
- map/provider load failures where measurable.

Do not log:

- precise user coordinates,
- full request bodies for location endpoint,
- secrets,
- excessive raw source datasets.

## 18. CI/CD

On every PR:

- install with lockfile enforcement,
- lint,
- typecheck,
- unit tests,
- relevant integration tests,
- build.

For milestone/release:

- E2E critical path,
- migration check,
- production bundle sanity,
- accessibility smoke checks.

Deployment:

- preview per PR where available,
- staging/release verification,
- explicit production promotion.

## 19. Migration strategy

Use version-controlled SQL migrations or a migration-capable schema tool chosen during foundation.

Rules:

- every schema change is versioned;
- migrations are reviewed like code;
- destructive changes require explicit task scope;
- production migration plan includes rollback/forward-fix considerations;
- no agent may edit production schema manually as an implementation shortcut.

## 20. Environment variables

Expected categories:

- `DATABASE_URL`
- public map style/tile configuration
- analytics key (if enabled)
- error tracking DSN (if enabled)
- report rate-limit provider key only if one is adopted

Create `.env.example` with names only; never commit values.

## 21. Architecture non-goals

Do not introduce without evidence:

- microservices,
- message broker,
- Kafka,
- Kubernetes,
- GraphQL,
- Redis for ordinary reads,
- Elasticsearch,
- user authentication,
- event sourcing,
- complex CQRS,
- self-hosted routing engine.

## 22. Deployment boundaries

Production v1:

- Vercel serves web/API.
- Neon owns PostgreSQL/PostGIS.
- tile provider serves maps.
- GitHub Actions runs scheduled imports.
- analytics/error tracking are optional external services with privacy configuration.

## 23. Decisions still requiring validation

Before finalising ADRs, validate:

- exact Warsaw datasets and licences,
- exact tile provider and terms,
- exact analytics provider,
- whether Neon plan selected supports required PostGIS features,
- whether report rate limiting needs an external store/provider,
- actual opening-hours formats from sources,
- deduplication thresholds from real data.

Do not treat these as resolved facts merely because this architecture proposes defaults.

# TASK-007 — Nearby toilet API

## Goal

Given a coordinate, return the bounded set of active canonical toilets near
it, using PostGIS. No ranking, no filters, no map markers — those are later
tasks. This is the first task that reads the database from a request path.

## User-visible outcome

None directly. `POST /api/toilets/nearby` exists and returns real (if
currently empty, since no live ingestion has run) results shaped per
`docs/adr/0006-nearby-api-contract.md`. No page calls it yet.

## Acceptance criteria

### Endpoint

- `app/api/toilets/nearby/route.ts` handles `POST` only.
- Request body: `{ location: { lat, lng }, radiusMeters? }`, validated with
  Zod. `lat`/`lng` are range-checked; an out-of-range or non-numeric value is
  rejected with `400` and a body naming the offending field, never a
  fabricated fallback location.
- `radiusMeters` is optional, defaulting to `1500`, clamped server-side to a
  documented maximum (`5000`). The client cannot request an unbounded or
  enormous radius; `ARCHITECTURE.md` section 7 requires this explicitly.
- The result count is capped server-side (`30`) regardless of how many
  active toilets fall inside the radius.
- No `filters` field in the request yet; see ADR 0006 for why.

### Query

- Only `canonical_status = 'active'` toilets are eligible. Temporarily
  closed or removed toilets never appear in a nearby result, before any
  ranking exists.
- Uses `ST_DWithin` for the bound and `ST_Distance` for the reported
  distance, both on `geography`, per `ARCHITECTURE.md` section 6.
- Ordered by distance ascending. This is a default list order, not the
  ranking `TASK-009` owns; the query and its tests say so.
- Lives in `db/queries/nearby.ts`, parameterised, no string-built SQL.

### Response shape

Per `docs/adr/0006-nearby-api-contract.md`:

- `id`, `name`, `lat`, `lng`, `distanceMeters`, `approxWalkingMinutes`;
- `openingStatus`: always the literal `"UNKNOWN"` in this task;
- `priceState`: passed through from the schema's `price_state` unchanged;
- `confidenceLevel`: passed through from `confidence_level` unchanged;
- `accessType`: passed through from `access_type` unchanged;
- `features.wheelchair`, `features.changingTable`, `features.unisex`: the
  stored `feature_state` string (`'yes' | 'no' | 'limited' | 'unknown'`),
  never collapsed into a boolean.
- No `raw_payload`, no source-record fields, no internal ids beyond the
  toilet's own — `ARCHITECTURE.md` section 7's rule that the response does
  not expose unnecessary source raw data.

### Walking time

- `lib/toilets/walking-time.ts` derives `approxWalkingMinutes` from
  `distanceMeters` at a stated, named conservative constant (see ADR 0006),
  rounded up, never down.

### Privacy

- The request handler never logs the request body or the coordinates, at any
  log level, in success or failure.
- Coordinates are used only to build the query parameters; nothing persists
  them, in this table or any other.
- `POST` with a body is used, never coordinates in a query string or URL
  path, per `ARCHITECTURE.md` section 8.

### Validation failure

- A malformed body returns `400` with a body that names what was wrong,
  built from the Zod error, not a generic empty failure.
- The failure body still contains no coordinates the caller did not already
  send; nothing is echoed that was not already invalid.

## In scope

- `app/api/toilets/nearby/route.ts`;
- `db/queries/nearby.ts`;
- `lib/toilets/walking-time.ts`;
- the request/response Zod schemas;
- unit tests for the walking-time function and the response-shaping logic;
- an integration test against real PostGIS with inserted fixture toilets,
  proving the radius bound, the result cap, the `active`-only filter, and the
  distance ordering;
- `docs/adr/0006-nearby-api-contract.md` (already written; this task
  implements it);
- `docs/CODEMAP.md` and `PROGRESS.md` updates.

## Out of scope

Do **not**:

- implement filters, which `TASK-016` owns;
- implement ranking beyond plain distance order, which `TASK-009` owns;
- add `GET /api/toilets/:id` or the reports endpoint; `ARCHITECTURE.md`
  section 7 lists them but only the nearby endpoint is this task's job;
- parse or compute real opening-hours status, which `TASK-013` owns;
- compute a real confidence score, which `TASK-019` owns;
- call this endpoint from any page; `TASK-008` wires the map to it;
- add rate limiting; `ARCHITECTURE.md` section 16 raises it for the write
  endpoints (reports) specifically, and this is a read endpoint over a
  currently-empty table.

## Canonical context to read

- `AGENTS.md`
- `PROGRESS.md`
- `ARCHITECTURE.md` sections 6, 7, 8 and 16
- `PRODUCT.md` sections 9 (data truth model), 10 (opening status), 11
  (ranking, context only, not implemented here) and 12 (distance/ETA)
- `docs/adr/0003-first-data-source.md`, `0004-schema-conventions.md` and
  `0006-nearby-api-contract.md`

## Likely relevant code

- `db/migrations/*_toilet-schema.sql`, the columns this reads
- `db/client.ts`
- `tests/integration/schema.test.ts`, the `ST_DWithin` pattern already
  proven there
- `lib/toilets/types.ts`, the enum values passed through unchanged

## Constraints

- No ORM; parameterised `pg` queries, per ADR 0001.
- No new dependency beyond what already exists (`zod`, `pg`).
- Server-controlled radius and result caps are not optional; do not accept a
  client-supplied override of either.
- Never log request bodies for this endpoint.

## Verification

Run and record:

- `pnpm lint`, `pnpm format:check`, `pnpm typecheck`
- `pnpm test:unit`, including the new walking-time and response-shaping
  tests
- `pnpm db:migrate` on an empty database, then `pnpm test:integration`,
  including the new nearby-query tests with inserted fixture toilets
- `pnpm build`
- inspect the complete git diff

## Definition of done

TASK-007 is complete only when:

- every acceptance criterion is satisfied with observed evidence, including
  a real query run against PostGIS, not only against mocked data;
- the response never exposes a fabricated boolean or a collapsed unknown;
- no filter, ranking, opening-status, or confidence-scoring logic exists
  beyond what is explicitly named above as this task's job;
- `docs/CODEMAP.md` and `PROGRESS.md` reflect the repository;
- the complete diff contains no unrelated changes.

Then stop. Do not begin TASK-008.

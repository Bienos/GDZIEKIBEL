# TASK-004 — Ingest the first Warsaw toilet dataset (OpenStreetMap)

## Goal

Make ingestion of Warsaw toilets from OpenStreetMap reproducible with one
command, so that a development or staging database can be populated and the
result verified by counts.

Runs the adapter pattern from `ARCHITECTURE.md` section 13 against the source
described in `docs/contracts/osm-toilets-source.md`:

```text
fetch -> validate -> normalise -> stage/match -> upsert source record -> reconcile canonical toilet
```

## User-visible outcome

None. The live site is unchanged. The tables gain rows only in the database the
command is pointed at.

## Prerequisite: network egress

The live fetch needs `overpass-api.de`. The GdzieKibel cloud environment
permits it; the session that wrote this task does not. Everything except the
fetch is verifiable without the network, and `--from-file` replays a saved raw
response so the rest of the pipeline can be exercised anywhere.

## Acceptance criteria

### Fetch

- One Overpass query selects `amenity=toilets` nodes, ways and relations inside
  the Warsaw administrative boundary, not a bounding box.
- The boundary relation is **resolved at run time by tags and recorded**, never
  hard-coded: the run prints the relation id, name and `admin_level` it used
  and saves the lookup response. If zero or more than one candidate matches,
  the run aborts and says so.
- Every raw response is saved under a gitignored directory before any
  processing.
- Requests carry the project User-Agent. The public instance is queried a small
  number of times per run and retried at most once on 429/503/504.

### Validate

- Elements are validated before normalisation per the contract's section 7:
  a numeric position inside the coarse Warsaw box, integer id and version, a
  string-to-string tag map, no tag value over 4,096 characters.
- A rejected element is counted, its key and reason logged, and the run
  continues. Its raw body is never logged.

### Normalise

- Each element becomes a `NormalizedSourceRecord` exactly as the contract's
  section 6 maps it. An absent tag is `unknown` or `null`, never `no`, `free`,
  `false` or `open`.
- OSM usernames and user ids are not carried into the normalised record or the
  stored raw payload.
- Opening hours are stored raw and not interpreted.

### Upsert and reconcile

- One `ingestion_runs` row per run, with counts of fetched, created, updated,
  unchanged, rejected and not-seen, and `succeeded` or `failed`.
- Source records are keyed by (`source_name`, `source_record_id`). A record with
  the same `source_version` as stored is unchanged; a different version updates
  the source record and its canonical toilet.
- Because OpenStreetMap is the only source, each new source record creates one
  canonical toilet. That one-to-one rule is documented as temporary and is
  replaced by TASK-022 when a second source arrives.
- A source record not seen in the current run is marked `not_seen_since` with
  the run's start time. It is not deleted, and its canonical toilet's status is
  not changed by this task.
- The whole run is one transaction. A failure leaves the tables as they were
  and records `failed` with a summary.

### Nameless facilities

- A canonical toilet needs a non-null name. When the source has none, the
  label is the literal `Toaleta`. It claims nothing about access or price. This
  is recorded as a decision to revisit once copy rules for labels exist.

### Verification

- Unit tests cover validation and normalisation against a small, clearly
  synthetic fixture: a fully tagged node, a bare node, a way with `center`, a
  `fee=no` node, an `access=customers` node, an element with no position, and
  an element outside the coarse box.
- Integration tests against PostGIS run the upsert twice on the fixture and
  prove: first run creates N and N canonical toilets; second run reports N
  unchanged and creates nothing; a changed version reports one updated; a
  removed element reports one not-seen and deletes nothing.
- The command run against the live source from the permitted environment
  reports its counts and the resolved boundary relation, and those numbers are
  recorded in `PROGRESS.md` with the date.

## In scope

- `lib/ingest/osm/` fetch, validate and normalise modules;
- `lib/ingest/upsert.ts`, source-agnostic;
- `scripts/ingest/osm.ts`, the command, with `--from-file`;
- fixtures and tests as above;
- `docs/CODEMAP.md` and `PROGRESS.md` updates.

## Out of scope

Do **not**:

- schedule the run in GitHub Actions; there is no staging database to point it
  at yet, and `ARCHITECTURE.md` section 13 wants the schedule tied to a real
  cadence and credential;
- deduplicate across sources or within OSM, which TASK-022 owns;
- parse opening hours or compute open-now, which TASK-013 owns;
- compute confidence, which TASK-019 owns;
- ingest the hand-curated anchor layer; that is its own source and a later task;
- build any query, API or UI;
- add a dependency.

## Canonical context to read

- `AGENTS.md`
- `PROGRESS.md`
- `ARCHITECTURE.md` sections 13, 14 and 17
- `docs/contracts/osm-toilets-source.md`, all sections
- `docs/adr/0003-first-data-source.md` sections 2, 3 and 7
- `docs/adr/0004-schema-conventions.md`
- `db/migrations/1789312508934_toilet-schema.sql`
- `lib/toilets/normalized-source-record.ts`

## Likely relevant code

- `scripts/research/probe-sources.ts`, for the request, retry and raw-save
  pattern to reuse rather than reinvent
- `db/client.ts`
- `tests/integration/schema.test.ts`, for the database test pattern

## Constraints

- Everything the contract marks DECIDED is binding here.
- The boundary relation id is observed and printed by the run, never typed in.
- Never log a raw element at error level; log the key and the reason.
- Never persist `user` or `uid`.
- `--from-file` is for replaying a saved raw response and for tests. It must
  not be used to load invented data into a shared database.

## Verification

Run and record:

- `pnpm lint`, `pnpm format:check`, `pnpm typecheck`
- `pnpm test:unit`
- `pnpm db:migrate` on an empty database, then `pnpm test:integration`
- `pnpm ingest:osm --from-file tests/fixtures/osm/elements.json` against the
  development database, and the counts it prints
- from the permitted environment: `pnpm ingest:osm`, and the counts and
  boundary relation it prints
- `pnpm build`
- inspect the complete git diff

## Definition of done

TASK-004 is complete only when:

- the fixture replay and the integration tests pass with the counts above;
- a live run from the permitted environment has succeeded and its counts and
  boundary relation are in `PROGRESS.md` with the date;
- no dedup, hours parsing, confidence, query or UI code exists that this task
  did not have to create;
- `docs/CODEMAP.md` and `PROGRESS.md` reflect the repository;
- the complete diff contains no unrelated changes.

Then stop. Do not begin TASK-005.

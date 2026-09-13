# TASK-013 — Opening-hours normalisation/status

## Goal

Turn `opening_hours_raw` (already stored, never parsed — ADR 0006) into a
real `openingStatus` in the nearby API, replacing the constant `'UNKNOWN'`
every result has carried since `TASK-007`. `ARCHITECTURE.md` section 10,
`PRODUCT.md` section 10.

## Scope decision: a bounded grammar, not the full OSM specification

The OSM `opening_hours` micro-syntax is large (public holidays, date/season
ranges, comments, nested exceptions). Parsing all of it is its own
multi-week effort and not what this task, or `PLAN.md`'s one-line outcome,
asks for. `docs/adr/0009-opening-hours-status.md` records the exact bounded
subset this task parses:

- `24/7`, recognised as a distinct case;
- `;`-separated weekly rules of the form `<days> <time-ranges>` or
  `<days> off`/`<days> closed`;
- `<days>`: a comma-separated list of single day codes (`Mo`..`Su`) or day
  ranges (`Mo-Fr`);
- `<time-ranges>`: a comma-separated list of `HH:MM-HH:MM`, including a
  range crossing midnight.

Anything outside this — `PH` (public holidays), date/season ranges,
comments, a rule with no recognisable day part — fails to parse as a
**whole string**, not partially. `ARCHITECTURE.md` section 10: "retain
`UNKNOWN` if parsing or source confidence is insufficient." A partially
understood schedule is exactly that kind of insufficient confidence.

## Scope decision: qualifying OPEN/CLOSED by data confidence

`PRODUCT.md` section 10: "Never claim `OPEN` unless current time can be
evaluated against sufficiently trusted hours or equivalent evidence... If
hours are incomplete or stale, prefer a qualified state." This project's
only existing signal for "how trusted" a toilet's data is is
`confidence_level`, and every toilet ingested today carries `'low'`
(nothing sets it higher yet — `TASK-019`'s job; already established fact,
see `TASK-011`'s PROGRESS.md entry). `docs/adr/0009-opening-hours-status.md`
records the exact rule: a real day/time match against the rules is
reported as plain `OPEN`/`CLOSED` only when `confidence_level` is `'high'`;
`'medium'` or `'low'` gets `LIKELY_OPEN`/`LIKELY_CLOSED`. Given today's data,
every computed status is qualified — correct, not a bug, since nothing in
the pipeline has earned unqualified confidence yet.

## User-visible outcome

The nearby API's `openingStatus` field varies per toilet: `OPEN`, `CLOSED`,
`LIKELY_OPEN`, `LIKELY_CLOSED`, or `UNKNOWN` when there is nothing to
evaluate. The preview and detail sheet (`TASK-010`/`TASK-011`) show the
matching badge and colour (`DESIGN.md` "functional states must not depend
on pink/yellow alone" — green/red/orange, reusing the already-defined,
until-now-unused `--status-open`/`--status-closed`/`--status-uncertain`
tokens) instead of always showing the uncertain one.

## Acceptance criteria

- `lib/opening-hours/parse-opening-hours.ts` parses the bounded subset
  above into a structured `NormalizedOpeningHours`, pure, no I/O.
- `lib/opening-hours/compute-status.ts` computes `OpeningStatus` from that
  structure, a Warsaw-local moment, and `confidence_level`, pure — no
  `Date.now()` inside it; the caller passes an explicit `Date`.
- `lib/opening-hours/warsaw-time.ts` derives the Warsaw-local weekday and
  minutes-since-midnight for any UTC instant via `Intl.DateTimeFormat`
  (`Europe/Warsaw`), so daylight-saving transitions are handled correctly
  without a date-library dependency.
- The OSM adapter (`lib/ingest/osm/normalize.ts`) derives `open24h` and
  `openingHoursNormalized` from the raw `opening_hours` tag and the
  contract (`lib/toilets/normalized-source-record.ts`) requires both,
  matching the schema's existing `open_24h`/`opening_hours_normalized`
  columns (present since `TASK-003`, unused until now).
- `lib/ingest/upsert.ts` writes both new columns; `db/queries/nearby.ts`
  selects them; the nearby API computes and returns the real status.
- Ingestion logs (not silently discards) every element whose raw hours
  text existed but did not parse, per `ARCHITECTURE.md` section 10 — a
  console warning in `scripts/ingest/osm.ts`'s existing summary output, the
  same pattern already used for rejected elements. No schema change for
  this: a printed warning satisfies "do not silently discard," and adding a
  new `ingestion_runs` column is not required by anything here.
- `seasonal` is left untouched (still unknown by default): the bounded
  grammar above does not parse date/season ranges, so there is no real
  signal to derive it from yet.

## In scope

- The four `lib/opening-hours/*` modules above.
- `normalized-source-record.ts`, `normalize.ts`, `upsert.ts`,
  `db/queries/nearby.ts`, `nearby-response.ts`, `route.ts` changes to carry
  the new fields through and compute the real status.
- Widening `openingStatusLabel` (`lib/toilets/preview-copy.ts`) and its
  dictionary keys to cover all five states, plus status-colour classes for
  the preview/detail-sheet badges.
- Unit tests for the parser, the status computation (including the
  overnight-crossing-midnight case and the confidence-qualification rule),
  and the Warsaw-time helper.
- `docs/adr/0009-opening-hours-status.md`.
- `docs/CODEMAP.md` and `PROGRESS.md` updates.

## Out of scope

Do **not**:

- parse public holidays, date/season ranges, or any syntax outside the
  bounded grammar above;
- populate `seasonal`;
- add a new `ingestion_runs` column for warnings;
- change ranking (`TASK-009`), ingest a second source (`TASK-022`), or
  touch filters/list view;
- re-run ingestion against the live source from this session (no egress to
  Overpass here, an existing, already-documented limitation).

## Canonical context to read

- `AGENTS.md`
- `PROGRESS.md`
- `ARCHITECTURE.md` section 10
- `PRODUCT.md` section 10
- `DESIGN.md` section 8 ("Toilet marker" states), `BRAND.md` "Open / closed
  / uncertain" copy
- `docs/adr/0006-nearby-api-contract.md` (what this task replaces)

## Likely relevant code

- `db/migrations/1789312508934_toilet-schema.sql` — `open_24h`,
  `opening_hours_normalized` columns, already present, unused until now
- `lib/ingest/osm/normalize.ts`, `lib/toilets/normalized-source-record.ts`
- `db/queries/nearby.ts`, `lib/toilets/nearby-response.ts`,
  `app/api/toilets/nearby/route.ts`
- `lib/toilets/preview-copy.ts`, `components/map/MapShell.module.css`

## Constraints

- No new dependency: `Intl.DateTimeFormat` (built into the JS runtime)
  handles the Warsaw timezone and DST, so no date library is added.
- No schema migration: both columns this task writes to already exist.

## Verification

Run and record:

- `pnpm lint`, `pnpm format:check`, `pnpm typecheck`
- `pnpm test:unit`, including the new opening-hours modules' tests
- `pnpm test:integration` (the nearby query gains two selected columns;
  existing tests must still pass since they never populate them)
- `pnpm build`
- `pnpm test:e2e` (the existing mocked fixtures already hard-code
  `openingStatus`, so they keep passing unchanged; extend only if a real
  status-colour assertion is easy to add)
- inspect the complete git diff

## Definition of done

TASK-013 is complete only when:

- the nearby API returns a real, computed `openingStatus` for any toilet
  whose stored hours fall inside the bounded grammar, and `UNKNOWN`
  otherwise — never a guess outside that grammar;
- the confidence-qualification rule is documented and tested;
- `docs/CODEMAP.md` and `PROGRESS.md` reflect the repository, including
  that this session cannot re-run ingestion against live OSM data to
  observe real-world hours strings;
- the complete diff contains no unrelated changes.

Then stop. Do not begin TASK-014.

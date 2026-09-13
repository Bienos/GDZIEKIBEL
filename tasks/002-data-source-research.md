# TASK-002 — Data-source research and source decision

## Goal

Choose the first toilet data source for GdzieKibel.pl and record the choice with
evidence.

Desk research already exists at
`docs/research/2026-09-13-warsaw-toilet-sources.md`. This task does not repeat
it. It verifies what the chosen source actually provides, reads its licence, and
writes the decision down.

**The city dataset is deferred, by the project owner's decision on 2026-09-13.**
Every request to the Warsaw open-data catalogue returned HTTP 503. Rather than
block the roadmap on a service nobody can reach, OpenStreetMap becomes the first
source and the city dataset is revisited later. See `Deferred: Warsaw city open
data` below for what must still be recorded about it.

No production feature code is produced.

## User-visible outcome

None. This task produces decisions and documentation only.

## Prerequisite: network egress

Satisfied. A cloud environment permitting the OpenStreetMap hosts was created on
2026-09-13 and Overpass answered HTTP 200 from it. The probe reports the
allowlist block explicitly if a session runs without it.

Do not fabricate, infer or recall from memory any value this task is meant to
observe. If a value cannot be observed, record it as unverified and stop rather
than guessing.

## Acceptance criteria

### OpenStreetMap, the first source

Each item recorded with the exact URL consulted and the date observed:

- the licence, quoted from the source, with a link to the terms themselves;
- the attribution obligation, quoted, and where the product will satisfy it;
- a stated conclusion on whether the share-alike obligation reaches the product
  database, with the reasoning and the text it rests on. Flag it for legal
  review rather than asserting a conclusion the sources do not support;
- an observed count of `amenity=toilets` within a stated Warsaw area, with the
  exact query and the area definition used;
- an observed count of venues carrying `toilets=*` in the same area;
- observed tag coverage over those elements for at least `opening_hours`, `fee`,
  `access`, `wheelchair`, `changing_table`, `operator`, `name` and `level`, as
  counts and shares. Run `pnpm research:probe -- --full` to obtain it;
- a decision between a periodic extract and live Overpass access for ingestion,
  with the reasoning. The public Overpass and Nominatim services are not a
  production backend.

The coverage numbers are the important part. They say what share of records the
product can state an opening time or an access rule for, which is the difference
between a usable result and a map pin.

### Deferred: Warsaw city open data

Do not attempt to make this work. Record only:

- that all 16 catalogue requests returned HTTP 503 on 2026-09-13, across both
  hosts, both CKAN paths and all four search terms;
- the response body and content type from the probe output, which say whether
  the service was down or the CKAN assumption is wrong for the current platform;
- that no dataset identifier, schema, record count, cadence or licence has been
  observed, and that all of them remain unverified;
- what a future task would need to do to close it.

This becomes an entry in the ADR under a heading that makes the deferral
explicit. It must not read as though the city dataset was evaluated and rejected.

### PKP and transport hubs

- Determine whether any structured feed exists for station toilet data.
- If none exists, record that decision and the size of the manually curated hub
  layer that replaces it, including which stations it covers.
- Record the metro toilet rule as a source rule with its stated hours and the
  page it comes from, marked as coming from a page that has not been re-verified
  while `warszawa19115.pl` is unreachable.

### Source decision

- A field-level table naming the authoritative source for each field the product
  needs, and the fallback. Record-level source priority is not sufficient.
- OpenStreetMap named as the first ingestion source for TASK-004.
- A licence compatibility conclusion for the chosen source.
- A note on what changes when the city dataset is added later, so the schema
  designed in TASK-003 does not have to be rebuilt for it.

### Outputs

- A source contract in `docs/contracts/` describing what OpenStreetMap provides,
  in the shape the ingestion adapter will consume.
- An ADR in `docs/adr/` recording the source decision, the deferral and its
  reasoning.
- `PROGRESS.md` updated with observed facts and any remaining unresolved item.

## In scope

- verification of OpenStreetMap coverage, counts and licence;
- recording the city-dataset deferral with its evidence;
- the field-level source decision;
- the source contract and the ADR;
- running and, if needed, adjusting the existing probe.

## Out of scope

Do **not**:

- attempt to work around the city catalogue's 503, or scrape the city site;
- create or migrate product schema, which TASK-003 owns;
- build the ingestion pipeline, which TASK-004 owns;
- implement deduplication, ranking, the nearby API, the map or any UI;
- add runtime dependencies to the application;
- wire a probe script into the application or into CI;
- commit bulk source data dumps to the repository;
- promote research recommendations into `PRODUCT.md`, `DESIGN.md` or
  `ARCHITECTURE.md` as part of this task.

## Canonical context to read

- `AGENTS.md`
- `PROGRESS.md`
- `PLAN.md`, the Milestone 0 entry for this task
- `docs/research/2026-09-13-warsaw-toilet-sources.md`, sections 1.4, 5, 6 and 7
- `ARCHITECTURE.md` sections 13, 14 and 23
- `docs/adr/0001-foundation-stack.md`

Do not read the full brand or visual libraries. This task produces no copy and
no UI.

## Likely relevant code

`scripts/research/probe-sources.ts`, run with `pnpm research:probe`, and
`pnpm research:probe -- --full` for tag coverage. Its parsers live in
`scripts/research/parse.ts` and are covered by
`tests/unit/research-parse.test.ts`.

The probe is not application code. `scripts/ingest/` is the eventual home for
ingestion but is not created by this task.

## Constraints

- Unknown stays unknown. A missing tag is not `false` and a missing licence is
  not permission.
- Respect the usage policies of the public OpenStreetMap services. They are for
  one-off inspection here, not for repeated automated querying.
- Counts from different products measure different things. Do not compare them
  as if they were the same metric.
- Do not commit secrets or API keys.
- The research document is evidence. Cite it, do not treat it as verified fact.
- The deferral is the project owner's decision, not a finding. Record it as such.

## Verification

- Every factual claim in the deliverables carries the URL consulted and the date
  observed.
- Every count comes from a query recorded alongside it, not from a published
  figure.
- The licence conclusion quotes the terms it rests on.
- The probe exits 0 only when it observed a dataset; exit 2 means it succeeded at
  something but answered nothing about the catalogue. Do not read a non-zero exit
  as a result.
- Inspect the complete git diff before stopping.

## Definition of done

TASK-002 is complete only when:

- every OpenStreetMap acceptance criterion is satisfied or explicitly recorded as
  an unresolved blocker with the reason;
- the city-dataset deferral is recorded with its evidence, and reads as a
  deferral rather than an evaluation;
- the source contract and the ADR exist and disagree with nothing in
  `ARCHITECTURE.md`;
- the field-level source decision is written down;
- `PROGRESS.md` states what was observed, when, and from which URLs;
- no product schema, ingestion code or feature code has been created;
- the complete diff contains no unrelated changes.

Then stop. Do not begin TASK-003.

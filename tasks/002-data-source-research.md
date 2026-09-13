# TASK-002 — Data-source research and source decision

## Goal

Turn the Warsaw toilet data-source research into a decision that can be built
on: confirm what the candidate sources actually provide, under what licence and
at what cadence, then choose the first source(s) and record the choice.

Desk research already exists at
`docs/research/2026-09-13-warsaw-toilet-sources.md`. This task does not repeat
it. This task closes the gaps that document explicitly leaves open, against the
live services.

No production feature code is produced.

## User-visible outcome

None. This task produces decisions and documentation only.

## Prerequisite: network egress

The verification below requires reaching `dane.um.warszawa.pl`,
`api.um.warszawa.pl`, `warszawa19115.pl`, `pkp.pl` and OpenStreetMap services.

The sandboxed agent environment used for TASK-001 denies all of these at the
egress proxy, observed on 2026-09-13 as HTTP 403 on CONNECT. Run this task in an
environment whose network policy permits those hosts, or have a person perform
the lookups and supply the raw responses.

Do not fabricate, infer or recall from memory any value this task is meant to
observe. If a value cannot be observed, record it as unverified and stop rather
than guessing.

## Acceptance criteria

### Warsaw city open data

For the toilet dataset, each item recorded with the exact URL consulted and the
date observed:

- dataset identifier;
- endpoint and whether an API key or registration is required;
- full field list with types and at least one complete example record;
- record count at the time of observation;
- refresh cadence as stated by the publisher;
- licence or reuse terms, quoted, with a link to the terms themselves;
- pagination behaviour and any documented rate limits;
- whether removed or temporarily unavailable facilities are represented, and how;
- whether a per-record last-modified timestamp exists;
- whether operational status is exposed separately from opening hours.

Where the legacy `api.um.warszawa.pl` service and the newer
`dane.um.warszawa.pl` service differ, record both and state which one the
project will consume.

### OpenStreetMap

- Confirm the licence and the attribution obligation, quoted from the source.
- State a conclusion on whether the share-alike obligation reaches the product
  database, with the reasoning and the text it rests on. Flag it for legal
  review rather than asserting a conclusion the sources do not support.
- Record an observed count of `amenity=toilets` within a stated Warsaw area,
  plus toilets attached to venues via `toilets=*`, including the exact query and
  the area definition used.
- Decide between a periodic extract and live Overpass access for ingestion, and
  record why. The public Overpass and Nominatim services are not a production
  backend.

### PKP and transport hubs

- Determine whether any structured feed exists for station toilet data.
- If none exists, record that decision and the size of the manually curated hub
  layer that replaces it, including which stations it covers.
- Record the metro toilet rule as a source rule with its stated hours and the
  page it comes from.

### Source decision

- A field-level table naming the authoritative source for each field the
  product needs, and the fallback. Record-level "source priority" is not
  sufficient.
- The chosen first source or sources for TASK-004 ingestion, stated plainly.
- A licence compatibility conclusion covering the combination of chosen sources.

### Outputs

- A source contract in `docs/contracts/` describing what each chosen source
  provides, in the shape the ingestion adapter will consume.
- An ADR in `docs/adr/` recording the source decision and its reasoning.
- `PROGRESS.md` updated with observed facts and any remaining unresolved item.
- `docs/research/README.md` updated if a further research snapshot is added.

## In scope

- live verification of the candidate sources;
- licence reading and a stated compatibility conclusion;
- observed counts and coverage comparison;
- the field-level source decision;
- the source contract and the ADR;
- throwaway probe scripts, if they are needed to read a source.

## Out of scope

Do **not**:

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
- `docs/research/2026-09-13-warsaw-toilet-sources.md`, sections 1, 5, 6 and 7
- `ARCHITECTURE.md` sections 13, 14 and 23
- `docs/adr/0001-foundation-stack.md`

Do not read the full brand or visual libraries. This task produces no copy and
no UI.

## Likely relevant code

None exists yet. The repository contains the TASK-001 foundation only.

`scripts/ingest/` is the eventual home for ingestion code but is not created by
this task. Any probe script written here stays outside the application, is not
imported by it, and is either deleted before completion or kept under a clearly
marked one-off path with its purpose documented.

## Constraints

- Unknown stays unknown. A missing field is not `false` and a missing licence is
  not permission.
- An unverified licence blocks ingestion. Do not plan around a licence nobody has
  read.
- Respect the usage policies of the public OpenStreetMap services. They are for
  one-off inspection here, not for repeated automated querying.
- Counts from different products measure different things. Do not compare them
  as if they were the same metric.
- Do not commit secrets or API keys. If a source needs a key, record that it
  needs one and where it goes, not its value.
- The research document is evidence. Cite it, do not treat it as verified fact.

## Verification

- Every factual claim in the deliverables carries the URL consulted and the date
  observed.
- Every count comes from a query that is recorded alongside it, not from a
  published marketing figure.
- The licence conclusion quotes the terms it rests on.
- Desk research alone does not satisfy this task. If the live services could not
  be reached, the task is blocked, not complete, and the blocker is recorded in
  `PROGRESS.md`.
- Inspect the complete git diff before stopping.

## Definition of done

TASK-002 is complete only when:

- every acceptance criterion is satisfied or explicitly recorded as an
  unresolved blocker with the reason;
- the source contract and the ADR exist and disagree with nothing in
  `ARCHITECTURE.md`;
- the field-level source decision is written down;
- `PROGRESS.md` states what was observed, when, and from which URLs;
- no product schema, ingestion code or feature code has been created;
- the complete diff contains no unrelated changes.

Then stop. Do not begin TASK-003.

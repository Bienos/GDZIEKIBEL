# Research probes

One-off scripts that read external sources so a task can record what those
sources actually return.

These are **not application code**. They are not imported by the app, not run in
CI, and add no runtime dependency. They exist so that a research task rests on
observation rather than recall.

## probe-sources.ts

Supports TASK-002. Queries the Warsaw dataset catalogue, samples each
datastore resource it finds for its field list, record count and one example
record, counts Warsaw toilets in OpenStreetMap via Overpass, saves every raw
response, and writes `OBSERVATIONS.md` summarising what was seen.

```bash
pnpm research:probe            # catalogue metadata and counts
pnpm research:probe -- --full  # also tag coverage over Warsaw toilet elements
```

Output goes to `.research-output/`, which is gitignored. Raw source dumps must
not be committed.

Exit codes:

| Code | Meaning |
| --- | --- |
| 0 | the catalogue returned at least one dataset |
| 1 | every request failed |
| 2 | some requests succeeded but the catalogue returned no dataset |

Code 2 exists because a run can succeed at OpenStreetMap and still answer
nothing about the Warsaw dataset, which is the main question of TASK-002.

Notes:

- The script asserts nothing. Anything it did not observe is written as
  UNVERIFIED, including every licence question, which needs a person to read
  the published terms.
- It needs outbound access to `api.um.warszawa.pl`, `dane.um.warszawa.pl` and
  `overpass-api.de`. Sandboxed agent environments commonly deny all three, and
  the report then records the denial.
- Datastore sampling is capped at ten resources per run and uses `limit=1`, so
  a run makes a few dozen small requests at most.
- Each failure in the report carries the response content type and the first 240
  characters of the body, so a bare status code explains itself.
- Overpass returns 429, 503 or 504 under load. Each Overpass query is retried
  once after a 20 second pause, and no more than once.
- The bounding box in the script is a probe convenience. The project's real area
  definition is for TASK-002 to decide and record.
- Overpass is queried a small number of times per run, in line with its usage
  policy. It is not a production backend.

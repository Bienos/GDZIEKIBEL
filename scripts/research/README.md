# Research probes

One-off scripts that read external sources so a task can record what those
sources actually return.

These are **not application code**. They are not imported by the app, not run in
CI, and add no runtime dependency. They exist so that a research task rests on
observation rather than recall.

## probe-sources.ts

Supports TASK-002. Queries the Warsaw dataset catalogue and OpenStreetMap via
Overpass, saves every raw response, and writes `OBSERVATIONS.md` summarising
what was seen.

```bash
pnpm research:probe            # catalogue metadata and counts
pnpm research:probe -- --full  # also tag coverage over Warsaw toilet elements
```

Output goes to `.research-output/`, which is gitignored. Raw source dumps must
not be committed.

Notes:

- The script asserts nothing. Anything it did not observe is written as
  UNVERIFIED, including every licence question, which needs a person to read
  the published terms.
- It needs outbound access to `warszawa.pl` and `overpass-api.de`. Sandboxed
  agent environments commonly deny both, and the report then records the denial.
- The bounding box in the script is a probe convenience. The project's real area
  definition is for TASK-002 to decide and record.
- Overpass is queried a small number of times per run, in line with its usage
  policy. It is not a production backend.

# Research

Dated research snapshots and evidence gathered before or during a task.

## Status of files in this folder

Research documents are **evidence, not sources of truth**.

`AGENTS.md` assigns ownership of requirements to `PRODUCT.md`, `BRAND.md`,
`DESIGN.md` and `ARCHITECTURE.md`, and ownership of accepted decisions to
`docs/adr/` and `docs/contracts/`. Nothing in this folder overrides those files.

A recommendation in a research document becomes binding only when it is
explicitly promoted into the owning document or into an ADR/contract. Until
then it is a hypothesis, whatever confidence the research expresses.

Research documents are kept verbatim as received and are not edited to match
later decisions. Supersede a snapshot with a new dated file instead.

## Files

- `2026-09-13-warsaw-toilet-sources.md` — Warsaw toilet data sources,
  competitors, user behaviour and data-model implications. Authored outside
  this repository and committed unchanged. Its own limitations section states
  that the Warsaw open-data toilet dataset endpoint, schema and licence were
  **not** verified against the live service. TASK-002 owns that verification.

# ADR 0011 — Filter unknown-data semantics

Status: Accepted
Date: 2026-09-13
Scope: TASK-016 — Core filters

## Context

`PRODUCT.md` section 6.3 lists the five MVP filters and one hard rule:
"Unknown data must remain distinguishable from `false`." That rule governs
the *data model* — it does not, by itself, say what an active filter
should do when the underlying fact is `'unknown'`. Implementing the
filters requires a concrete answer.

## Decision

**A filter only keeps a toilet whose relevant fact is positively confirmed
to satisfy it.** `'unknown'` never matches; `'limited'` (for the two
`FeatureState` filters, wheelchair and baby-changing) never matches either
— the filter promises confident accessibility, and a partial or uncertain
fact is not that.

This is not a new rule invented for this task. `PRODUCT.md` section 6.3
already phrases three of the five filters as "where data exists" —
wheelchair, baby-changing, 24h — meaning the product's own text already
scopes them to confirmed data. This decision applies the identical rule
symmetrically to the other two (open-now, free) rather than inventing a
different, inconsistent rule for them.

The alternative — treating `'unknown'` as a pass so an active filter never
excludes uncertain data — was rejected: it would silently send a
wheelchair user to a toilet nobody has confirmed is accessible, which is a
worse failure than an honest empty or thin result set. Excluding
`'unknown'` does not collapse it into `'no'` at the *data* level (the
toilet's own record still says `'unknown'`, unchanged, visible in its
detail sheet); it only decides that an unconfirmed fact cannot satisfy a
filter that specifically asks for confirmation. Filtering is a display-
time decision about what to show under a specific request, not a claim
about what the toilet actually is.

## Consequences

- Against today's real ingested data — every toilet carries `'unknown'`
  wheelchair/changing-table/24h facts, since nothing sets them otherwise
  yet — every filter that touches those facts can return zero results.
  This is expected and correct, not a defect: `TASK-017 — No-results and
  radius expansion` exists specifically to give that state a useful
  fallback, and its existence in the roadmap immediately after this task
  confirms the sequencing was already anticipated.
- Filtering is applied server-side, within the same nearest-30-candidate
  cap `db/queries/nearby.ts` already enforces, before ranking
  (`ADR 0007`). A filtered response can be smaller than an unfiltered one
  even when more matching toilets exist farther away; expanding the
  search radius to compensate is `TASK-017`'s job, not this one's.
- Once real, corroborated data exists (more sources, `TASK-019`'s
  confidence work, or manual verification), filters will start returning
  real matches without any change to this logic — the semantics were
  correct from the start, only the data was thin.

## Not decided here

Whether a future filter should ever treat `'limited'` as a partial match
(e.g., a UI that distinguishes "fully accessible" from "partially
accessible" as two separate filter states) is left for whenever real usage
data shows the current binary treatment is too coarse.

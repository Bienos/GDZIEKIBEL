# ADR 0009 — Opening-hours parsing and status computation

Status: Accepted
Date: 2026-09-13
Scope: TASK-013 — Opening-hours normalisation/status

## Context

`ARCHITECTURE.md` section 10 lays out the shape (preserve raw, normalise
during ingestion, compute current status server-side in `Europe/Warsaw`,
retain `UNKNOWN` when insufficient) but not the exact grammar or the exact
rule for when a computed read counts as trustworthy enough to state
plainly. `PRODUCT.md` section 10 gives the five user-facing states and one
hard rule ("never claim `OPEN`... without sufficiently trusted evidence")
without defining "sufficiently trusted." Implementing this requires both
decisions.

## Decisions

### A bounded subset of OSM's `opening_hours` syntax, not the full grammar

The full specification supports public holidays, date and season ranges,
comments, and exceptions layered on top of a base schedule. This task
parses only:

- `24/7` as a distinct, explicit case;
- `;`-separated rules, each `<days> <time-ranges>` or `<days> off`/`<days>
  closed`;
- `<days>`: `Mo`..`Su` singly, comma-lists, or ranges (`Mo-Fr`);
- `<time-ranges>`: comma-separated `HH:MM-HH:MM`, including a range that
  crosses midnight (`22:00-02:00`, or the equivalent `22:00-26:00` form
  some sources use).

Any rule string outside this — containing `PH`, a date, a comment, or with
no recognisable day part — makes the **entire** raw string fail to parse.
Partial application (parsing the rules it understands, discarding the
rest) was considered and rejected: a schedule with a public-holiday
exception silently dropped is not a fact this project can vouch for
concretely, and `ARCHITECTURE.md` section 10 is explicit that insufficient
parsing confidence means `UNKNOWN`, not "best effort." A day genuinely not
mentioned by any successfully-parsed rule is treated as closed for that
day — the standard `opening_hours` convention (a schedule states when a
place is open; anything unstated is not).

### OPEN/CLOSED is qualified into LIKELY_OPEN/LIKELY_CLOSED by confidence

`PRODUCT.md` section 10's "sufficiently trusted hours or equivalent
evidence" needed a concrete test. This project already has exactly one
signal for how trusted a toilet's data is: `confidence_level`
(`high`/`medium`/`low`, `PRODUCT.md` section 9). The rule: a real day/time
match is reported as plain `OPEN`/`CLOSED` only when `confidence_level` is
`'high'`; `'medium'` or `'low'` reports the same underlying read as
`LIKELY_OPEN`/`LIKELY_CLOSED` instead. `PRODUCT.md`'s rule names `OPEN`
specifically; this task applies the same qualification symmetrically to
`CLOSED` too, for consistency — stating a toilet is definitely closed on
data no more trustworthy than an unverified single source is the same kind
of overclaim as stating it is definitely open.

Every toilet ingested today carries `confidence_level = 'low'` (nothing
sets it higher until `TASK-019`), so every computed status right now is
qualified: `LIKELY_OPEN` or `LIKELY_CLOSED`, never plain `OPEN`/`CLOSED`.
This is the correct, honest behaviour given today's single, uncorroborated
source — not a bug, the same shape of fact already recorded for ranking
(ADR 0007) and the detail sheet's confidence hint (`TASK-011`).

### `Intl.DateTimeFormat`, not a date library

Computing "is it open right now in Warsaw" needs the current weekday and
time of day in `Europe/Warsaw`, correct across the CET/CEST daylight-saving
transition. The runtime's built-in `Intl.DateTimeFormat` with
`timeZone: 'Europe/Warsaw'` does this correctly without adding a
dependency (Luxon, date-fns-tz, or similar) for what is otherwise one
timezone conversion.

## Consequences

- `lib/opening-hours/parse-opening-hours.ts` and `compute-status.ts` are
  pure and fully unit-testable against fixed instants, independent of the
  real current time or a database.
- A future source (`TASK-022`) that uses the same `opening_hours` syntax
  can reuse `parse-opening-hours.ts` unchanged; one that uses a different
  format needs its own parser feeding the same `NormalizedOpeningHours`
  shape, which `compute-status.ts` does not need to know about.
- Once `TASK-019` starts producing `confidence_level` values above `'low'`,
  well-corroborated toilets will start showing plain `OPEN`/`CLOSED`
  automatically — no change to this task's code, only to the data.
- Real OSM `opening_hours` strings from the live boundary have never been
  seen by any session (ingestion has not run against the live source; see
  PROGRESS.md). The parser's coverage is verified against constructed
  fixtures matching the documented OSM grammar, not observed real data.

## Not decided here

Whether the bounded grammar should later grow to cover `PH` or
date/season ranges is left for whenever real ingested data shows how often
those actually appear in Warsaw's OSM toilet tags.

# ADR 0006 — Nearby toilets API contract

Status: Accepted
Date: 2026-09-13
Scope: TASK-007 — Nearby toilet API

## Context

`ARCHITECTURE.md` section 7 sketches `POST /api/toilets/nearby` under the
heading "Request concept" / "Response concept" — illustrative, not a locked
contract — with rules that are binding regardless of the exact shape:
`null` means unknown where appropriate, the API never fabricates a boolean
from missing data, coordinates are validated and bounded, and maximum
radius/results are server-controlled.

Implementing it against the real schema from TASK-003 surfaced three places
where the sketch does not fit what the database actually stores, and one
question the architecture explicitly defers.

## Decisions

### Feature fields are the four-state enum, not a lossy boolean

The sketch shows `wheelchairAccessible: boolean | null`. The schema stores
`feature_state`: `yes` / `no` / `limited` / `unknown`. Forcing `limited` into
`true` would tell a wheelchair user a toilet is fully accessible when it is
only partly so; forcing it into `false` is simply wrong; forcing it into
`null` throws away a real, useful signal a source actually gave. The API
returns the string value unchanged. A consumer that only cares about a
strict yes can treat anything other than `'yes'` as not-yes; nothing forces
that collapse at the API boundary, which is where `PRODUCT.md` section 9's
"never silently collapse unknown into no" rule actually has to live.

### `openingStatus` is always `UNKNOWN`

`PRODUCT.md` section 10 defines `OPEN` / `CLOSED` / `LIKELY_OPEN` /
`LIKELY_CLOSED` / `UNKNOWN` and says never claim `OPEN` without evidence
trusted enough to evaluate current time against. No task before this one
computes that evidence: `opening_hours_raw` is stored, `opening_hours_
normalized` is not populated by anything yet. TASK-007 returns `UNKNOWN` for
every result rather than inventing a computation this task does not own.
TASK-013 replaces this.

### No `filters` field yet

The sketch's request includes `filters`. `TASK-016 — Core filters` owns
applying them, and does not exist yet. Accepting a `filters` field now and
silently ignoring its contents would be exactly the kind of quiet, misleading
API behaviour `AGENTS.md` warns against: a caller reading the accepted shape
would reasonably assume a submitted filter did something. The field is not
in the request schema until the task that makes it do something adds it.

### Walking time: a stated, conservative constant

`PRODUCT.md` section 12 requires the estimate be labelled approximate and
derived conservatively from distance, without fixing a formula. This task
picks 4.5 km/h (75 m/min), a deliberately unhurried walking pace, and rounds
the result up rather than down, so the app never promises a shorter walk
than it delivers. `lib/toilets/walking-time.ts` states this plainly; it is a
placeholder for real routing, not a claim about actual streets, crossings, or
elevation.

## Consequences

- `results[].wheelchairAccessible` (and the other feature fields) are
  `'yes' | 'no' | 'limited' | 'unknown'` strings, not booleans. Any future
  consumer, including TASK-008's markers, reads them as such.
- Extending the request with `filters` in TASK-016 is additive, not a
  breaking change to what exists now.
- `openingStatus` in every response until TASK-013 is `'UNKNOWN'`. This is
  correct, not a bug: nothing has yet earned the right to say otherwise.
- The walking-time constant is one named value in one file; recalibrating it
  later, or replacing it with real routing, touches only that file.

## Not decided here

Ranking (`TASK-009`), pagination beyond a server-side cap, and whether the
result cap or default radius need to change once real data volume is known.

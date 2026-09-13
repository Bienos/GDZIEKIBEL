# ADR 0016 — Report rate limiting

Status: Accepted
Date: 2026-09-13
Scope: TASK-021 — Report abuse protection

## Context

`ARCHITECTURE.md` section 16 lists "report endpoint spam" as an MVP threat
priority and "rate limiting for report writes" as a required control.
`TASK-020` deliberately did not implement it: `docs/adr/0015-toilet-reports.md`
treated adding unreviewed abuse-tracking fields as premature ahead of the
task that would actually specify them. `ARCHITECTURE.md` section 23 leaves
the real design question open: "whether report rate limiting needs an
external store/provider."

## Decisions

### Postgres holds the counter; no new external store

The deployment target is serverless (`ARCHITECTURE.md` section 22:
"Vercel serves web/API"). An in-memory counter inside the route handler
would not coordinate across function instances and would not survive a
cold start — it would look like a rate limiter without functioning as
one under real traffic. `ARCHITECTURE.md` section 21 names Redis "for
ordinary reads" a non-goal "without evidence"; no evidence exists yet
that Postgres cannot handle this load, and Postgres (Neon) is already
provisioned and already this project's one source of truth for
everything else it persists. This resolves section 23's open question:
no external store or provider for the MVP.

### A SHA-256 hash of the IP, never the raw address

`PLAN.md`'s outcome text is explicit: "without storing unnecessary
personal data." Rate limiting needs *some* way to recognise repeated
requests from the same client; the request's `x-forwarded-for` header
(set by Vercel's edge network, read directly — no `@vercel/functions`
dependency, which is a convenience wrapper around the same header, not a
different data source) is hashed with SHA-256 before it is ever written.
The hash is unsalted: a first pass, not a hardened one — see "Not decided
here". Only the hash and a request count are stored, keyed to a one-hour
window; nothing else about the request (user agent, path, the report's
own content) is recorded in this table.

### A fixed one-hour window, five writes

A fixed window (`date_trunc('hour', now())` as the window key) rather than
a sliding window or token bucket: simpler to implement correctly, and
`PLAN.md`'s "measured... controls" does not ask for precision at a
window's edges, only that spam is bounded. Five report writes per hashed
IP per window is a first, defensible pass, the same category of decision
as `docs/adr/0014-computed-confidence-level.md`'s `VERIFICATION_FRESHNESS_DAYS`
— not calibrated against real traffic, since none exists yet.

### Per-endpoint, not per-toilet

The limit counts every report write from one client, regardless of which
toilet id it targets. `ARCHITECTURE.md`'s own phrase is "report endpoint
spam" — a client flooding many different toilet ids with fabricated
reports is exactly the threat this control exists for, not a loophole
around a narrower per-toilet limit.

### Pruned on every write, not retained indefinitely

Before checking or incrementing a window's count, rows older than the
retention period (24 hours — long enough that a window is never pruned
while still relevant, short enough that no meaningful history
accumulates) are deleted. This keeps "unnecessary personal data" from
compounding into a growing log of hashed-IP activity; the table only ever
holds the current and immediately preceding window's worth of counters.

## Consequences

- `app/api/toilets/[id]/reports/route.ts` checks the rate limit before the
  existing toilet-existence check (`TASK-020`), so a client already over
  the limit never causes an extra existence query.
- A client under a shared IP (NAT, a corporate network, a school) shares
  its limit with everyone else behind that address. This is a known,
  accepted trade-off of IP-based limiting generally, not specific to this
  implementation; per-account limiting is not an option here since
  `PRODUCT.md` principle 6 requires no account for core use.
- If Postgres write volume from this table ever becomes a real concern,
  the same table design ports to an external store without changing the
  route handler's contract — only `db/queries/report-rate-limit.ts`'s
  implementation would change.

## Not decided here

Whether the hash should be salted with a per-deployment secret (closing
the small-address-space brute-force gap an unsalted SHA-256 hash leaves
open) is left for a real threat-model review — neither `PRODUCT.md` nor
`ARCHITECTURE.md` currently asks for it, and adding one now would need a
new required environment variable this task's scope does not call for.
Whether five writes per hour is the right number, and whether a fixed
window is precise enough once real traffic exists, are both first passes
left for real usage data.

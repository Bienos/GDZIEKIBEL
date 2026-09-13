# ADR 0015 — Toilet reports

Status: Accepted
Date: 2026-09-13
Scope: TASK-020 — Report incorrect toilet data

## Context

`PRODUCT.md` section 6.4 lets a user report a problem with a toilet
without an account, from seven fixed reasons; section 8 names `toilet_report`
a core entity; `ARCHITECTURE.md` section 5.3 sketches its schema and
section 6 names the endpoint (`POST /api/toilets/:id/reports`). Nothing of
this exists yet — `tasks/011-toilet-detail-sheet.md` explicitly deferred
the detail sheet's report control to this task, "no destination, no
button," the same reasoning `TASK-010` used for its own deferred CTA.

## Decisions

### `issue_type` is a real Postgres enum

`ARCHITECTURE.md`'s suggested schema writes `issue_type text not null`,
but every other categorical column in this schema — `access_type`,
`price_state`, `feature_state`, `canonical_status`, `confidence_level` —
is a real `ENUM`, and `docs/adr/0004-schema-conventions.md` already
recorded exactly this reasoning for `access_type`: free text lets an
uncaught typo silently create a value nothing else recognises, whereas an
enum makes an invalid value a rejected write, not a rejected read. `BRAND.md`'s
"Reporting" section gives the seven reasons in the same order `PRODUCT.md`
section 6.4 lists them; this task treats the two as one contract:

| Enum member            | `BRAND.md` reason (PL)          |
| ----------------------- | -------------------------------- |
| `closed`                | Jest zamknięty                   |
| `does_not_exist`        | Nie istnieje                     |
| `wrong_hours`           | Godziny są złe                   |
| `wrong_price`           | Cena jest inna                   |
| `access_denied`         | Nie wpuszczają bez zakupu         |
| `wrong_accessibility`   | Dostępność jest błędna           |
| `other`                 | Inny problem                     |

### `status` exists with a default; nothing reads or changes it yet

`ARCHITECTURE.md`'s suggested `status enum('new','reviewed','accepted',
'rejected')` is created with `DEFAULT 'new'`, the same shape of decision
`docs/adr/0004` already made for `confidence_level` in `TASK-003`
(created, defaulted, not yet acted on until a later task needs it —
`TASK-019` was that later task for `confidence_level`; no task through
`TASK-022` yet needs `toilet_reports.status` to do anything). `PRODUCT.md`
section 6.4's own rule — "a report must not immediately rewrite canonical
data without moderation or confidence logic" — means this task's job stops
at storing the report; building the moderation logic that would ever read
`status` is explicitly not asked for yet.

### Existence checked before insert, not left to a raw FK violation

`toilet_id` is `NOT NULL REFERENCES toilets(id)`, with no `ON DELETE`
clause: toilets are never actually deleted (`lib/ingest/upsert.ts`'s own
rule — a vanished source element is marked, not removed), so cascading or
nulling on delete is not a real scenario this schema needs to handle. The
route handler checks the toilet exists before attempting the insert and
returns a clean `404` for one that does not, rather than letting a
foreign-key violation surface as an undifferentiated `500` — the same
validate-before-querying discipline `parseNearbyRequest` already applies
to the nearby endpoint.

### Rate-limiting and abuse metadata are explicitly not this task's job

`PRODUCT.md` FR-08 bundles "validated and rate-limited" as one
requirement, but `PLAN.md` splits it across two tasks:
`TASK-020` ("validated report can be submitted") and `TASK-021` ("report
endpoint has measured rate/abuse controls"). `ARCHITECTURE.md` section
5.3's own note — "abuse/rate-limit metadata only if needed and
privacy-reviewed" — is a condition this task does not meet: adding
unreviewed abuse-tracking fields now, ahead of the task that actually
specifies what they should be and why, would be premature and would leave
a half-considered privacy surface sitting unused, the opposite of
`ARCHITECTURE.md`'s own caveat.

### No location, IP, or device identifier

`ARCHITECTURE.md` section 5.3: "Do not store precise user location with a
report." The request body carries only `issueType` and an optional
`note`; nothing about the request beyond those two fields is persisted.

## Consequences

- `db/queries/reports.ts` is a small, source-agnostic module — `toiletExists`
  and `insertReport` — the same separation `db/queries/nearby.ts` already
  established between plain data access and the route handler that shapes
  a response around it.
- A future moderation task can read and update `status` without a schema
  change; this task only establishes the column and its default.
- `TASK-021` can add its rate-limit/abuse columns or an external store
  without this task's code needing to change, since nothing here assumes
  an absence of such controls — it simply does not implement them.

## Not decided here

Whether `note`'s length cap (1000 characters, a first pass) is right, and
whether any additional issue-type reasons are needed, are both left for
real usage or a later product decision.

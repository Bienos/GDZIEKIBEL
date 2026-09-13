# TASK-020 — Report incorrect toilet data

## Goal

`PLAN.md`'s outcome: "anonymous validated report can be submitted."
`PRODUCT.md` section 6.4 (the report journey and its seven reasons),
section 8 (`toilet_report` as a core entity), section 13's FR-08 (no
account, inputs validated, no private-data exposure — rate-limiting is
explicitly `TASK-021`'s job, not this one). `ARCHITECTURE.md` section 5.3
(`toilet_reports` schema) and section 6 (`POST /api/toilets/:id/reports`).
`tasks/011-toilet-detail-sheet.md` deferred the detail sheet's report
control specifically to this task.

## Design decisions

### `issue_type` as a real Postgres enum, not `text`

`ARCHITECTURE.md` section 5.3 suggests `issue_type text not null`, but
every other categorical field in this schema (`access_type`,
`price_state`, `feature_state`, `canonical_status`, `confidence_level`) is
a real `ENUM`, not `text` — `docs/adr/0004-schema-conventions.md` already
recorded that pattern for `access_type` specifically ("`NULL` would be a
second way to say unknown"; the same reasoning applies here: free text
would let a typo silently create an eighth "issue type" no code
recognises). `BRAND.md`'s "Reporting" section gives seven reasons, in the
same order `PRODUCT.md` section 6.4 lists them; both are one contract, not
two independent lists that happen to agree.

### `status` exists, defaults to `'new'`, and nothing reads it yet

Same shape of decision `docs/adr/0004` already made for `confidence_level`
in `TASK-003`: `ARCHITECTURE.md`'s suggested schema for `toilet_reports`
includes `status enum('new','reviewed','accepted','rejected')`. This task
creates that column with its default, because a report needs to start
somewhere, but builds no moderation UI or workflow to change it — nothing
in `PLAN.md` through `TASK-022` asks for one. A report is accepted and
stored; PRODUCT.md's rule that "a report must not immediately rewrite
canonical data without moderation or confidence logic" means storing it is
this task's entire job, not resolving it.

### Existence checked before insert, not left to a raw FK error

`toilet_id` references `toilets(id)`. Rather than let a foreign-key
violation surface as a raw 500, the route checks the toilet exists first
and returns a clean 404 for one that does not — the same shape of
deliberate validation this project's other routes already do (`parseNearbyRequest`
validates before any query runs).

### No rate-limiting, no abuse metadata

`PRODUCT.md` FR-08 bundles "validated and rate-limited" together, but
`PLAN.md` splits them: this task is "validated report can be submitted",
`TASK-021` is "report endpoint has measured rate/abuse controls".
`ARCHITECTURE.md` section 5.3's own "abuse/rate-limit metadata only if
needed and privacy-reviewed" is deliberately not added here — adding it
now, unreviewed, ahead of the task that actually specifies what it should
be, would be exactly the premature complexity `AGENTS.md` warns against.

### No location stored with a report

`ARCHITECTURE.md` section 5.3: "Do not store precise user location with a
report." The report body carries only `issueType` and an optional `note`;
neither the client's geolocation nor any IP/request metadata is written.

## User-visible outcome

The detail sheet gains a `ZGŁOŚ PROBLEM` control (DESIGN.md 9.4, position
8, after the confidence hint). Tapping it opens a sheet with the seven
`BRAND.md` reasons as radio options, an optional free-text note, and a
`WYŚLIJ ZGŁOSZENIE` submit button. Success shows `DZIĘKI. SPRAWDZIMY.`;
failure shows a literal explanation and a retry action, the same shape of
failure state the map fallback and location-denied screens already use.

## Acceptance criteria

- `POST /api/toilets/:id/reports` validates `id` as a real, existing
  toilet (400 for a malformed id, 404 for one that does not exist) and the
  body's `issueType`/`note` (400 for an invalid `issueType`, an
  over-length `note`, or unknown fields).
- A valid report is inserted into `toilet_reports` with `status = 'new'`,
  no location, no account.
- The detail sheet's report control opens the sheet; a successful
  submission shows the success copy; a failed one shows a literal
  explanation and lets the user retry without losing what they entered.
- Verified against a real PostGIS database: a real insert, a real
  toilet-not-found 404, a real invalid-`issueType` 400.

## In scope

- A migration creating `toilet_reports` (`toilet_report_issue_type`,
  `toilet_report_status` enums; the table itself).
- `lib/reports/types.ts`, `lib/reports/report-request.ts`.
- `db/queries/reports.ts` (`toiletExists`, `insertReport`).
- `app/api/toilets/[id]/reports/route.ts`.
- `components/map/ReportSheet.tsx`; a report control wired into
  `ToiletDetailSheet.tsx`.
- New `Dictionary` keys for the control, the sheet, the seven reasons, the
  note field, submit, success, and failure/retry.
- `docs/adr/0015-toilet-reports.md`.
- `docs/CODEMAP.md` and `PROGRESS.md` updates.

## Out of scope

Do **not**:

- add rate-limiting, abuse metadata, or any per-client throttling
  (`TASK-021`'s job);
- build a moderation UI, or ever change a report's `status` after insert;
- let a report rewrite any canonical `toilets` column;
- store precise user location, an IP address, or any device identifier
  with a report;
- add the "hours" line to the detail sheet (`TASK-011`'s own, separate,
  still-open gap — unrelated to reports).

## Canonical context to read

- `AGENTS.md`
- `PROGRESS.md`
- `PRODUCT.md` sections 6.4, 8, and 13 (FR-08)
- `ARCHITECTURE.md` sections 5.3, 6 (`POST /api/toilets/:id/reports`), and 8
- `BRAND.md` "Reporting" section
- `DESIGN.md` section 9.4 (information order, position 8)
- `docs/adr/0004-schema-conventions.md`

## Likely relevant code

- `components/map/ToiletDetailSheet.tsx`
- `app/api/toilets/nearby/route.ts` (the validation/response-shaping
  pattern to mirror)
- `lib/toilets/nearby-request.ts` (the Zod-validation pattern to mirror)

## Constraints

- No new dependency.
- Follows the existing `.scrim`/`.sheet`/`.sheetHeadline`/`.sheetPrimary`/
  `.sheetSecondary`/`.detailClose` visual language; no new modal pattern.

## Verification

Run and record:

- `pnpm lint`, `pnpm format:check`, `pnpm typecheck`
- `pnpm test:unit`
- `pnpm db:migrate`, `pnpm test:integration` (a real insert, a real 404, a
  real 400)
- `pnpm build`
- `pnpm test:e2e` (the report flow's success and failure states)
- inspect the complete git diff

## Definition of done

TASK-020 is complete only when:

- a real, validated report can be submitted end to end and is provably
  stored, verified against a real database;
- an unknown toilet id and an invalid `issueType` both fail cleanly with
  the right status code;
- no location, IP, or device identifier is ever stored with a report;
- `docs/CODEMAP.md` and `PROGRESS.md` reflect the repository;
- the complete diff contains no unrelated changes.

Then stop. Do not begin TASK-021.

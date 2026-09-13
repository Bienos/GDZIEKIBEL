# Project status

## Current baseline

- Product direction: defined in `PRODUCT.md`.
- Brand direction: defined in `BRAND.md`.
- Design direction: defined in `DESIGN.md`.
- Architecture proposal: defined in `ARCHITECTURE.md`.
- Ordered roadmap: defined in `PLAN.md`.
- Approved visual reference: `docs/design/reference/gdziekibel-approved-direction.png`.
- Production application code: foundation only (TASK-001). Next.js App Router
  application with a minimal shell page. No product feature is implemented.
- Database migrations: two. `1789277236377_enable-postgis.sql` enables the
  extension; `1789312508934_toilet-schema.sql` creates `toilets`,
  `toilet_source_records`, `ingestion_runs` and their enumerated types. The
  tables hold no rows.
- Deployment: not deployed. Vercel-compatible configuration exists
  (`vercel.json`) and the preview path is documented in `README.md`.

## Completed planning artefacts

- PRODUCT.md
- BRAND.md
- DESIGN.md
- ARCHITECTURE.md
- PLAN.md
- AGENTS.md
- CLAUDE.md
- docs/CODEMAP.md
- tasks/001-project-foundation.md

## Completed tasks

### TASK-001 — Project foundation

Created: Next.js 16 App Router app with TypeScript strict mode, central CSS
design tokens, a Zod-validated server environment module, a `pg` connection
pool with a PostGIS health check, `node-pg-migrate` SQL migrations, Vitest unit
and integration projects, a Playwright smoke test, a GitHub Actions CI workflow
and Vercel build configuration. `docs/adr/0001-foundation-stack.md` records the
tooling decisions.

### TASK-002 — Data-source research and source decision

Decision made and recorded; observation gaps remain and are listed below. Desk
research was supplied by the project owner on 2026-09-13 and
is committed verbatim at `docs/research/2026-09-13-warsaw-toilet-sources.md`.
The task specification exists at `tasks/002-data-source-research.md`.

The research states in its own limitations section that the Warsaw open-data
toilet dataset endpoint, schema and licence were not verified against the live
service. That verification is the remaining work and has not been done.

A probe that performs the observable part of it exists at
`scripts/research/probe-sources.ts`, run with `pnpm research:probe`. Observed on
2026-09-13: every request it makes is refused from this environment with HTTP
403 at the egress proxy, and the script reports that as a blocker and exits
non-zero rather than producing a result. Its success path has therefore never
run.

Reviewed and extended later the same day. The probe originally read only the
dataset catalogue, which cannot reveal a field list, a record count or an
example record, all three of which the task requires as observed values. It now
samples each catalogue resource that carries a datastore id with one
`datastore_search` call at `limit=1`, capped at ten per run, and writes the
observed fields, total and first record into the report. Catalogue and datastore
calls time out after 30 seconds instead of three minutes; Overpass keeps three
minutes to match its own query timeout. The User-Agent now carries the
repository URL as the contact point Overpass policy expects. Its parsers are
covered by fourteen unit tests against recorded response shapes, which assert
that a missing licence reads as null, that a missing total reads as null rather
than zero, and that a malformed payload yields nothing.

Dry run observed on 2026-09-13 with `RESEARCH_OUTPUT_DIR` pointed outside the
repository: 18 requests, every one answered HTTP 403 by the egress proxy, raw
bodies saved, report written with the schema section marked UNVERIFIED, exit
code 1. That is the failure path behaving as designed, not a result.

First run from an environment that permits the hosts, reported by the project
owner on 2026-09-13:

- Overpass answered HTTP 200 for the `amenity=toilets` count, and HTTP 504 for
  the venue `toilets=*` count.
- All 16 Warsaw catalogue requests answered HTTP 503. Both hosts, both CKAN
  paths, all four search terms. A 503 is a response from Warsaw's own servers,
  unlike the proxy's 403, so the network allowlist works and the catalogue
  itself did not serve the request.
- No dataset, field list, record count, example record or licence has therefore
  been observed. Every one of them remains UNVERIFIED.

What the 503 means is not yet known. It could be the service being down, the
CKAN assumption in the probe being wrong for the current platform, or a gateway
refusing the request. The probe now records the content type and the first 240
characters of every failed body, so the next run distinguishes these instead of
reporting a bare status code. The Overpass 504 is ordinary overload, and each
Overpass query is now retried once after a pause.

The run also exposed a reporting defect the owner spotted: the script exited 0
because a single request succeeded, although the catalogue question it exists to
answer was untouched. It now exits 2 in that case, and 1 only when everything
fails.

**Decision, project owner, 2026-09-13: the city dataset is deferred.** Rather
than block the roadmap on a service returning 503 to every request,
OpenStreetMap becomes the first ingestion source and the city dataset is
revisited in a later task. `tasks/002-data-source-research.md` was rewritten
around that decision. The deferral is recorded as a deferral, not as an
evaluation: nothing about the city dataset has been observed, and its
identifier, schema, cadence and licence all remain unverified.

What this costs, from the research: the city's private-venue agreements,
official opening hours for municipal toilets, and the metro rule as an official
record. The schema in TASK-003 keeps source records separate from the canonical
toilet, so adding the city later is additive rather than a rebuild.

**Deliverables written on 2026-09-13**, from a session whose egress denies
every OpenStreetMap and Warsaw host, so nothing in them was observed live from
that session:

- `docs/contracts/osm-toilets-source.md`: acquisition, area, element shape,
  identity, change detection, field mapping with unknown semantics, validation
  rules, and what the source does not provide. Every statement is marked
  OBSERVED, DECIDED or UNVERIFIED.
- `docs/adr/0003-first-data-source.md`: OpenStreetMap first, weekly bounded
  Overpass pull with an extract fallback, Warsaw administrative boundary as the
  area, a hand-curated anchor layer for metro and stations, the city dataset
  deferred with its evidence, a field-level source table, and the consequences
  for the TASK-003 schema.

**Still unverified, and what closes each:**

| Item | Closes when |
| --- | --- |
| `amenity=toilets` count in the probe bbox | `pnpm research:probe -- --full` from the GdzieKibel environment; paste the value and query into ADR 0003 section 6 |
| `toilets=*` venue count | same run |
| Tag coverage for opening hours, fee, access, wheelchair, changing table, operator, name, level | same run |
| ODbL name, version and attribution wording, quoted and dated | a live read of the Legal FAQ and the OSMF attribution guidelines |
| Share-alike design choice | legal review; the schema keeps both designs open meanwhile |
| Warsaw administrative boundary relation id | TASK-004 |

The one run that returned HTTP 200 from Overpass on 2026-09-13 produced a
count, but the value was not carried into the repository. It is not recorded
here because it was not seen here.

### TASK-003 — Canonical toilet schema + first source contract

Complete on 2026-09-13. Specified in `tasks/003-canonical-toilet-schema.md`.

Created: one reversible SQL migration with six enumerated types, the three
tables from `ARCHITECTURE.md` section 5 minus `toilet_reports` (TASK-020),
GiST indexes on both geography columns, and trigger-maintained `updated_at`.
Every inferable attribute is an enum with an explicit `unknown` member as its
default; no boolean defaults to `false`. TypeScript mirrors the enums in
`lib/toilets/types.ts`, and a test reads the migration to keep them in step.
The adapter contract is `lib/toilets/normalized-source-record.ts`, a strict
Zod schema that requires every field so an adapter must state `unknown` on
purpose. `docs/adr/0004-schema-conventions.md` records each departure from the
architecture with its reason.

Observed:

- the migration applies to an empty PostGIS database and `pnpm db:check`
  passes afterwards;
- `pnpm db:migrate:down` drops exactly the objects the up step created, leaves
  PostGIS installed, and `pnpm db:migrate` recreates them; integration tests
  pass again after the round trip;
- ten integration tests prove the unknown defaults, enum rejection, the
  `ST_DWithin` radius query, the GiST index, the unique constraint on source
  records, the `updated_at` trigger, unlink-not-delete on toilet removal, and
  the ingestion run time check.

Not created, by design: any row, any adapter, any query module, any report
table.

### TASK-004 — Ingest first Warsaw toilet dataset (OpenStreetMap)

Code complete on 2026-09-13; **not run against the live source**. Specified in
`tasks/004-ingest-osm-toilets.md`.

Created: `lib/ingest/osm/` (fetch, validate, normalize), the source-agnostic
`lib/ingest/upsert.ts`, and the command `pnpm ingest:osm`. The Warsaw
administrative boundary is resolved at run time by tags and printed; the command
aborts rather than guess when the answer is not a single admin_level 6 relation.
OSM account fields are stripped before a response is saved or stored. The whole
upsert is one transaction.

Observed on 2026-09-13, replaying `tests/fixtures/osm/elements.json` against a
freshly migrated database:

| Run | Fetched | Created | Unchanged | Rejected |
| --- | --- | --- | --- | --- |
| first | 4 | 4 | 0 | 2 |
| second | 4 | 0 | 4 | 2 |

The two rejections are the fixture's deliberate bad cases: an element with no
position and one outside the coarse Warsaw box. Both were reported by key and
reason, never by dumping the element.

The stored rows show the unknown rule holding: a node carrying only
`amenity=toilets` reads back with access, price, wheelchair and changing table
all `unknown`, while a node with `access=customers` reads `customers_only` and
`wheelchair=no`. Absence and negation stayed distinct through the whole
pipeline.

**Still to do before TASK-004 can be called complete:** one live run from the
GdzieKibel cloud environment, recording the boundary relation it resolved and
its counts. This session's egress denies `overpass-api.de`.

Not created, by design: any deduplication, opening-hours parsing, confidence
scoring, scheduled workflow, query module or UI.

### TASK-005 — Render Warsaw map shell

Complete on 2026-09-13, with live tile rendering unverified from this session.
Specified in `tasks/005-render-map-shell.md`. Tile provider decision in
`docs/adr/0005-map-tile-provider.md`.

Created: `components/map/MapShell.tsx`, a vanilla `maplibre-gl` client
component (no React wrapper library), centred on Warsaw and bounded to the
same coarse box `lib/geo/warsaw.ts` already defines for ingestion. The tile
provider is MapTiler, chosen as swappable per `ARCHITECTURE.md` section 23,
configured through one variable, `NEXT_PUBLIC_MAPTILER_KEY`, built into a
style URL by the single-purpose `lib/map/tile-provider.ts`.

The TASK-001 placeholder copy stating the map does not work was removed; it
is no longer true, and no new hero copy was added in its place, since that is
`DESIGN.md` section 9.1's job and out of this task's scope.

**Fallback state, and why it matters beyond this sandboxed environment.** No
key is committed anywhere, so the map must render correctly with the
variable absent: the component never imports or initialises `maplibre-gl` in
that case, and shows `BRAND.md`'s "API/network error" copy instead, in both
locales. This is also the state a real deployment shows before a key is
configured, or if one is later revoked. Verified by the real Playwright suite
running against a production build (`pnpm build && pnpm start`) with no key
set: both tests pass, asserting the exact fallback text and retry button in
each language.

**A load failure after a key is configured** — network blocked, invalid key,
provider down — is also handled: the map only falls back if it errors before
its first successful `load`, so one bad tile after a working session does not
nuke the whole shell. This was verified manually against a production build
with a syntactically valid but unreachable key: MapLibre initialised, created
a canvas, received no response from `api.maptiler.com` (this session's egress
denies it), and transitioned to the same fallback state. Not part of the
committed automated suite, because it would require committing a real key or
faking a provider response; recorded here as an observed fact instead.

**A debugging note worth keeping.** Diagnosing the load-failure path first
by hand against `next dev` produced no observable client-side execution at
all, with no console output and no error. Retesting the identical component
against `next build && next start` (the runtime the E2E suite actually uses)
worked immediately. Whatever caused that was specific to Turbopack's dev
server in this sandboxed environment and did not reproduce against the real
runtime, so it is not treated as a product defect.

**Still unverified:** real tiles have never been painted from this session.
No environment available here holds a working key, and this session's egress
denies `api.maptiler.com`. Closing this needs a session in the GdzieKibel
cloud environment with `NEXT_PUBLIC_MAPTILER_KEY` set to a real, domain-
restricted key, running `pnpm dev` or `pnpm build && pnpm start` and looking
at the page.

### TASK-006 — Request and display user location

Complete on 2026-09-13. Specified in `tasks/006-request-user-location.md`.

Created: `lib/geolocation/request-location.ts`, wrapping
`navigator.geolocation.getCurrentPosition` in one promise classified into
`granted` / `denied` / `unavailable` / `timeout` / `error`, resolving
`unavailable` immediately when the API does not exist rather than throwing.
`MapShell` gained the permission-ask and one shared denied/unavailable/
timeout screen, both from `BRAND.md`'s exact copy, plus a location-blue dot
marker (`--color-location-blue`, deliberately outside the brand palette).

**A design correction made during this task, recorded because it changes
the acceptance criteria as originally written.** The task file first gated
the permission ask on the map's own tiles having loaded. Re-reading
`PRODUCT.md`'s primary journey ("immediately explains its purpose and asks
for location access") and `DESIGN.md`'s screen order (permission before the
main map, not after) showed that gate was an unwarranted assumption, not a
requirement. The ask now appears on mount regardless of tile state; granting
location while tiles are in their fallback state is a handled case with
simply nowhere yet to place a dot. `tasks/006-request-user-location.md` was
updated to match before this was implemented, not after.

That correction had a second, valuable effect: it made the whole flow
testable in an environment with no working tile provider key. The Playwright
suite now covers all three outcomes: skipping the ask, a hand-mocked denial
(deterministic, not dependent on browser permission-automation defaults),
and — genuinely, not mocked — a real browser grant via Playwright's own
`permissions`/`geolocation` fixtures, which drives the actual
`navigator.geolocation.getCurrentPosition` call this app makes.

Verified: lint, format, typecheck, 87 unit tests (7 new, covering every
branch of the result classification including the no-API case and the exact
`PositionOptions` requested), 19 integration tests, the production build,
and 5 Playwright tests.

Not created, by design: persistence of the user's choice across visits (no
canonical source asks for it), an accuracy halo, a way to re-open the ask
after dismissal, and anything that sends coordinates anywhere — there is no
server call in this task at all.

**Still unverified:** everything already listed under TASK-005 (live tiles).
Additionally, the granted path has only been observed with the map itself in
its fallback state, since this session has no working tile key; placing a
real marker on a real map has not been visually confirmed.

### TASK-007 — Nearby toilet API

Complete on 2026-09-13. Specified in `tasks/007-nearby-toilet-api.md`,
contract decisions in `docs/adr/0006-nearby-api-contract.md`.

Created: `POST /api/toilets/nearby`, validated by
`lib/toilets/nearby-request.ts`, queried by `db/queries/nearby.ts`
(`ST_DWithin` bound, `ST_Distance` reported, `canonical_status = 'active'`
only, distance-ascending order, capped at 30 results server-side regardless
of request), shaped for response by `lib/toilets/nearby-response.ts`.

Three real deviations from `ARCHITECTURE.md` section 7's illustrative JSON,
each recorded in ADR 0006 rather than silently implemented: feature fields
(`wheelchair`, `changingTable`, `unisex`) are returned as the schema's own
`'yes' | 'no' | 'limited' | 'unknown'` strings, not booleans, since forcing
`limited` into `true` would overclaim accessibility and forcing it to `null`
would throw away a real signal; `openingStatus` is always the literal
`"UNKNOWN"`, because nothing before `TASK-013` computes anything else and
`PRODUCT.md` section 10 forbids claiming otherwise; the request does not
accept a `filters` field at all yet, because `TASK-016` is what would make
one do anything, and accepting-then-ignoring one would mislead a caller.
`approxWalkingMinutes` comes from one named, documented conservative
constant (`lib/toilets/walking-time.ts`), 75 m/min, rounded up.

**Verified against a running server with real HTTP requests, not only unit
calls:** a `curl` smoke test against `pnpm build && pnpm start` confirmed, in
order: an empty-database request returns `{"results": []}`; an out-of-range
latitude returns `400` naming only the field, never the submitted value; a
request carrying `filters` is rejected outright rather than silently
accepted; malformed JSON returns a clean `400`; and, after inserting one real
row, a positive result carries the exact contract shape end to end,
including `"openingStatus": "UNKNOWN"` and `"wheelchair": "limited"` passed
through unchanged.

A stale row from an earlier manual TASK-004 ingestion run (`"Toaleta Plac
Defilad"`) was still sitting in the dev database and caused four integration
tests to fail against the wrong baseline. The dev database was reset, and
the tests were also rewritten to filter to their own inserted rows rather
than assume the table holds nothing else — this is the second time
leftover state in the shared dev database has caused a test failure that
was not a code defect, so the fix is now structural, not just a cleanup.

Verified: lint, format, typecheck, 103 unit tests (13 new: walking-time,
response shaping, request validation), 25 integration tests (6 new,
including the cap, the active-only filter, and the enum pass-through), the
production build, and the 5 existing Playwright tests unaffected.

Not created, by design: filters, ranking beyond plain distance order, `GET
/api/toilets/:id`, the reports endpoint, rate limiting, and any caller of
this endpoint from a page.

### TASK-008 — Display nearby toilets on map

Complete on 2026-09-13. Specified in `tasks/008-display-nearby-toilets.md`.

Created: a nearby-toilets fetch on mount, centred on the default Warsaw view
(`lib/toilets/fetch-nearby.ts`, `lib/map/warsaw-view.ts`'s new plain-number
exports), refetching centred on the user's real position once granted.
`lib/toilets/marker-diff.ts` reconciles the fetched list against the
markers already on the map, adding and removing only what changed.
`lib/toilets/marker-element.ts` builds each marker as a plain "WC" badge,
the one visual variant `DESIGN.md` section 8 describes that current data
can actually produce (the API always returns `openingStatus: "UNKNOWN"` and
only `active` toilets, so "recommended" and "known closed" have no way to
occur yet). A clicked marker becomes visually selected via scale and a
stronger outline, and any previously selected marker returns to normal.

**Why the fetch does not wait on tiles, again.** As with `TASK-006`'s
location ask, the fetch trigger is decoupled from the map's own load state.
`PRODUCT.md` section 6.1 requires the manual-browse (denied/skipped) journey
to be useful, and a map showing no toilets at all until location is granted
would be a weak version of that. The mount-time fetch, centred on Warsaw,
runs regardless; rendering its results as markers is a separate effect that
is a correct no-op until a real map instance exists.

**Verified without live tiles, the same way TASK-006 was.** This session has
no working tile-provider key, so the map canvas never mounts here and
markers can never be visually observed. What was verified instead: 114 unit
tests including 4 new files (fetch helper, marker diff, marker label, plus
existing coverage), and — the strongest evidence available in this
environment — Playwright tests that intercept the real
`POST /api/toilets/nearby` call the running app makes and assert on its
body: one proving the mount-time fetch fires centred on Warsaw even when
the user skips the location ask, and one proving a real browser location
grant (via Playwright's own permission fixtures, not a mock) triggers a
second, distinctly-centred request. A `curl` smoke test against a running
production build, with one real row inserted, confirmed the API itself
returns the exact shape the marker code consumes.

Verified: lint, format, typecheck, 114 unit tests, 25 integration tests
(unchanged; this task added no new database code beyond what TASK-007
already covers), the production build, and 7 Playwright tests (2 new).

Not created, by design: the detail sheet, the accessible list view
(`TASK-015`'s own vertical slice), ranking beyond the API's existing
distance order, marker clustering, and re-fetching on pan or zoom.

**Still unverified, unchanged from TASK-005/006:** live tiles, the location
dot, and now the toilet markers have never been observed rendering for
real. Closing this needs a session with a working
`NEXT_PUBLIC_MAPTILER_KEY` and egress to `api.maptiler.com`.

### TASK-009 — Recommendation ranking

Complete on 2026-09-13. Specified in `tasks/009-recommendation-ranking.md`;
decision recorded in `docs/adr/0007-recommendation-ranking-formula.md`.

Created: `lib/toilets/rank-nearby.ts`, a pure function reordering nearby
results by `distanceMeters + ACCESS_CONFIDENCE_PENALTY_METERS[accessType]`,
ascending, ties broken on real distance. `app/api/toilets/nearby/route.ts`
applies it to `findNearbyToilets`'s rows before mapping them to the response
shape; `db/queries/nearby.ts` itself is unchanged and still returns plain
distance order, exactly as its own docstring and tests already said ranking
would be layered on top of, not inside it.

**Which of `PRODUCT.md` section 11's six criteria this actually acts on.**
Only two are real, differentiating signals in the data as it exists today:
distance, and `access_type` (public-access confidence). The other four are
named explicitly, in both the task file and the ADR, as currently inert
rather than silently dropped: "known closed" is already fully excluded
upstream by `canonical_status = 'active'`; `confidence_level` defaults to
`'low'` and nothing sets it to anything else yet (`TASK-019`); no `filters`
field exists in the request (`TASK-016`); no price-preference input exists
anywhere. Ranking on a constant or a nonexistent field would have been dead
code pretending to do something.

**Verified against real infrastructure, not just unit mocks.** Beyond 9 new
unit tests (including a literal regression test for section 11's own
example — a farther `public_unconditional` toilet outranking a closer
`unknown`-access one — and a test that the penalty table names every
`AccessType` member, typed so a missed one is a compile error, not a silent
default), this session had a working local PostgreSQL/PostGIS and used it:
two real rows were inserted (`ranktest-closer-uncertain` at 300 m with
`access_type = 'unknown'`, `ranktest-farther-confident` at 401 m with
`access_type = 'public_unconditional'`), a real production build was run
with `pnpm start`, and a `curl` request to the real running
`POST /api/toilets/nearby` endpoint returned `ranktest-farther-confident`
before `ranktest-closer-uncertain` — the exact reordering the formula
predicts, observed end to end through the real route, the real ranking
function, and a real database, not asserted only against a mock. Both
fixture rows were deleted afterward and the deletion was independently
confirmed by a follow-up `SELECT count(*)`.

Verified: lint, format, typecheck, 123 unit tests (9 new), 25 integration
tests (unchanged — this task added no query or schema changes), the
production build, a live curl verification against a real database as
described above, and the existing 7 Playwright tests (unchanged; no
user-visible interaction changed, only response order, which the E2E suite
does not assert on).

Not created, by design: any change to `db/queries/nearby.ts`'s SQL, a
`filters` field, a real `confidence_level` computation, an exposed score in
the API response, or a "recommended" marker visual variant — nothing
downstream of the API yet reads or displays the new order.

### TASK-010 — Nearest toilet preview

Complete on 2026-09-13. Specified in `tasks/010-nearest-toilet-preview.md`.

Created: `components/map/NearestToiletPreview.tsx`, a collapsed bottom card
(`DESIGN.md` 9.3) showing the top-ranked toilet's name, a distance/ETA line
(`lib/toilets/preview-copy.ts`'s `distanceLine`, e.g. `240 M · ~4 MIN
PIESZO`), an opening-status badge, and a price badge. It reads `toilets[0]`
directly — the API's own ranked order from `TASK-009` — independent of
marker `selectedId`, matching `PRODUCT.md` section 5 step 5's "the app
highlights the best nearby option" happening as soon as results load, not
only once a marker is tapped. It renders once the location step resolves
(granted or skipped), on top of either the real map or the tile fallback,
since the underlying data does not depend on tiles.

**Why there is still no CTA.** `DESIGN.md`'s collapsed state includes one,
but neither of its two possible destinations — the detail sheet (`TASK-
011`) or real external navigation (`TASK-012`) — exists yet. A button
promising either without delivering it would be a dead-ended affordance;
recorded as a deliberate, temporary gap in the task file, the same pattern
already used for `TASK-008`'s unreachable marker variants.

**Only one opening-status value is reachable, and that is not a bug.**
`openingStatusLabel` is a `switch` over `NearbyToiletResult['openingStatus']`,
which is currently the literal type `'UNKNOWN'` (ADR 0006); it has exactly
one case, structured so `TASK-013` adding real states is additive. Price,
by contrast, already varies in real ingested data (the OSM `fee` tag), so
`priceLabel` exercises all three real values (`free`/`paid`/`unknown`).

Verified: lint, format, typecheck, 127 unit tests (4 new, for the copy
functions), 25 integration tests (unchanged), the production build, and 8
Playwright tests (1 new) — asserting the preview is absent while the
location ask still covers the screen, then visible with the exact
intercepted name/distance/status/price after the user resolves that step,
using a real request interception rather than a mock of the component
itself.

Not created, by design: a CTA button, the "recommended" marker visual
variant (now reachable given `TASK-009`'s ranking, but a map-marker concern
belonging with `TASK-008`'s code, not this preview card, and not asked for
by `PLAN.md`'s TASK-010 outcome), the detail sheet, or real navigation.

### TASK-011 — Toilet detail sheet

Complete on 2026-09-13. Specified in `tasks/011-toilet-detail-sheet.md`.

Created: `components/map/ToiletDetailSheet.tsx`, opened by tapping either
the nearest-toilet preview (now a `<button>`, resolving `TASK-010`'s
deferred CTA question) or a marker (`TASK-008`'s existing `selectedId`
state) — both entry points share the same state, so `FR-04`'s "selected
marker and selected detail card remain synchronised" holds without a new
mechanism. Shows name, distance/ETA and status/price (reusing `TASK-010`'s
own `preview-copy.ts`), plus two additions from `lib/toilets/detail-copy.ts`:
accessibility features (wheelchair/changing table/unisex, all four
`FeatureState` values distinct) and a data-confidence hint.

**Two of `DESIGN.md` section 9.4's eight information-order items are still
missing, deliberately.** The primary CTA (`PROWADŹ MNIE`) has no real
destination until `TASK-012` wires up navigation; the report control has
none until `TASK-020` builds that flow. Both would be exactly the
dead-ended affordance `TASK-010` already avoided for its own CTA — the same
reasoning, applied consistently, rather than re-litigated per task. Hours
are also not shown: the nearby API does not return them at all yet
(`docs/adr/0006-nearby-api-contract.md`), and extending that contract is
not this task's job.

**The confidence hint reports the real, currently-constant value.** Every
toilet in the pipeline today carries `confidence_level = 'low'` (nothing
sets it higher yet — `TASK-019`'s job); the sheet says exactly that
(`PEWNOŚĆ DANYCH: NISKA` / `DATA CONFIDENCE: LOW`) rather than a fabricated
higher confidence.

Verified: lint, format, typecheck, 131 unit tests (4 new, for the feature/
confidence copy functions), 25 integration tests (unchanged), the
production build, and 9 Playwright tests (1 new) — tapping the preview,
asserting the sheet's real intercepted name/distance/status/price/features/
confidence, confirming focus moves to the heading, closing it, and
confirming the preview reappears.

Not created, by design: the primary navigation CTA, hours display, the
report control, any change to the nearby-API response shape, and swipe/drag
sheet gestures (`DESIGN.md` section 10 recommends a graduated collapsed/
half-height/expanded interaction; this ships one collapsed state and one
open state, not a drag mechanism).

**Marker-click selection remains untested here, unchanged from TASK-008.**
This environment cannot render live tiles or real markers, so only the
preview-tap entry point to the detail sheet is covered by Playwright; the
marker-click entry point uses the identical `selectedId` state and is
correct by inspection, same as the existing, already-documented gap.

### TASK-012 — External walking navigation

Complete on 2026-09-13. Specified in
`tasks/012-external-walking-navigation.md`; decision recorded in
`docs/adr/0008-external-navigation-url.md`. **Completes Milestone 1**:
per `PLAN.md`, "the first core journey should work end to end."

Created: `lib/external-navigation/build-navigation-url.ts`, a pure function
taking only a toilet's `{ lat, lng }` and returning a Google Maps
walking-directions URL (`api=1&destination=<lat>,<lng>&travelmode=walking`).
The toilet detail sheet (`TASK-011`) now renders this as a real `<a>`
(`target="_blank"`, `rel="noopener noreferrer"`) labelled `PROWADŹ MNIE`,
with the supporting punchline `ZANIM BĘDZIE ZA PÓŹNO.`
(`DESIGN.md` 9.4's own example), sitting between the status/price badges
and the accessibility features per that section's information order.

**Destination-only, by construction, not just by convention.**
`ARCHITECTURE.md` section 12 forbids embedding the user's own coordinates
into shareable URLs unnecessarily. The function's signature has no
parameter for an origin or the user's granted location at all — there is
no code path through which it could leak in, not merely a rule this task
chose to follow.

**Apple Maps is not built.** `ARCHITECTURE.md` allows it "when tested";
this session cannot test real app-opening behaviour on a device, the same
category of limitation already documented for the MapTiler tile provider.
The Google Maps web link works in every browser, including Safari on iOS,
without platform-detection code.

**What is, and is not, verified.** A direct `curl` to the generated URL
from this session returns the egress proxy's `403` — the same restriction
already hit for MapTiler, Overpass, and the Warsaw open-data hosts — so
whether the link actually reaches a working Google Maps walking route was
not observed. What was verified: the URL-building function by unit test
(exact string match, `travelmode=walking`, no `origin` parameter present
regardless of input), and the real rendered `href`/`target`/`rel` on the
CTA in a running production build via Playwright, using intercepted API
coordinates.

Verified: lint, format, typecheck, 134 unit tests (3 new), 25 integration
tests (unchanged), the production build, and 9 Playwright tests (extending
the existing detail-sheet test with the CTA's `href`/`target`/`rel` and
punchline assertions, not a new test file).

Not created, by design: Apple Maps or any other provider, server-side URL
generation (nothing a round-trip would add, since coordinates are already
client-side), and any change to the report control, hours, ranking, or the
preview.

### TASK-013 — Opening-hours normalisation/status

Complete on 2026-09-13. Specified in `tasks/013-opening-hours-status.md`;
decision recorded in `docs/adr/0009-opening-hours-status.md`. First task of
Milestone 2 ("Real utility").

Created: `lib/opening-hours/parse-opening-hours.ts` parses a bounded subset
of the OSM `opening_hours` micro-syntax (`24/7`; `;`-separated weekly rules
of `<days> <time-ranges>` or `<days> off`; comma/range day lists; comma-
separated `HH:MM-HH:MM` time ranges, including one crossing midnight) —
anything outside this (public holidays, date/season ranges, a rule with no
day part) fails the whole string, never a partial reading.
`lib/opening-hours/compute-status.ts` evaluates that structure against a
Warsaw-local moment (`lib/opening-hours/warsaw-time.ts`, built on
`Intl.DateTimeFormat`, no date-library dependency) to produce
`OPEN`/`CLOSED`/`LIKELY_OPEN`/`LIKELY_CLOSED`/`UNKNOWN`.

**The confidence-qualification rule.** A real day/time match is reported as
plain `OPEN`/`CLOSED` only when `confidence_level` is `'high'`; `'medium'`
or `'low'` — every toilet ingested today — gets `LIKELY_OPEN`/
`LIKELY_CLOSED` instead. `PRODUCT.md` section 10 names this requirement for
`OPEN` specifically ("never claim `OPEN` without sufficiently trusted
evidence"); this task applies it symmetrically to `CLOSED` too, as the ADR
explains. Every status computed against real ingested data today is
therefore qualified, not plain — correct given a single, uncorroborated
source, not a bug.

**Wired through the whole pipeline.** `lib/toilets/normalized-source-record.ts`
now requires `open24h`/`openingHoursNormalized`; `lib/ingest/osm/normalize.ts`
derives them from the OSM `opening_hours` tag; `lib/ingest/upsert.ts` writes
them to the schema's existing (since `TASK-003`, unused until now)
`open_24h`/`opening_hours_normalized` columns; `db/queries/nearby.ts` selects
them; `lib/toilets/nearby-response.ts`'s `toNearbyResult` now takes an
explicit `now: Date` and computes the real status, replacing the constant
`'UNKNOWN'` every result carried since `TASK-007`; the route computes `now`
once per request so every result in one response reflects the same instant.
The preview and detail sheet (`lib/toilets/preview-copy.ts`'s widened
`openingStatusLabel`, plus a new `openingStatusVariant`) show the matching
badge text and colour — green/red/orange, reusing `--status-open`/
`--status-closed`/`--status-uncertain` (defined since `TASK-001`'s design
tokens, unused until now).

**Ingestion warnings, not silent discards.** `scripts/ingest/osm.ts` now
prints a summary of every element whose raw hours text existed but did not
fit the bounded grammar (`ARCHITECTURE.md` section 10's "record ingestion
warnings"), the same pattern already used for rejected elements. No schema
change: a printed warning satisfies this without a new `ingestion_runs`
column.

Verified: lint, format, typecheck, 163 unit tests (28 new — the parser,
the status computation including the overnight-crossing-midnight case,
the Warsaw-time helper, the widened preview-copy label/variant, and two
extended existing OSM-ingest assertions), 27 integration tests (2 new,
proving the new columns round-trip through a real PostGIS database via
both `findNearbyToilets` directly and the full `upsertSourceRecords` write
path), the production build, and 10 Playwright tests (1 new, asserting a
real `OPEN` status renders `OTWARTY` with the real computed
`--status-open` background colour, `rgb(155, 234, 136)`, against a running
production build — not just the previously-only-reachable `UNKNOWN`).

**What is, and is not, verified.** The parser's coverage is proven against
constructed fixtures matching the documented OSM grammar — this session
cannot re-run ingestion against the live Overpass source (the same,
already-documented network limitation), so no real Warsaw OSM
`opening_hours` string has ever been fed through this parser. Whether real
data mostly fits the bounded grammar, or mostly needs `PH`/date-range
support later, is unknown until a live ingestion run happens.

Not created, by design: parsing for public holidays or date/season ranges,
populating `seasonal`, a new `ingestion_runs` warnings column, and any
change to ranking, filters, or the list view.

### Owner-directed additions outside the task sequence

**Polish/English language switch, 2026-09-13.** Requested by the project owner
after TASK-001 and after the first production deployment. The locale is a route
segment, `/pl` and `/en`, with the bare domain redirecting to `/pl`. Copy lives
in `lib/i18n/dictionaries.ts`. Recorded in `docs/adr/0002-locale-in-the-url.md`.

This is not part of TASK-001 or TASK-002. It is logged here so the roadmap
reflects what the repository actually contains.

**First production deployment, 2026-09-13.** Deployed to Vercel at
`https://gdziekibel-bienos.vercel.app`, confirmed loading by the owner. The
deployment was made by uploading files directly, not by linking the GitHub
repository, because the Vercel integration available to this session has no
team read access: `list_teams` returns an empty list and reads against the
`bienos` scope are refused with HTTP 403. Consequences, which stand until the
repository is imported from the Vercel dashboard:

- pushes to the repository do not rebuild the site;
- the live site was built from eight uploaded files and a trimmed
  `package.json`, not from the committed tree;
- `vercel.json` was not exercised by that build.

## Verification at current baseline

All commands run on 2026-09-13 against Node v22.22.2, pnpm 10.33.0 and a local
PostgreSQL 16.13 with PostGIS 3.4.2. `node_modules` and `.next` were deleted
before the run.

| Command                   | Result                                              |
| ------------------------- | --------------------------------------------------- |
| `pnpm install --frozen-lockfile` | pass, lockfile satisfied                     |
| `pnpm lint`               | pass, no findings                                    |
| `pnpm format:check`       | pass, all matched files match Prettier style         |
| `pnpm typecheck`          | pass, no diagnostics                                 |
| `pnpm test:unit`          | pass, 163 tests in 24 files                          |
| `pnpm build`              | pass, `/pl` and `/en` prerendered as static HTML      |
| `pnpm db:migrate`         | pass, both migrations applied to an empty database   |
| `pnpm db:check`           | pass, `PostGIS OK — installed version 3.4.2`         |
| `pnpm test:integration`   | pass, 27 tests in 4 files                            |
| `pnpm test:e2e`           | pass, 10 tests in the `mobile-chromium` project (map fallback, location ask/deny/grant, nearby-fetch interception, nearest-toilet preview, toilet detail sheet + navigation CTA, real opening-status colour) |

Also observed:

- `pnpm dev --port 3210` served the shell with HTTP 200 and the GdzieKibel.pl
  wordmark in the response body.
- `pnpm test:integration` skips both tests cleanly when `DATABASE_URL` is unset,
  rather than failing or reporting a fabricated pass.
- Running `pnpm build` after `pnpm format` leaves `tsconfig.json` unchanged, so
  Next.js and Prettier do not fight over that file.
- A clean `git clone` of the pushed branch builds with the exact commands
  `vercel.json` pins (`pnpm install --frozen-lockfile`, then `pnpm build`) with
  `DATABASE_URL` unset. This confirms the lazy environment validation does not
  break a deployment build.

## Observed facts worth recording

- `next dev` detects an AI coding agent and appends a marked
  `nextjs-agent-rules` block to `AGENTS.md`, re-adding it if removed. The block
  is committed as tool-managed content. It adds framework guidance only and
  changes no project rule.
- `@playwright/test` is pinned to 1.56.0 rather than the newest release because
  that is the version matching the Chromium build available in the verification
  environment, which allowed the E2E smoke test to be observed passing. CI
  installs its own browser, so the pin can be raised in a later task.
- CI runs E2E in a separate job. It was not deferred.
- The `enable-postgis` down migration is deliberately a no-op, because dropping
  PostGIS would cascade into every geometry column.

## Known unresolved decisions

- Warsaw city open-data toilet dataset: deferred, unobserved. See ADR 0003
  section 4.
- OpenStreetMap licence text and attribution wording: cited by the research,
  not yet read live and quoted.
- Whether the product database is a Derivative Database under ODbL share-alike:
  flagged for legal review; the schema keeps both designs open.
- Final production map tile provider.
- Final analytics provider.
- Real-data deduplication thresholds.

These are intentionally unresolved and must not be silently treated as facts.

Resolved by TASK-001: the migration/schema tooling choice is now
`node-pg-migrate` with plain SQL files, recorded in
`docs/adr/0001-foundation-stack.md`.

Resolved by TASK-002: the first data source is OpenStreetMap, acquired by a
weekly bounded Overpass pull, recorded in `docs/adr/0003-first-data-source.md`
and `docs/contracts/osm-toilets-source.md`.

## Unresolved blockers

None for TASK-001.

Not verifiable in this environment, and therefore not claimed:

- No Vercel preview deployment was created; the deployment path is documented
  but unexercised. The Vercel integration available to this session reports no
  team, and linking a git project is refused without a team ID, so the
  deployment could not be created or inspected from here. Direct network access
  to Vercel hosts is also blocked by the environment's egress policy.
- CI has not been observed running on GitHub; the workflow is untested there.
- A separate cloud environment with an allowlist for the Warsaw and
  OpenStreetMap hosts was created on 2026-09-13. No session has yet reported a
  successful probe run from it; the one session that ran after its creation
  recorded the same HTTP 403 denials. Whether that session used the new
  environment is not recorded.
- The TASK-002 source verification could not be started from this environment.
  On 2026-09-13 the egress proxy answered HTTP 403 to CONNECT for
  `dane.um.warszawa.pl`, `api.um.warszawa.pl`, `iot.warszawa.pl`,
  `warszawa19115.pl` and `overpass-api.de`. No Warsaw or OpenStreetMap value has
  been observed, so none is recorded as fact.

## Next approved task

One live ingestion run, from a session in the GdzieKibel cloud environment:

```
git pull && pnpm install --frozen-lockfile
pnpm db:migrate
pnpm ingest:osm
```

Record the boundary relation it resolves and its counts here. That closes
TASK-004 and, with the same run, most of the TASK-002 observation gaps.

Two things, in order:

1. Visually confirm the map shell renders real tiles and a real location dot,
   from a session with a real `NEXT_PUBLIC_MAPTILER_KEY` and working egress
   to `api.maptiler.com`.
2. `TASK-014 — Price/free state` per `PLAN.md`: "free/paid/unknown is
   normalised and rendered consistently." Needs a `tasks/014-*.md` file,
   whose first job is honestly scoping what remains: `price_state` has
   been normalised since `TASK-003`/`TASK-004` and rendered consistently
   since `TASK-010`/`TASK-011` (`lib/toilets/preview-copy.ts`'s
   `priceLabel`). What plausibly remains — `price_amount_minor`/`currency`
   (present in the schema, never populated) and `payment_methods`
   normalisation (`upsert.ts`'s own comment: "Normalised later by
   TASK-014") — needs checking against real OSM `fee`/`charge`/`payment:*`
   tag data before deciding real scope, the same way `TASK-013` first
   established what was and was not already done.

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

### TASK-014 — Price/free state

Complete on 2026-09-13. Specified in `tasks/014-price-free-state.md`;
decision recorded in `docs/adr/0010-price-and-payment-normalisation.md`.

**Scoped by checking what already existed first**, the same discipline
`TASK-013` used: `price_state` was already normalised (`TASK-003`/
`TASK-004`) and rendered consistently (`TASK-010`/`TASK-011`) before this
task started. Two real gaps remained, both already named in existing
schema comments: `price_amount_minor`/`currency` (present since `TASK-003`,
never written), and `payment_methods` (`docs/adr/0004-schema-conventions.md`:
"normalised by TASK-014" — it held the *raw* `payment:*` tag dump instead,
never an actual normalisation).

Created: `lib/toilets/parse-charge.ts` parses a bounded `<amount>
<currency>` grammar (one amount, one of `PLN`/`zł`/`zl`/`EUR`/`USD`;
anything else — a range, missing currency, free text — is `null`, never a
guess) into `{ amountMinor, currency }`. `lib/ingest/osm/normalize.ts`
gained a `paymentMethods(tags)` mapping function (the same pattern as
`accessType()`/`priceState()`) producing three real facts — `cash`,
`cards`, `coins`, each a `FeatureState` — from OSM's `payment:*` tags;
`docs/research/2026-09-13-warsaw-toilet-sources.md` section 3.10's cited
traveller problem (needing coins, not knowing if cash/card works) is
exactly what these three facts answer, not the full `payment:*` namespace.

**Wired through the whole pipeline**, the same shape as `TASK-013`:
`normalized-source-record.ts` requires `priceAmountMinor`/`currency`/
`paymentMethods`; `upsert.ts` writes `price_amount_minor`/`currency` (new)
and the *normalised* `payment_methods` (replacing the raw dump it wrote
before); `db/queries/nearby.ts` selects all three; the nearby API returns
them, with `paymentMethods` never `null` at the response boundary — a row
with none recorded (or a pre-`TASK-014` row) becomes
`{cash:'unknown',cards:'unknown',coins:'unknown'}`, not an absent field.
The preview and detail sheet show the parsed amount (`lib/toilets/preview-copy.ts`'s
new `priceAmountLabel`, falling back to the existing generic `PŁATNY`/`PAID`
badge when nothing parsed) and the detail sheet gained three more
accessibility-style rows for the payment facts, reusing `featureStateLabel`
unchanged.

Verified: lint, format, typecheck, 180 unit tests (17 new — the charge
parser, `priceAmountLabel`, and extended OSM-normalize/nearby-response
assertions), 30 integration tests (3 new, proving `price_amount_minor`/
`currency`/`payment_methods` round-trip through a real PostGIS database via
both `findNearbyToilets` and the full `upsertSourceRecords` write path, and
that a pre-`TASK-014` row with no payment data reports the DB column as
real `null` — the all-unknown fallback is `toNearbyResult`'s job, proven
separately by unit test), the production build, and 10 Playwright tests
(the existing detail-sheet test extended with a real `4.50 PLN` amount and
all three payment-method rows against a running production build, not a
new test file).

Not created, by design: currencies beyond PLN/EUR/USD, free-text charge
parsing (a range, "donation"), payment methods beyond cash/cards/coins,
and any change to `price_state` itself, ranking, or opening-status work.

### TASK-015 — List view

Complete on 2026-09-13. Specified in `tasks/015-list-view.md`. No new ADR:
this is a UI-composition decision reusing existing data/copy, the same
category as `TASK-008`'s marker-variant scoping and `TASK-010`'s CTA
deferral, not a new architecture or contract decision.

Created: `components/map/ToiletListView.tsx`, an accessible `<ul>` of one
row per toilet in the `toilets` array's own order (already the
recommendation ranking, `TASK-009` — no separate sort). Each row reuses
`distanceLine`, `openingStatusLabel`/`openingStatusVariant`, and
`priceAmountLabel` unchanged (`TASK-010`/`TASK-013`/`TASK-014`), plus up to
two feature badges — wheelchair and changing-table, the two `PRODUCT.md`
section 6.3 actually names as filter dimensions — each shown only when its
value is not `'unknown'`. `MapShell.tsx` gained a `viewMode` state and a
plain-text toggle button (`LISTA`/`MAPA`, opposite corner from MapLibre's
own `NavigationControl`) that swaps the map/fallback area for the list;
tapping a row sets the same `selectedId` a marker click or the preview tap
already sets, opening the identical `ToiletDetailSheet` — one selection
mechanism, three entry points, no new detail view.

**The preview is hidden in list mode.** It would otherwise duplicate the
list's own first row (the same top-ranked toilet), showing the same
information twice for no reason. The toggle switches what fills the map
area only; the location ask/denied sheets and the detail sheet still
overlay either mode unchanged.

**Independent of tile state**, the same reasoning already applied to the
fetch, the preview, and the detail sheet: the list needs only the
`toilets` array, verified directly by a Playwright test that switches to
list view while the tile fallback is showing (no MapTiler key in this
suite) and gets full, real content anyway.

Verified: lint, format, typecheck, 180 unit tests (unchanged — no new pure
function was added; the component reuses existing, already-tested copy
functions directly), 30 integration tests (unchanged), the production
build, and 11 Playwright tests (1 new: switch to list view under the tile
fallback, assert one row's real intercepted name/distance/status/price/
feature-badge content, tap it, assert the identical detail sheet opens and
focuses its heading, close it, switch back to map view).

Not created, by design: filters (`TASK-016`'s job — the list shows the
same unfiltered array the map does), payment-method badges on the compact
card (not a `PRODUCT.md` section 6.3 filter dimension; still one tap away
via the detail sheet), virtualisation or pagination (`MAX_NEARBY_RESULTS`
is 30, small enough for a plain scrollable list), and any change to
ranking, the nearby API, or the detail sheet's own content.

### TASK-016 — Core filters

Complete on 2026-09-13. Specified in `tasks/016-core-filters.md`; decision
recorded in `docs/adr/0011-filter-semantics.md`.

**The unknown-semantics decision.** `PRODUCT.md` section 6.3 phrases three
of the five MVP filters (wheelchair, baby-changing, 24h) as "where data
exists" — the product's own words already scope those to confirmed data.
This task applies the identical rule to all five, symmetrically: a filter
only keeps a toilet whose relevant fact is positively confirmed to satisfy
it. `'unknown'` never matches; `'limited'` never satisfies the two
`FeatureState` filters either, since the filter promises confident
accessibility, not a partial or uncertain one. Against today's real
ingested data — every toilet carries `'unknown'` for wheelchair/changing-
table/24h — a filter on any of those can honestly return zero results.
This is correct, not a defect: `TASK-017 — No-results and radius
expansion`, the very next task on the roadmap, exists specifically because
this was anticipated.

Created: `lib/toilets/filter-nearby.ts` (`matchesFilters`, the pure
predicate, and `filterNearbyToilets`, the server-side step). Filtering is
applied in the nearby API, on the same nearest-30 candidates
`db/queries/nearby.ts` already returns (unchanged), before ranking
(`TASK-009`) — one code path, not a second client-side pass — because
`openNow` cannot be evaluated in SQL (it depends on the request's own
`now` and the bounded-grammar opening-hours evaluation, `TASK-013`) so
every filter is applied in JS uniformly. A filtered response can be
smaller than an unfiltered one even when more matching toilets exist
farther away; expanding the radius to compensate is explicitly
`TASK-017`'s job, not this route's.

**Wired through the pipeline**: `nearby-request.ts` accepts an optional
`filters` object (the field `docs/adr/0006-nearby-api-contract.md`
deliberately withheld until this task could give it meaning);
`nearby-response.ts` gained `open24h` (the raw fact the 24h filter reads,
distinct from the computed `openingStatus`); `fetch-nearby.ts` omits the
`filters` key entirely when none is active, so a pre-`TASK-016` request
shape is unchanged. `MapShell.tsx` gained `activeFilters` (fed into the
existing fetch effect, now also keyed on it) and a separate `draftFilters`
state for the sheet's in-progress edits, so toggling a checkbox does not
refetch on every click — only the sheet's "Apply" commits `draftFilters`
into `activeFilters`.

**No live "(N)" result count.** `DESIGN.md` 9.6's mockup shows one; an
accurate live count would need a second, always-unfiltered candidate pool
kept in sync alongside the displayed one — a real architectural addition
`PLAN.md`'s actual outcome text does not ask for. The CTA reads `POKAŻ
WYNIKI` without a count, the same category of decision as `TASK-010`'s
deferred CTA.

Verified: lint, format, typecheck, 194 unit tests (14 new — the filter
predicate exhaustively, across every filter × feature-state combination,
plus extended `nearby-request`/`fetch-nearby` assertions), 30 integration
tests (unchanged — `db/queries/nearby.ts` itself was not touched), the
production build, and 12 Playwright tests (1 new: check the `OTWARTE
TERAZ` toggle, apply, assert the real intercepted request body carries
`filters: { openNow: true }`, reopen the sheet and confirm it shows the
already-applied state, then clear and confirm the next request carries no
`filters` key at all).

Not created, by design: radius expansion or a real empty-state design
(`TASK-017`'s job), a live result count, filters beyond the five
`PRODUCT.md` section 6.3 names, and any change to ranking or opening-
status computation themselves.

### TASK-017 — No-results and radius expansion

Complete on 2026-09-13. Specified in
`tasks/017-no-results-radius-expansion.md`; decision recorded in
`docs/adr/0012-no-results-diagnosis.md`.

**Three diagnosed states, filters checked first.** `TASK-016` made an empty
`toilets` array a real, reachable state for a reason radius expansion
cannot fix: an active filter excluding every candidate. Showing one
generic "search farther" message regardless of cause would send the user
toward an action that cannot help whenever a filter, not distance, is the
real reason. `NoResultsState` diagnoses, in order: (1) a filter is active
→ point at it, offer `WYCZYŚĆ` (reusing the filter sheet's own action and
state, no parallel mechanism); (2) no filter, radius below
`MAX_RADIUS_METERS` → `SZUKAJ DALEJ` jumps directly to the maximum, not a
stepped ladder `PRODUCT.md` never asks for; (3) no filter, radius already
at the maximum → an honest `ROZUMIEM`-dismissible state naming this
search's own limit, never implying nothing exists anywhere (`PRODUCT.md`
section 6.2's explicit rule).

**No flash during loading.** A fresh `SearchParams` (coords/filters/radius)
is recorded from inside the fetch effect's own `.then` callback, once that
exact search actually finishes; `toiletsLoaded` is derived at render time
by comparing the current render's own params against the last-recorded
ones, rather than a boolean reset with a synchronous `setState` call in the
effect body. The latter is what a first implementation attempt used, and
`pnpm lint` rejected it (`react-hooks/set-state-in-effect`); reading a
generation counter from a `ref` during render was the next attempt, and
`pnpm lint` rejected that too (`react-hooks/refs` — refs may not be read
during render). The params-comparison that shipped satisfies both rules
and needed no `eslint-disable`. `noResultsDismissed` uses the same
comparison against a separately recorded "dismissed at these params" value,
so any dependency change (new location, filter, or radius) clears a stale
dismissal for free.

**Never alongside the filter sheet.** Both are bottom-sheet-style
overlays; while `filtersOpen`, the no-results overlay does not render, so
its filtered-state action never coexists with the filter sheet's own
identically-labelled `WYCZYŚĆ` button.

Created: `components/map/NoResultsState.tsx` (the three-branch render,
`fill` prop switching between the map view's bottom-anchored placement,
reusing `.preview`'s footprint, and the list view's full-area placement).
`lib/toilets/fetch-nearby.ts` gained an optional `radiusMeters`, omitted
at the default radius so a pre-`TASK-017` request shape is unchanged.
`MapShell.tsx` gained `searchRadius`, `loadedParams`/`dismissedParams`
state and the `SearchParams`/`sameSearchParams` comparison described
above; the existing fetch effect now also depends on `searchRadius` and
sends it as `radiusMeters` (omitted at the default value). Six new
`Dictionary` keys (`noResultsHeadline`, `noResultsFilteredBody`,
`noResultsRadiusBody`, `noResultsRadiusAction`, `noResultsExhaustedBody`,
`noResultsExhaustedAction`); the filtered state's action reuses the
existing `filtersClear` key.

Verified: lint, format, typecheck, 194 unit tests (unchanged — no new pure
function warranted a dedicated unit test; the three-branch logic is a
short, direct render and is covered by the three new E2E tests instead),
30 integration tests (unchanged — no query or schema change), the
production build, and 15 Playwright tests (3 new, one per diagnosed
state: an active filter shows the filtered message and `WYCZYŚĆ` clears it
and re-fetches with no `filters` key; an expandable radius shows `SZUKAJ
DALEJ` and clicking it re-fetches with `radiusMeters: 5000`; a radius
already at that maximum shows the exhausted message and `ROZUMIEM`
dismisses the overlay). All 12 pre-existing Playwright tests still pass
unmodified, including the one asserting the exact pre-`TASK-017` request
body shape at the default radius.

Not created, by design: a stepped/progressive radius-expansion ladder, any
change to `MAX_RADIUS_METERS`/`DEFAULT_RADIUS_METERS` or the server-side
cap, outside-Warsaw detection (`TASK-018`'s job), and any change to
filters or ranking themselves.

### TASK-018 — Outside-Warsaw behaviour

Complete on 2026-09-13. Specified in
`tasks/018-outside-warsaw-behaviour.md`; decision recorded in
`docs/adr/0013-outside-warsaw-behaviour.md`.

**One definition of Warsaw, checked before any coordinate is stored.**
`TASK-006`'s location flow only ever produced `granted` (real coordinates)
or one shared `denied` screen for every non-grant outcome — none of which
have real coordinates, so one honest message covered all of them. A grant
from outside Warsaw is neither: the browser succeeds and the coordinates
are real, so `denied`'s "we don't know where you are" copy would be false,
but the existing nearest-toilet pipeline has no concept of "too far to be
useful." This task reuses `isWithinWarsawBbox` (`lib/geo/warsaw.ts`),
already the one definition of the supported area for ingestion validation
and the map's own camera bounds — no second, possibly diverging boundary.
The check runs in `handleShareLocation`, immediately after a successful
grant and before either `addUserLocationMarker` or `setGrantedCoords` run:
an out-of-area coordinate never reaches the marker, the fetch, or the
ranking code, so every existing consumer keeps the same contract it always
had (`grantedCoords` is a usable Warsaw-area position or `null`, never a
third kind of value it must additionally distrust).

**One action, not the denied screen's two.** `denied` offers both `SPRÓBUJ
PONOWNIE` (retry — reasonable when permission or a transient GPS failure
caused it) and `OTWÓRZ MAPĘ WARSZAWY`. Being in Kraków is not transient in
that sense; a retry implies a false remedy. The new `outside`
`LocationFlowState` offers only `PLAN.md`'s named "manual Warsaw map
path": it reuses the denied screen's own `OTWÓRZ MAPĘ WARSZAWY` action and
dictionary key, transitioning to the same `dismissed` state so the
already-working no-grant behaviour (default Warsaw-centred fetch, no
location dot) is the implementation, not a second one.

Created: two `Dictionary` keys (`outsideWarsawHeadline`, e.g.
`JESTEŚ POZA WARSZAWĄ.`, and `outsideWarsawBody`); the action reuses
`locationDeniedOpenMap`. `MapShell.tsx` gained the `outside`
`LocationFlowState` value, an `outsideHeadingRef` following the same
focus-on-mount pattern as the ask/denied screens (`DESIGN.md` section 14),
and the new screen itself — reusing `.scrim`/`.sheet`/`.sheetHeadline`/
`.sheetBody`/`.sheetPrimary` verbatim, no new CSS.

Verified: lint, format, typecheck, 194 unit tests (unchanged —
`isWithinWarsawBbox` itself was not touched, and is already covered by
`tests/unit/geo.test.ts`, including a Kraków fixture reused directly by
the new E2E test below), 30 integration tests (unchanged), the production
build, and 16 Playwright tests (1 new: a real Playwright geolocation grant
at Kraków's coordinates shows the `JESTEŚ POZA WARSZAWĄ.` heading, focused,
confirms the `denied` heading and its `SPRÓBUJ PONOWNIE` button are absent,
clicking `OTWÓRZ MAPĘ WARSZAWY` dismisses the screen, and every intercepted
nearby-toilets request — before and after — stays centred on the default
Warsaw view, never the real Kraków coordinates). All 15 pre-existing
Playwright tests still pass unmodified.

Not created, by design: any change to `WARSAW_BBOX` itself, a retry action
on the outside screen, or any real multi-city support (`PRODUCT.md`
principle 7, "Warsaw first" — this task only detects and communicates the
existing boundary).

### TASK-019 — Data confidence display

Complete on 2026-09-13. Specified in `tasks/019-data-confidence-display.md`;
decision recorded in `docs/adr/0014-computed-confidence-level.md`.

**The display half was already built; the input was the real gap.**
`DESIGN.md` section 9.4 places a confidence/source hint only on the toilet
detail sheet, not the collapsed preview (section 9.3 doesn't list one);
`TASK-011` already built exactly that hint, and `TASK-013`'s opening-status
qualification (ADR 0009) already reads `confidence_level`. Nothing needed
changing about placement. What was missing: `confidence_level` has always
been the schema's `'low'` default (`docs/adr/0004-schema-conventions.md`)
because `lib/ingest/upsert.ts`'s `canonicalValues()` never included it —
every toilet showed `'low'` because nothing computed anything, not because
`'low'` was individually correct for each one.

**The HIGH/LOW tension, resolved conservatively.** `PRODUCT.md` section 9
defines HIGH as "recent, trusted source **or** strong cross-source
agreement" but defines LOW as including "single ... data **not yet
corroborated**" — with only one source (OSM) in production, every real
record is simultaneously both descriptions at once if it happens to carry
a fresh `check_date`. `docs/adr/0009-opening-hours-status.md`, written
before this task started, already committed to a reading: "once `TASK-019`
starts producing `confidence_level` values above `'low'`, **well-
corroborated** toilets will start showing plain `OPEN`/`CLOSED`." This task
followed that existing commitment rather than reinterpreting it:
`computeConfidenceLevel` never returns `'high'` — that still needs a real
second source (`TASK-022`) to actually corroborate against, not recency
alone from a single one.

**MEDIUM from two real, already-captured signals.** A toilet is `MEDIUM`
when both hold, `LOW` otherwise: (1) `verified_at` (already populated from
OSM's `check_date`/`survey:date` since `TASK-002`/`TASK-003`) is within
`VERIFICATION_FRESHNESS_DAYS` (365, a first defensible pass, OSM's own
rough re-survey convention) of the evaluated moment; (2) the source's raw
access tag is not the contract's uncertain case (`'permissive'` —
`lib/ingest/osm/normalize.ts`'s own comment already reserved this exact
raw value "so `TASK-019` can lower confidence for it", years before this
task existed). `access_raw` had never been stored on the canonical
`toilets` row before now — a new migration
(`db/migrations/*_add-confidence-access-raw.sql`) adds it.

**Computed at request time, the same shape of decision as `openingStatus`.**
`verified_at`/`access_raw` are plain stored facts; `confidence_level` is
derived from them and `now` inside `toNearbyResult`, never trusted from a
stale stored column — `docs/adr/0009`'s own precedent. The
`confidence_level`/`confidence_score` DB columns are untouched, left
exactly as `docs/adr/0004` already described them.

Created: `lib/toilets/compute-confidence.ts` (`computeConfidenceLevel`,
`VERIFICATION_FRESHNESS_DAYS`; pure, no database). `lib/ingest/upsert.ts`
gained `access_raw` in `canonicalValues()`/`INSERT_TOILET`/`UPDATE_TOILET`
(21 parameters now; renumbered and hand-verified again, the same routine
as `TASK-013`/`TASK-014`). `db/queries/nearby.ts` now selects
`verified_at`/`access_raw` in place of the unused `confidence_level`
column. `lib/toilets/nearby-response.ts`'s `toNearbyResult` computes
`confidenceLevel` once and feeds the same value into both the response and
`computeOpeningStatus`. `lib/toilets/filter-nearby.ts`'s `openNow`
evaluation was also updated to the same computed value (it previously read
the now-removed `row.confidenceLevel`) — functionally unaffected today,
since `OPEN` and `LIKELY_OPEN` count identically for that filter, but kept
consistent rather than left reading a field that no longer exists.

Verified: lint, format, typecheck, 206 unit tests (12 new — 8 exhaustively
covering `computeConfidenceLevel`'s freshness boundary, the permissive-
access downgrade, and the future-date/never-HIGH cases, plus 4 new
`toNearbyResult` cases proving the computed value flows into the response),
32 integration tests (2 new: `access_raw`/`verified_at` round-trip through
a real upsert and a real `findNearbyToilets` query, and a real inserted
row verified within 10 days computing real `MEDIUM` confidence through
`toNearbyResult` — not only a fixture), the production build, and all 16
pre-existing Playwright tests unmodified (no new UI, so no new E2E
coverage — every existing test mocks the API response directly and never
exercises the real computation).

Not created, by design: any path to `HIGH` confidence (needs `TASK-022`),
any change to the ranking formula (`docs/adr/0007`'s own "Not decided
here" territory), and any new UI (`DESIGN.md` already places the hint,
`TASK-011` already built it).

### TASK-020 — Report incorrect toilet data

Complete on 2026-09-13. Specified in `tasks/020-report-incorrect-data.md`;
decision recorded in `docs/adr/0015-toilet-reports.md`.

**`issue_type` is a real enum, matching every other categorical column.**
`ARCHITECTURE.md` section 5.3 suggests `issue_type text not null`, but
`access_type`/`price_state`/`feature_state`/`canonical_status`/
`confidence_level` are all real Postgres `ENUM`s, and
`docs/adr/0004-schema-conventions.md` already recorded exactly this
reasoning for `access_type`. The seven enum members mirror `BRAND.md`'s
"Reporting" reasons exactly, in the same order `PRODUCT.md` section 6.4
lists them (`closed`/`does_not_exist`/`wrong_hours`/`wrong_price`/
`access_denied`/`wrong_accessibility`/`other`).

**`status` exists, defaults to `'new'`, nothing reads it yet.** The same
shape of decision `docs/adr/0004` already made for `confidence_level` in
`TASK-003` — created and defaulted now, acted on by a later task if one
ever needs to. `PRODUCT.md` section 6.4's own rule ("a report must not
immediately rewrite canonical data without moderation or confidence
logic") means this task's job stops at storing the report.

**Existence checked before insert.** `toilet_id references toilets(id)`
with no `ON DELETE` clause (toilets are never actually deleted — the same
reasoning `lib/ingest/upsert.ts` already established). The route checks
the toilet exists first and returns a clean `404` rather than letting a
foreign-key violation surface as an undifferentiated `500`.

**No rate-limiting, no abuse metadata, no location.** `PRODUCT.md` FR-08
bundles "validated and rate-limited"; `PLAN.md` splits them across
`TASK-020` and `TASK-021` — this task implements only the former.
`ARCHITECTURE.md` section 5.3's own "do not store precise user location
with a report" is followed literally: the request body carries only
`issueType` and an optional `note`.

Created: a migration adding `toilet_reports`, `toilet_report_issue_type`,
`toilet_report_status`. `lib/reports/types.ts` (`ISSUE_TYPES`),
`lib/reports/report-request.ts` (`parseReportRequest`, `parseToiletId`),
`lib/reports/submit-report.ts` (the client-side POST, mirroring
`fetch-nearby.ts`'s never-throws shape). `db/queries/reports.ts`
(`toiletExists`, `insertReport`). `app/api/toilets/[id]/reports/route.ts`
(400 for a malformed id or invalid body, 404 for an unknown toilet, 201
with the created report's id on success). `components/map/ReportSheet.tsx`
(the seven reasons as radios, an optional note, success replaces the form,
failure keeps whatever was picked/typed) and a `ZGŁOŚ PROBLEM` control on
`ToiletDetailSheet.tsx` (position 8, `DESIGN.md` section 9.4) that opens
it in place of the detail sheet, `onClose` returning to the detail sheet
rather than closing everything. 14 new `Dictionary` keys.

Verified: lint, format, typecheck, 225 unit tests (19 new — `parseReportRequest`/
`parseToiletId` exhaustively, `submitReport`'s request-shaping, and an
enum-parity test reading the migration directly, the same technique
`tests/unit/toilets-types.test.ts` already uses), 36 integration tests (4
new: a real insert with no location columns, `toiletExists` telling a real
toilet from a random UUID, a blank note stored as `null`, and the SQL enum
itself rejecting an unrecognised `issue_type` — proven at the database
level, not just in application code), the production build, a real curl
smoke test against a running production build and a real PostGIS database
(a genuine insert returning `201`, an invalid `issueType` returning `400`
with the exact enum-member list, a well-formed but unknown toilet id
returning `404`, a malformed id returning `400` — the inserted row
independently verified to carry no location and `status = 'new'`), and 18
Playwright tests (2 new: a full success flow — open the report sheet from
the detail sheet, pick a reason, add a note, submit, see `DZIĘKI.
SPRAWDZIMY.`, close back to the detail sheet, not the map — and a failure
flow — a `500` shows the literal failure copy with the picked reason still
checked, retrying against a route that now succeeds shows the same success
copy). All 16 pre-existing Playwright tests still pass unmodified.

Not created, by design: any rate-limiting or abuse metadata (`TASK-021`'s
job), any moderation UI or a path that ever changes a report's `status`,
any way for a report to rewrite canonical `toilets` data, and the detail
sheet's still-missing "hours" line (`TASK-011`'s own, separate, unrelated
gap).

### TASK-021 — Report abuse protection

Complete on 2026-09-13. Specified in `tasks/021-report-abuse-protection.md`;
decision recorded in `docs/adr/0016-report-rate-limiting.md`.

**Answered the open design question, not deferred it again.**
`ARCHITECTURE.md` section 23 explicitly listed "whether report rate
limiting needs an external store/provider" as unresolved, and section 21
treats Redis as a non-goal "without evidence." An in-memory counter would
not actually work on the stated Vercel/serverless deployment target
(`ARCHITECTURE.md` section 22) — it would not coordinate across function
instances or survive a cold start, so it would look implemented without
functioning. Postgres (Neon), already provisioned and already this
project's one source of truth, holds the counter instead: no new external
service, no new dependency.

**A one-way hash, never the raw IP.** `PLAN.md`'s own phrase, "without
storing unnecessary personal data," ruled out logging or retaining a raw
IP address. `lib/reports/rate-limit.ts`'s `hashClientKey` SHA-256-hashes
the address read from `x-forwarded-for` (the header Vercel's edge network
sets — read directly, no `@vercel/functions` dependency, which only wraps
the same header) before it is ever written; only the hash and a count
reach the database. The hash is unsalted, a known first-pass limitation
recorded in the ADR's "Not decided here," not a silent gap.

**A fixed one-hour window, five writes, pruned on every request.** Simpler
than a sliding window or token bucket, and `PLAN.md`'s "measured...
controls" does not ask for precision at a window's edges. Counted
per-client across every toilet id, not per toilet — `ARCHITECTURE.md`'s
own phrase is "report endpoint spam," an endpoint-level threat.
`checkAndIncrementRateLimit` deletes windows older than the 24-hour
retention cutoff before every increment, so the table never accumulates
more than about a day's worth of counters, and uses one atomic `INSERT ...
ON CONFLICT ... RETURNING` rather than a separate read-then-write, so
concurrent requests from the same client cannot both read a count under
the limit and both proceed.

Created: a migration adding `report_rate_limit_windows` (`client_key`,
`window_start`, `request_count`). `lib/reports/rate-limit.ts`
(`hashClientKey`, `extractClientIp`, `rateLimitWindowStart`,
`rateLimitRetentionCutoff`, `secondsUntilWindowEnds`,
`RATE_LIMIT_MAX_REQUESTS_PER_WINDOW`; pure, no database).
`db/queries/report-rate-limit.ts` (`checkAndIncrementRateLimit`).
`app/api/toilets/[id]/reports/route.ts` now checks the rate limit first,
before the id or body are even parsed, returning `429` with a
`Retry-After` header over the limit.

Verified: lint, format, typecheck, 236 unit tests (11 new —
`rateLimitWindowStart`/`rateLimitRetentionCutoff`/`secondsUntilWindowEnds`
at their boundaries, `hashClientKey`'s determinism and that it never
contains the raw IP as a substring, `extractClientIp`'s
`x-forwarded-for`-chain parsing), 39 integration tests (3 new: a real
sequence of writes against a real database showing the count increment
cumulatively and a sixth write exceed the documented limit, a different
client key getting its own independent count, and a stale row actually
being deleted by the pruning step, not merely ignored), the production
build, and a real curl smoke test against a running production build and
a real database: five spoofed-IP report submissions in a row succeeded
(`201`), the sixth and seventh returned `429` with a `Retry-After` header,
a different spoofed IP succeeded unaffected, and the `report_rate_limit_windows`
table was independently queried afterward to confirm it held only the
SHA-256 hash and a count — never the literal IP strings used in the test.
All 18 pre-existing Playwright tests still pass unmodified; no new E2E
coverage, since this task adds no UI and every existing report-flow test
already mocks the endpoint.

Not created, by design: any external rate-limiting store or provider
(Redis or otherwise), a salted hash (left as a documented, revisitable
first-pass gap), CAPTCHA or proof-of-work, and any change to `TASK-020`'s
report schema or its contract for a client under the limit.

### TASK-022 — Second data source + deduplication

Complete on 2026-09-14. Specified in
`tasks/022-second-source-deduplication.md`; decision recorded in
`docs/adr/0017-cross-source-deduplication.md`.

**A fresh egress check, not a stale assumption.** Before starting, a new
session was created in the dedicated "GDZIE KIBEL" cloud environment
(created 2026-09-13 specifically with a Warsaw/OSM host allowlist) to
re-verify reachability rather than trust an earlier session's result.
Confirmed the same day: `dane.um.warszawa.pl`, `api.um.warszawa.pl`,
`overpass-api.de`, and `iot.warszawa.pl` all still fail — the proxy resets
the connection mid-TLS (code 1006). `warszawa19115.pl` (the city's
contact/report portal, not a data catalog) responds, but no
public-toilets dataset was found there. No real second source is
reachable from this project's sessions.

**Built the matching engine, not a fabricated adapter.** `lib/ingest/upsert.ts`'s
own comment used to claim "the second source (TASK-022) reuses this
without change." That did not survive actually working through the
requirement: the `!previous` branch always created a new canonical toilet
for any unseen source record, with no concept of "this might already
exist under a different source" — reusing it unmodified would create a
full duplicate for every toilet two sources happen to agree on, the exact
outcome `PLAN.md` asks to avoid. Rather than write a second ingestion
adapter against a guessed schema for a source this session has never
seen, this task built the reusable matching/merge logic and proved it
against `NormalizedSourceRecord` fixtures under a second, explicitly
fictional `sourceName` (`'fixture-second-source'`).

**Same-source records never trigger matching — provably.** A candidate
toilet only enters matching if it already has a source record from a
*different* `source_name`. `db/queries/dedup-candidates.ts`'s spatial
query enforces this at the SQL level (`WHERE s.source_name != $current`).
Because every canonical toilet in a real production database today is
OSM-only, this means today's real single-source ingestion is completely
unaffected — proven by the complete pre-existing `tests/integration/ingest.test.ts`
suite (10 tests, including two same-source records at the identical
coordinates) passing unmodified.

**Three outcomes, a first-pass threshold each.** New (no candidates
within `SPATIAL_CANDIDATE_RADIUS_METERS`, 30 m): create a canonical
toilet as before. Merge (within `AUTO_MERGE_DISTANCE_METERS`, 15 m, and
name similarity ≥ `AUTO_MERGE_NAME_SIMILARITY_THRESHOLD`, 80, on a
from-scratch Levenshtein-based scale — no dependency for one well-understood
algorithm): link the new source record to the existing toilet without
touching that toilet's own columns (`docs/contracts/osm-toilets-source.md`
section 5: "when two sources disagree on a field, both source records are
kept and the conflict is surfaced, not silently resolved"). Ambiguous
(within the spatial radius but short of the merge bar): the new source
record is inserted with `toilet_id = NULL` — nullable since `TASK-003`'s
original schema, exactly for this — and one `dedup_candidates` row per
candidate records the pairing, `status = 'pending'`. Name similarity is
never computed against `FALLBACK_TOILET_NAME` ("Toaleta") on either side:
two anonymous facilities sharing the same placeholder label match on
nothing real.

Created: a migration adding `dedup_candidates` and
`dedup_candidate_status`. `lib/ingest/dedup.ts` (`computeNameSimilarity`,
`decideMatch`, the three named threshold constants; pure, no database).
`lib/ingest/fallback-name.ts` (`FALLBACK_TOILET_NAME` moved out of
`upsert.ts` so `dedup.ts` can import it without a circular dependency;
re-exported from `upsert.ts` so the existing import path is unchanged).
`db/queries/dedup-candidates.ts` (`findCrossSourceSpatialCandidates`,
`insertDedupCandidate`). `lib/ingest/upsert.ts`'s `!previous` branch now
calls the matching logic before deciding whether to create, merge, or
flag; `UpsertCounts` gains `merged` and `flaggedForReview`; the file's own
top comment is corrected.

Verified: lint, format, typecheck, 249 unit tests (13 new — `computeNameSimilarity`'s
placeholder/missing-name handling and real similarity scoring,
`decideMatch`'s new/merge/ambiguous branches including a test that
computes its own expected similarity score rather than asserting a
hardcoded number), 43 integration tests (4 new: a confident merge that
leaves the original toilet's conflicting `wheelchair` value untouched, an
ambiguous match left unlinked with a real `dedup_candidates` row, a
far-away record creating a new toilet, and — the load-bearing guarantee —
two same-source records 2 metres apart each getting their own canonical
toilet), the production build, and all 18 pre-existing Playwright tests
passing unmodified (no new UI or API surface — this task is ingestion
plumbing only).

Not created, by design: a real second ingestion adapter (nothing real to
adapt to), any moderation UI or code reading/changing
`dedup_candidates.status`, address-based matching (no adapter populates
`address` yet), and any change to ranking, confidence computation, or
existing single-source ingestion behaviour.

### TASK-023 — Analytics instrumentation

Complete on 2026-09-14. Specified in
`tasks/023-analytics-instrumentation.md`; decision recorded in
`docs/adr/0018-first-party-analytics.md`.

**Postgres, not a named provider — the same resolution as TASK-021.**
`ARCHITECTURE.md`'s own "Analytics" section names PostHog or Plausible
"after privacy review," and section 23 lists "exact analytics provider" as
still requiring validation; no account or key for either exists in this
project. Rather than invent one or leave the task undone, this task built
the minimal first-party event log on the Postgres database this project
already has — the identical reasoning `docs/adr/0016-report-rate-limiting.md`
used for the rate limiter, now reused for analytics.

**Nine events, four already server-observed.** `PRODUCT.md` section 13's
FR-09 names the funnel exactly: `app_opened`, `location_granted`,
`location_denied`, `results_loaded`, `no_results`, `toilet_selected`,
`navigation_clicked`, `filter_applied`, `report_submitted`. Mapping each to
its natural trigger point showed four are already visible inside the two
existing route handlers with no new network call needed —
`results_loaded`/`no_results`/`filter_applied` inside
`POST /api/toilets/nearby`, `report_submitted` inside
`POST /api/toilets/:id/reports` — leaving five genuinely client-only events
needing a new endpoint.

**No coordinate, session, or device column exists to leak.** This is the
task's real constraint (`ARCHITECTURE.md` section 14's "Do not include
precise coordinates in analytics events," section 17's "Do not log:
precise user coordinates," `PRODUCT.md` section 20's "no precise user
location is stored in product analytics/database"): `analytics_events`
holds exactly `id`, `event_name`, and a server-assigned `occurred_at` — no
column exists for a future change to accidentally populate with a
coordinate. `location_granted`/`location_denied` fire from the permission
flow itself, never from the coordinate value.

**Never throws, at every layer.** `insertAnalyticsEvent` (server) and
`reportEvent` (client) both swallow every failure and resolve `undefined`
regardless — mirroring `lib/reports/submit-report.ts`'s shape, but with no
meaningful failure for a caller to react to: an analytics failure must
never look like the feature it is attached to broke. Proved directly: an
integration test passes an event name the SQL enum rejects and asserts the
call still resolves and writes nothing.

Created: a migration adding `analytics_event_name` (9 members) and
`analytics_events` (`id`, `event_name`, `occurred_at` only).
`lib/analytics/types.ts` (`EVENT_NAMES`). `lib/analytics/analytics-request.ts`
(`parseAnalyticsRequest`). `lib/analytics/report-event.ts` (client
`reportEvent`, never throws). `db/queries/analytics.ts`
(`insertAnalyticsEvent`, never throws). `app/api/analytics/events/route.ts`
(POST only, 400/201). `MapShell.tsx` fires `app_opened` on mount,
`location_granted`/`location_denied` from the permission flow, and
`toilet_selected` from every path that selects a toilet (marker, list row,
preview) via a new `selectToilet` helper. `ToiletDetailSheet.tsx`'s
navigation CTA fires `navigation_clicked`. `app/api/toilets/nearby/route.ts`
and `app/api/toilets/[id]/reports/route.ts` each gained one
`insertAnalyticsEvent` call after computing their own real outcome.

Verified: lint, format, typecheck, 259 unit tests (10 new — the
`analytics_event_name`/`EVENT_NAMES` enum-parity test, `parseAnalyticsRequest`,
and `reportEvent`'s never-throws behaviour on a non-2xx response and on a
rejected fetch), 46 integration tests (3 new — a real row with a
server-assigned timestamp, the table's exact three columns, and a rejected
enum value still resolving without writing a row), the production build,
and 19 Playwright tests (1 new: opening a toilet detail sheet and clicking
`PROWADŹ MNIE` while `/api/analytics/events` is mocked observes
`app_opened`, `toilet_selected`, and `navigation_clicked` all actually
reach the endpoint with the expected `eventName`). Independently confirmed
with a real curl/DB smoke test against a running production build and a
real PostgreSQL database: all nine events land with a `201`/insert (a
fixture toilet and report were used for `report_submitted`, then removed),
an unrecognised `eventName` returns `400` with no row written, and a direct
`information_schema.columns` query confirms `analytics_events` has exactly
`id`, `event_name`, `occurred_at` — no coordinate, session, or device
column exists. All smoke-test rows/fixtures were deleted afterward.

Not created, by design: rate limiting on `/api/analytics/events` (`PLAN.md`'s
TASK-023 outcome text does not mention abuse controls; the same gap
`TASK-020` left for reports before `TASK-021` closed it), a session or
device identifier of any kind, any dashboard or query surface reading
`analytics_events` (nothing yet needs one), and any change to an existing
route's response shape (each new `insertAnalyticsEvent` call is additive,
after the response body is already decided).

### TASK-024 — Error tracking / privacy scrubbing

Complete on 2026-09-14. Specified in
`tasks/024-error-tracking-privacy-scrubbing.md`; decision recorded in
`docs/adr/0019-runtime-error-logging.md`.

**Nothing was observable before this task.** No route handler caught an
unexpected exception at all: a genuine runtime failure (a DB error, a
connection drop) was invisible to this project, not merely unscrubbed.
`ARCHITECTURE.md`'s "Error tracking" entry names "Sentry or equivalent";
no account or DSN exists or can be created from this session.

**First-party structured logging, the same resolution shape as TASK-021
and TASK-023.** `lib/observability/log-runtime-error.ts` emits one
structured JSON line to `console.error`, which Vercel's own log pipeline
already captures — no new service, account, or environment variable. A
real Sentry (or equivalent) integration can later replace this one
function's body without any call site changing.

**Leakage prevented by construction, not by inspecting a request
afterward.** No call site ever hands the logger a request object, a
parsed body, or a coordinate — only a fixed `LogContext` label and
whatever was actually thrown. This was proven directly: a report smoke
test deliberately placed a coordinate-looking string inside a report's
free-text `note`, and it never reached any log line, because the failure
(a rate-limit DB check) happened before the request body was even parsed.
`scrubSensitiveText` is a second, defense-in-depth layer for the one case
that still carries text this project did not itself write — an
unexpected database driver error — redacting a coordinate pair or a
`lat`/`lng`/`lon`-keyed number; a bare decimal (a price, an ETA) is left
alone.

**A real gap found by this task's own verification, not left for later.**
Forcing a genuine failure (stopping Postgres under a running production
build, per the task's own verification requirement) surfaced a second
failure mode no per-route `try`/`catch` could reach: an idle client
already sitting in the connection pool can fail with no request in
flight at all, and `node-postgres` turns an unhandled listener for this
into an uncaught exception — observed directly as a large, unstructured
`Client` object dumped straight to `stderr`. `db/client.ts`'s `getPool()`
now attaches `pool.on('error', ...)`, routed through the same
`logRuntimeError`, closing this gap rather than leaving "runtime errors
are observable" false for the failure mode most likely during an actual
database outage. `db/queries/analytics.ts`'s own doc comment (written
during TASK-023) had already named this task as where its silently
swallowed write failure would stop being silent; its `catch` now logs
too, with no change to its established never-throws contract.

Created: `lib/observability/scrub-sensitive-text.ts`,
`lib/observability/log-runtime-error.ts` (`LogContext`, `LOG_CONTEXTS`).
A `try`/`catch` added around each of `app/api/toilets/nearby/route.ts`,
`app/api/toilets/[id]/reports/route.ts`, and
`app/api/analytics/events/route.ts`'s existing bodies, each returning one
generic `{ error: 'Unexpected server error.' }` `500` on an unexpected
throw. `db/client.ts`'s `getPool()` gained `attachPoolErrorLogging`
(exported separately for unit testing, mirroring `lib/env/server.ts`'s
`parseServerEnv`/`getServerEnv` split). `db/queries/analytics.ts`'s
existing swallowed `catch` now logs via `logRuntimeError`.

Verified: lint, format, typecheck, 269 unit tests (12 new —
`scrubSensitiveText`'s coordinate-pair and keyed-value redaction plus its
refusal to touch a bare decimal, `logRuntimeError`'s structured output and
its own redaction of a coordinate that ends up in an error message, and
`attachPoolErrorLogging`'s wiring using a real, never-connected `Pool`
instance), 46 integration tests unchanged (the existing suite already
exercises `insertAnalyticsEvent`'s error path, which now also emits a
visible log line — confirmed in the test's own captured `stderr`, not
merely inferred), the production build, and all 19 Playwright tests
passing unmodified (no user-visible change; every existing 400/404/429
path is an existing `return`, never touched by this task's `catch`
blocks). Independently confirmed with a real forced-failure smoke test
against a running production build and a real PostgreSQL database:
stopping Postgres produced a clean `{"level":"error","source":"db/client.ts:pool",...}`
line (not the raw, uncaught-exception dump observed before the pool fix),
then a `500 { "error": "Unexpected server error." }` from both
`/api/toilets/nearby` and `/api/toilets/[id]/reports` with a matching
structured log line for each, and `/api/analytics/events` still returning
its normal `201` (its own write failure is swallowed by design, now
logged rather than silent) — a report request's `note` deliberately
containing a coordinate-shaped string never appeared in any log line.
Postgres and the smoke-test server were restored/stopped afterward, and
smoke-test rows were deleted.

Not created, by design: adoption of a named third-party error-tracking
provider (no account/DSN exists to configure one honestly), request
tracing, breadcrumbs, or source-map upload (a real Sentry-equivalent's
eventual features, not this task's minimum), and any change to client-side
error handling (`fetchNearbyToilets`, `submitReport`, `reportEvent` already
never throw, which is correct and outside this task's scope).

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
| `pnpm test:unit`          | pass, 269 tests in 38 files                          |
| `pnpm build`              | pass, `/pl` and `/en` prerendered as static HTML      |
| `pnpm db:migrate`         | pass, both migrations applied to an empty database   |
| `pnpm db:check`           | pass, `PostGIS OK — installed version 3.4.2`         |
| `pnpm test:integration`   | pass, 46 tests in 8 files                            |
| `pnpm test:e2e`           | pass, 19 tests in the `mobile-chromium` project (map fallback, location ask/deny/grant, nearby-fetch interception, nearest-toilet preview, toilet detail sheet + navigation CTA + price amount + payment rows, real opening-status colour, list view, filter sheet, the three no-results states, a real out-of-Warsaw location grant, the report flow's success and failure/retry states, and client-triggered analytics events reaching the endpoint) |

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
- `playwright.config.ts`'s `webServer` uses `reuseExistingServer:
  !process.env.CI` against a real production build on port 3100, backed by
  this environment's real `DATABASE_URL`. Discovered during TASK-024's own
  verification: since TASK-023 added `app_opened` firing unconditionally
  on every `MapShell` mount, any e2e test that does not explicitly mock
  `/api/analytics/events` sends a real request to that reused server,
  writing a real row. Observed directly: running `pnpm test:e2e` twice
  left 34-35 genuine `analytics_events` rows (`app_opened`,
  `location_granted`/`denied`, `toilet_selected`, and even `no_results`
  from at least one unmocked nearby fetch) plus one real
  `report_rate_limit_windows` row. Not a privacy defect — the table holds
  no location or identifying data by design — but a real test-isolation
  gap in TASK-023's own e2e coverage, out of scope to fix under TASK-024.
  All such rows were deleted after each verification run in this session;
  a future task touching e2e infrastructure should mock
  `/api/analytics/events` (and any other now-instrumented endpoint)
  globally rather than per-test.
- Restarting the local Postgres cluster (`pg_ctlcluster 16 main stop` then
  `start`) can leave the very next `pnpm test:integration` run seeing
  extra, pre-existing rows in a table an unrelated test just inserted
  into moments earlier, self-resolving on an immediate re-run with the
  table verified empty. Observed twice this session (TASK-023 and
  TASK-024), both times immediately after a cluster restart; the cause was
  not isolated further since it self-heals and `fileParallelism: false`
  already serialises integration test files. Re-run once if a fresh
  cluster restart precedes a flaky integration count.

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
2. `TASK-025 — Performance pass` per `PLAN.md` (Milestone 4 — Product
   quality): "measured mobile performance meets agreed budgets or has
   documented remaining constraints." Needs a `tasks/025-*.md` file.
   `PRODUCT.md` section 16 names the target experience but deliberately
   sets no numbers yet: "app shell becomes interactive quickly," "map
   library should not block the first meaningful call-to-action
   unnecessarily," "nearby query should normally complete fast enough to
   feel immediate after geolocation," "avoid downloading all Warsaw toilet
   data if a bounded nearby query is sufficient," "lazy-load non-critical
   visuals" — and says explicitly that "concrete performance budgets
   should be added during foundation/performance tasks after baseline
   measurement," making this task's first real step a measurement, not an
   optimisation. `ARCHITECTURE.md` section 15 (Caching) already sets the
   one binding constraint this task must not weaken: `no-store` on the
   nearby search response, never a shared cache keyed by precise
   coordinates — any performance work here must stay inside that, e.g.
   caching static/config data and map provider assets per section 15's own
   list, not the location-bearing response itself. A real Lighthouse/mobile
   performance run needs a real running production build (this session's
   own `pnpm build && pnpm start` pattern already proven every prior task)
   and, ideally, the same real `NEXT_PUBLIC_MAPTILER_KEY`/tile access named
   in item 1 above, since the map library is one of section 16's own named
   risks to the first meaningful call-to-action.

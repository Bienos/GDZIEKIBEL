# ADR 0002 — Warsaw toilet data sources

Status: Accepted, with one blocker recorded
Date: 2026-09-13
Scope: TASK-002 — Data-source research and source decision

Evidence: `docs/research/2026-09-13-task-002-live-observations.md` (live
observations, with URLs and times) and
`docs/research/2026-09-13-warsaw-toilet-sources.md` (desk research, treated as
hypothesis). Where this ADR states a fact, the observation file holds the
quote or the query it comes from.

## Context

`ARCHITECTURE.md` 13 gives each source an adapter and 23 lists "exact Warsaw
datasets and licences" among the decisions still requiring validation.
`PLAN.md` makes TASK-003 (schema, first source contract) and TASK-004 (ingest
first dataset) depend on this decision.

Four candidate sources were examined against the live services on 2026-09-13:

1. the Warsaw city open-data toilet dataset (`dane.um.warszawa.pl`, legacy
   `api.um.warszawa.pl`);
2. OpenStreetMap (`amenity=toilets` and venue `toilets=*` tags);
3. the Warsaw Metro rule published by the city (all stations, 06:00–22:00,
   free, outside the ticket zone);
4. PKP railway station information pages.

The city hosts could not be reached from the verification environment at all:
the connection is reset at the TLS handshake after the proxy opens the tunnel,
on every attempt, and an alternative fetch path returned HTTP 503. No dataset
identifier, schema, count, cadence or licence was observed. The task rules say
an unverified licence blocks ingestion and that a missing licence is not
permission.

OpenStreetMap was reachable. Its licence, attribution rules and tagging
conventions were read at source, and an element count for Warsaw was observed.

## Decisions

### D1. First ingestion sources for TASK-004

TASK-004 ingests, in this order:

1. **OpenStreetMap `amenity=toilets` elements inside the Warsaw administrative
   boundary**, from a periodic extract (D3). This is the first bulk source.
2. **Two curated source rules**, maintained as versioned files in the
   repository, not fetched:
   - the **metro rule** from the city's 19115 page (D5);
   - the **transport-hub layer** for PKP stations (D6).

The **Warsaw city toilet dataset is not a TASK-004 source.** It stays the
intended authoritative source for existence, address, opening hours, fee and
accessibility of city-listed facilities, and it is to be added as soon as the
ten acceptance items in `tasks/002-data-source-research.md` are observed
against the live service. Until then no adapter for it is written and no field
in the product is sourced from it. This is the blocker recorded in
`PROGRESS.md`.

Reason: the city dataset is the higher-value source on paper, but nothing
about it has been observed, including its licence. OSM is the only candidate
whose terms were read and whose contents were counted. Building the pipeline
on the verified source, with the city dataset joining through the same
adapter contract once verified, does not lose the city data; it delays it
until it can be ingested lawfully.

Which city service to consume, when reachable: `dane.um.warszawa.pl`. The
city states on 19115 that it "całkowicie zastąpi" the legacy service. The
legacy service is only a fallback for reading, and only until the new one
carries the dataset. Both are to be recorded when first observed.

### D2. OSM licence, attribution and share-alike

OSM data is under the ODbL. Attribution is mandatory wherever the product
shows OSM-derived content, in the form the OSMF guidelines prescribe: the text
"OpenStreetMap" linked to `openstreetmap.org/copyright`, visible without
interaction, in a map corner or adjacent to the result list, plus an ODbL
notice in any database or export the project publishes.

Share-alike. The product database combines OSM toilet features with non-OSM
facts (curated rules, later the city dataset and user reports) about the same
real-world toilets, and the deduplication step in `ARCHITECTURE.md` 14 uses
OSM records to decide which other records describe the same facility. The
sources read say, in the OSMF Legal FAQ, that a database "which includes OSM
data and any additional information (including using information to decide on
OSM features NOT to include in your database)" is a Derivative Database; the
Collective Database guideline's own third example (a proprietary list
"complement[ed] with the corresponding data from OpenStreetMap removing any
duplicate objects") is stated as not covered by that guideline; and the
Horizontal Layers guideline says share-alike applies when OSM and non-OSM data
are used together "for a given Feature Type".

Conclusion: **plan on the toilet layer of the product database being a
Derivative Database under the ODbL.** Concretely:

- the canonical toilet table and the OSM-derived source records are designed
  so they can be published under the ODbL on request, as a dump or a diff
  against the OSM input, which the Legal FAQ lists as acceptable forms;
- non-OSM facts merged into the same toilet records (city, curated, user) are
  therefore to be treated as potentially share-alike-bound, so they must not
  come from a source whose terms forbid redistribution under the ODbL;
- user reports remain a separate table (`toilet_reports`,
  `ARCHITECTURE.md` 5.3) and are not merged into the shared layer until
  reviewed, which also keeps personal data out of any dump.

This conclusion is the conservative reading and it is **flagged for legal
review** before public launch. The alternative reading, that per-field
sourcing keeps the combination a Collective Database, is supported by the
Collective Database guideline's "property of a primary feature" clause only
where a property is sourced entirely from non-OSM data within Warsaw; the
field-level table in D7 is written so that this can be argued field by field
if counsel prefers that route. The ODbL legal text itself was not readable
from the verification environment, so clause numbers are cited only as they
appear in OSMF guideline pages.

### D3. Periodic extract, not live Overpass

Ingestion of OSM data uses a **periodic extract**: a scheduled job produces a
Warsaw toilet snapshot and the adapter reads the snapshot. No request path of
the application calls Overpass, Nominatim or any other public OSM service.

Reasons, from what was observed:

- the public Overpass instance's own policy says regular use must stay under
  about 100 queries and 10 MB per day summed over all users, that "commercial
  use should use self-hosted or paid Overpass servers", and that the server
  "is overloaded … do not expect high reliability";
- during verification the instance returned HTTP 429 once and HTTP 504
  "server is probably too busy" on most area queries, and every other public
  instance was unreachable from the environment;
- the Nominatim policy forbids "downloading all POIs in an area";
- the whole Warsaw set is 562 elements, which is small enough that a weekly
  snapshot is more data than the product needs, not less.

Preferred extract mechanism: a country or region PBF extract (the OSM wiki
names daily Geofabrik extracts) filtered with `osmium` to the Warsaw boundary
and toilet tags. `download.geofabrik.de` was not reachable during
verification, so TASK-004 verifies the extract path itself. If the PBF route
is not workable in the TASK-004 environment, the fallback is **one** scheduled
Overpass query per ingestion run, at most weekly, sending an identifying
`User-Agent`, and stopping on HTTP 429/504 rather than retrying in a loop.
That fallback is within the quoted regular-use numbers but it is a fallback,
not the design.

Cadence: weekly. `ARCHITECTURE.md` 13 forbids scheduling more often than the
source's cadence justifies; OSM changes continuously but a toilet layer does
not need more than that, and the extract is the rate-limiting artefact.

### D4. Area definition

Warsaw is OSM relation **336074** (`boundary=administrative`,
`admin_level=8`, `name=Warszawa`, `wikidata=Q270`). Relations 336075
(`admin_level=6`) and 2907540 (`admin_level=7`) describe the same city at
county and municipality level and may be used interchangeably if 336074 is
ever unavailable, with the substitution recorded in the ingestion run. The
bounding box `52.0979,20.8512,52.3679,21.2711` is a probe convenience only.

### D5. Metro source rule

Source rule `metro-warszawskie`, recorded from
https://warszawa19115.pl/web/guest/-/automatyczne-toalety-miejskie (page
updated 2026-09-10, observed 2026-09-13): every metro station has a publicly
accessible toilet, open daily 06:00–22:00, outside the ticketed zone, free of
charge, operated at Metro Warszawskie's cost.

The rule is applied to station features, not to a list of coordinates typed
by hand: TASK-004 attaches it to OSM elements tagged as Warsaw Metro stations
(`station=subway` within relation 336074). The number of stations was not
observed and is not stated here. The rule carries its source URL, the page's
update date and the observation date, so it can be re-verified and expired.
The operator's site (`metro.waw.pl`) was blocked and was not consulted.

### D6. Transport-hub layer instead of a PKP feed

No structured feed for station toilet data was found on `pkp.pl`; the station
pages and the accessibility search are HTML. Therefore a **manually curated
hub layer** replaces it, as a versioned file of records each carrying a source
URL and observation date.

Initial size: **three records**, the only stations with a toilet fact observed
on 2026-09-13:

| Station            | Observed                                                                         |
| ------------------ | -------------------------------------------------------------------------------- |
| Warszawa Zachodnia | toilets 03:20–24:00, technical break 00:00–03:20; cash and card; no price stated |
| Warszawa Wschodnia | long-distance hall 24 h; suburban hall 06:00–20:00; 4,50 zł                      |
| Warszawa Centralna | a publicly accessible toilet adapted for reduced mobility; no hours or price     |

Candidate stations for later curation, from PKP's own Warsaw station list:
Gdańska, Ochota, Powiśle, Rembertów, Śródmieście, Stadion, Ursus, Wileńska,
WKD Śródmieście, Włochy — ten stations with no toilet fact observed yet. A
station enters the layer only when a fact for it has been observed and cited.

### D7. Field-level source table

"Authoritative" is the source whose value wins when sources conflict.
"Fallback" is used when the authoritative source has no value. A source that
is absent is recorded as unknown; it is never turned into `false`. The city
dataset appears where the product intends it to be authoritative, but it is
**pending** and contributes nothing until verified (D1).

| Product field (`ARCHITECTURE.md` 5.1) | Authoritative now                   | Fallback now                      | Intended once city dataset verified                      |
| ------------------------------------- | ----------------------------------- | --------------------------------- | -------------------------------------------------------- |
| existence (a canonical toilet exists) | OSM `amenity=toilets`               | curated hub layer, metro rule     | city dataset for city-listed facilities; OSM for the rest |
| `geom`                                | OSM node position / way centroid    | curated hub record coordinates    | unchanged; city coordinates compared, not copied, until reviewed |
| `name`                                | OSM `name`                          | curated record name; else derived from station/venue | city name for city-listed facilities            |
| `address`, `district`                 | OSM `addr:*` where present          | curated record address            | city dataset                                              |
| `access_type` / `public_access`       | metro rule and curated layer for their facilities; else OSM `access` | unknown | city dataset (agreement with the city implies public access) |
| `price_state`, `price_amount_minor`, `currency` | curated layer for PKP stations; metro rule (free); else OSM `fee`, `charge` | unknown | city dataset fee field                       |
| `opening_hours_raw` / `_normalized`, `open_24h` | metro rule and curated layer for their facilities; else OSM `opening_hours` | unknown | city dataset hours for city-listed facilities |
| `wheelchair_accessible`               | OSM `wheelchair`                    | curated layer (Centralna fact)    | city dataset accessibility field                          |
| `baby_changing`                       | OSM `changing_table`                | unknown                           | city dataset changing-table field                         |
| `unisex`                              | OSM `unisex` / `gender_segregated`  | unknown                           | unchanged                                                 |
| `seasonal`, `canonical_status`        | OSM presence in the latest extract (absence after presence → candidate `removed`, reviewed) | curated record validity dates | city dataset, if it represents removal; unverified |
| `verified_at`, confidence             | derived from source dates and, later, reviewed user reports | –        | unchanged                                                 |
| entrance / finding note               | curated layer                       | OSM `description`, `level`        | unchanged                                                 |

Every value keeps its provenance in `toilet_source_records`
(`ARCHITECTURE.md` 5.2): source name, source record id, source URL, source
timestamp where one exists, and fetch time.

### D8. Licence compatibility of the chosen combination

Chosen sources: OSM (ODbL) plus two curated files of facts observed on city
and PKP public information pages.

- OSM: terms read; attribution and share-alike obligations accepted as in D2.
- Curated facts (opening hours, prices, addresses, the metro rule): recorded
  as short factual statements with their source URL and date, not as copied
  page text. No reuse terms for `warszawa19115.pl` or `pkp.pl` pages were
  read, and none were found on the pages fetched. The project treats these as
  facts it may state with citation, and flags this for the same legal review
  as D2.
- User reports: the project's own data, under its own terms; kept separable
  from the shared layer.

Conclusion: the combination is compatible provided the combined toilet layer
is offered under the ODbL (D2). No chosen source imposes a term that
conflicts with that. The city dataset is excluded from this conclusion
because its terms are unobserved; adding it requires reading its licence and
checking that redistribution under the ODbL is permitted, or, if it is not,
keeping it as an independent, unmerged layer.

## Consequences

- TASK-003 designs the schema for OSM-derived source records plus curated
  rule records, with per-field provenance, and leaves room for a city adapter
  that does not exist yet.
- TASK-004 implements the OSM extract adapter, the metro rule and the hub
  layer, and does not touch the city hosts except to re-run the verification
  probe.
- The application must show OSM attribution from the first screen that shows
  toilet data, and must be able to produce an ODbL dump of the toilet layer.
- Public Overpass and Nominatim are excluded from production code paths.
- `PROGRESS.md` carries the city-dataset blocker until the ten items are
  observed.

## Not decided here

- Deduplication thresholds (`ARCHITECTURE.md` 14) — real data first.
- Tile provider, analytics provider — unchanged from ADR 0001.
- Whether the metro rule and hub facts should later be replaced by an
  operator feed if one appears.

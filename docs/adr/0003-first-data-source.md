# ADR 0003 — OpenStreetMap is the first toilet data source; the city dataset is deferred

Status: Accepted, with observation gaps listed in section 6
Date: 2026-09-13
Scope: TASK-002 — Data-source research and source decision
Contract: `docs/contracts/osm-toilets-source.md`

## 1. Context

`docs/research/2026-09-13-warsaw-toilet-sources.md` inventories the candidate
sources: the Warsaw city open-data toilet dataset, OpenStreetMap, PKP station
pages, private venues, and user reports. It names the city dataset the
highest-value source for Warsaw and, in its own limitations section, states
that the dataset's endpoint, schema and licence were not verified against the
live service.

TASK-002 set out to close that gap. On 2026-09-13, from a cloud environment
that permits the hosts, all 16 catalogue requests returned HTTP 503: both
`api.um.warszawa.pl` and `dane.um.warszawa.pl`, both CKAN API paths, all four
search terms. Overpass answered HTTP 200 in the same run.

The project owner decided the same day not to block the roadmap on a service
nobody can reach.

## 2. Decision

1. **OpenStreetMap is the first ingestion source** for TASK-004, under the
   contract in `docs/contracts/osm-toilets-source.md`.
2. **Acquisition is a scheduled, bounded Overpass pull** from GitHub Actions,
   weekly, with a Geofabrik extract as the fallback. Never per request.
3. **The ingestion area is the Warsaw administrative boundary**, not a bounding
   box.
4. **Metro and major railway stations are a hand-curated anchor layer**, entered
   from the official pages the research cites, each row carrying the page URL
   and the date it was read. No structured feed for them has been found, and
   `warszawa19115.pl` and `pkp.pl` were not re-read in the session that wrote
   this record.
5. **The Warsaw city dataset is deferred.** Section 4 records what is known,
   which is only that it did not answer.

## 3. Field-level source decision

Record-level source priority is not enough: different sources are best for
different fields, and the research's section 6 says so. This table is what
TASK-003 designs the schema around and what TASK-004 implements for the first
source.

| Field | First source, now | Fallback, now | Added when the city dataset lands |
| --- | --- | --- | --- |
| Existence | OSM `amenity=toilets` | hand-curated anchors | city record, preferred for municipal toilets |
| Position | OSM element | anchors | city, preferred where both exist and agree |
| Name, operator | OSM tags | anchors | city, preferred for municipal |
| Opening hours, raw | OSM `opening_hours` | anchors for metro and stations | city, preferred for municipal |
| Fee state | OSM `fee` | anchors | city |
| Payment methods | OSM `payment:*` | anchors for stations | city where present |
| Access type | OSM `access` | anchors | city agreements, preferred for private venues |
| Wheelchair | OSM `wheelchair` | none | city |
| Changing table | OSM `changing_table` | none | city |
| Gender availability | OSM `male`/`female`/`unisex` | none | city where present |
| Level, indoor | OSM `level`, `indoor` | none | none expected |
| Entrance note | none from OSM beyond `description` | anchors, written by hand | user reports, TASK-020 |
| Temporary closure | none | none | city, and user reports |
| Last verified | OSM `check_date` | anchor read date | city timestamp, and user reports |
| Confidence | computed, TASK-019 | | |

Two rules apply to every row:

- an absent value is unknown, never `no`, `free` or `open`;
- when two sources disagree on a field, both source records are kept and the
  conflict is surfaced, not silently resolved. `ARCHITECTURE.md` section 14 and
  the research's section 5.5 both require this.

## 4. Deferred: the Warsaw city open-data toilet dataset

This is a deferral, not an evaluation. Nothing about the dataset has been
observed.

**What was observed, 2026-09-13, from the project's cloud environment**, as
reported by the project owner from the probe's output:

- 16 requests to `package_search` returned HTTP 503:
  `https://api.um.warszawa.pl` and `https://dane.um.warszawa.pl`, at
  `/api/3/action/package_search` and `/api/action/package_search`, for the terms
  `toaleta`, `toalety`, `szalet` and `WC`;
- the response bodies were not captured in that run, because the probe version
  used did not yet record them. The current probe does.

**What remains unverified**, all of it:

- whether either host is the current platform, and whether either exposes a
  CKAN API at all;
- the dataset identifier, endpoint, authentication requirement, field list,
  example record, record count, refresh cadence, pagination, rate limits;
- whether removed facilities are represented and whether a per-record
  timestamp exists;
- whether operational status is exposed separately from opening hours;
- the licence and reuse terms.

**What a future task must do** to close this:

1. run `pnpm research:probe` from an environment that reaches the hosts and read
   the failure bodies the probe now records;
2. if the bodies say the platform is not CKAN, find the documented API on
   `dane.um.warszawa.pl` and rewrite the probe against it;
3. observe every item in the list above, with URL and date;
4. read the licence and quote it;
5. write an adapter to the same contract shape, so the city becomes a second
   source under `ARCHITECTURE.md` section 13, and dedup against OSM under
   TASK-022.

**What the deferral costs**, from the research: the city's agreements with
private venues, official hours for municipal toilets, and the metro rule as an
official record rather than a hand-entered anchor.

## 5. Licence

**OpenStreetMap.** The research states the data is under ODbL with attribution
and share-alike obligations, citing the Legal FAQ and the OSMF attribution
guidelines. The session that wrote this record could not reach those pages.
The licence name, version and attribution wording are therefore **UNVERIFIED**
here and are recorded as needing a live read with a date. They are the first
item to close in section 6.

**Share-alike.** Flagged for legal review; not asserted. The contract's section
9 sets out the two designs. TASK-003 builds so that OSM-derived source records
stay physically separable from other sources, which costs nothing and keeps
both designs open.

**Compatibility of the chosen combination.** For TASK-004 the only source is
OSM plus a hand-curated anchor layer authored by the project. No compatibility
question arises until a second licensed source is added, at which point this
ADR is superseded.

## 6. Observation status

| Item | Status | Closes when |
| --- | --- | --- |
| Overpass reachable from the cloud environment | OBSERVED 2026-09-13 | closed |
| `amenity=toilets` count, probe bbox | UNVERIFIED; value not carried into the repository | `pnpm research:probe -- --full`, value pasted here with the query |
| `toilets=*` venue count | UNVERIFIED, HTTP 504 on the only run | same run |
| Tag coverage for the section 3 fields | UNVERIFIED | same run |
| ODbL text, version, attribution wording | UNVERIFIED | live read, quoted, dated |
| Warsaw admin boundary relation id | UNVERIFIED | TASK-004 |
| Share-alike design choice | legal review pending | review, then this ADR is amended |
| City dataset, everything | UNVERIFIED, deferred | a future task per section 4 |

The coverage numbers matter more than the counts. They say what share of
Warsaw toilets the product can state an opening time or an access rule for,
which is the difference between a usable answer and a map pin.

## 7. Consequences for TASK-003

- A `source_records` table keyed by source name plus external id plus version,
  with the raw payload, a `first_seen`, `last_seen` and `not_seen_since`.
- Canonical toilet fields use tri-state or enumerated values with an explicit
  `unknown`. No boolean may default to `false`.
- Raw `opening_hours` text is stored; nothing parses it before TASK-013.
- OSM-derived rows are identifiable as such and separable, per section 5.
- The hand-curated anchor layer is a source like any other, with its own source
  name, so it dedups and conflicts like any other.
- Adding the city dataset later means one more adapter and one more source
  name, not a schema change.

## 8. Superseded when

Any of: the city dataset is observed and ingested; legal review resolves
share-alike; a second licensed source is added; the Overpass pull is replaced by
extracts.

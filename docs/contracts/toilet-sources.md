# Contract — toilet source adapters

Status: Accepted for TASK-003/TASK-004
Date: 2026-09-13
Decided by: `docs/adr/0002-toilet-data-sources.md`
Evidence: `docs/research/2026-09-13-task-002-live-observations.md`

This contract states what each chosen source provides and the shape the
ingestion adapter consumes. It does not define database tables (TASK-003) or
the pipeline (TASK-004). It follows `ARCHITECTURE.md` 13: each source is an
adapter that runs `fetch -> validate -> normalise -> stage/match -> upsert
source record -> reconcile canonical toilet`, and the source record keeps
provenance per `ARCHITECTURE.md` 5.2.

## 1. Common normalised record

Every adapter emits zero or more `SourceToiletRecord`s. Unknown is `null`.
An adapter never emits `false` for a value the source did not state.

Executable definition: `lib/toilets/source-record.ts` (Zod schema and
`parseSourceToiletRecord`). Storage: one row per record in
`toilet_source_records` (migration `1789302217027_toilet-schema.sql`, ADR 0003),
with the parsed record in `normalized_payload`, the source element in
`raw_payload`, and `source_name`, `source_record_id`, `source_url`,
`source_updated_at`, `fetched_at` as columns. Canonical values land in
`toilets` after reconciliation (TASK-004).

```text
SourceToiletRecord
  source_name          'osm' | 'metro-rule' | 'hub-curated'      (city adapter: not yet)
  source_record_id     stable id within the source (see per-source rules)
  source_url           URL a person can open to see this record's origin
  source_updated_at    timestamp the source gives for the record, or null
  fetched_at           when the adapter read it
  position             { lat, lon } WGS84, required
  position_kind        'point' | 'centroid' | 'station'   how the point was obtained
  name                 string | null
  operator             string | null
  address              { street, housenumber, city, postcode } with nulls | null
  access               'public' | 'customers' | 'permissive' | 'private' | 'no' | null
  fee                  'free' | 'paid' | null
  price                { amount_minor, currency } | null
  payment              { cash: bool|null, cards: bool|null, coins: bool|null, contactless: bool|null } | null
  opening_hours_raw    string | null      verbatim source expression
  opening_hours_format 'osm' | 'text' | null
  wheelchair           'yes' | 'no' | 'limited' | 'designated' | null
  changing_table       'yes' | 'no' | 'limited' | null
  unisex               'yes' | 'no' | null
  level                string | null
  indoor               bool | null
  portable             bool | null
  description          string | null
  raw_payload          the source element as received (OSM) or the curated row
  licence              'ODbL-1.0' | 'curated-fact'
  attribution          'OpenStreetMap' | null
```

`opening_hours_raw` is stored verbatim and parsed later; `is_open_now` is
computed, never stored (`ARCHITECTURE.md` 10).

## 2. Source: `osm` — OpenStreetMap `amenity=toilets`

### Provides

OSM elements tagged `amenity=toilets` inside the Warsaw administrative
boundary, OSM relation `336074`. Observed on 2026-09-13: 562 elements inside
the relation (448 nodes, 114 ways, 0 relations); 604 inside the probe bounding
box. Coverage of the tags this contract maps, over the 604 bounding-box
elements, is in the observation file section 2.5; the short version is that
`fee` (70%) and `wheelchair` (68%) are usually present, `changing_table` (44%),
`access` (32%) and `opening_hours` (27%) often are not, and `name` almost never
is (0.8%).

### Input

A snapshot file produced by the periodic extract (ADR 0002 D3): either a PBF
extract filtered to the boundary, or, as fallback, a single Overpass JSON
response for

```
[out:json][timeout:180];
area(3600336074)->.w;
nwr["amenity"="toilets"](area.w);
out center tags;
```

The adapter reads the file. It never calls a public OSM service from a request
path.

### Mapping

| Record field           | OSM tag(s)                                                                                       |
| ---------------------- | ------------------------------------------------------------------------------------------------ |
| `source_record_id`     | `<type>/<id>` e.g. `node/123`, `way/456`                                                          |
| `source_url`           | `https://www.openstreetmap.org/<type>/<id>`                                                       |
| `source_updated_at`    | element `timestamp` if the snapshot carries metadata, else `null`; `check_date` is kept in raw only |
| `position`             | node `lat`/`lon`; way or relation `center` (`position_kind = 'centroid'`)                        |
| `name`                 | `name`                                                                                            |
| `operator`             | `operator`                                                                                        |
| `address`              | `addr:street`, `addr:housenumber`, `addr:city`, `addr:postcode`                                   |
| `access`               | `access`: `yes`→`public`, `permissive`→`permissive`, `customers`→`customers`, `private`→`private`, `no`→`no`; absent or other→`null` |
| `fee`                  | `fee`: `no`→`free`, `yes`→`paid`; absent→`null`                                                   |
| `price`                | `charge` parsed only when it is `<number> PLN`; otherwise `null` and the raw text stays in `raw_payload` |
| `payment`              | `payment:cash`, `payment:cards`, `payment:coins`, `payment:contactless` (`yes`/`no` only)          |
| `opening_hours_raw`    | `opening_hours`, `opening_hours_format = 'osm'`                                                    |
| `wheelchair`           | `wheelchair` (`yes`/`no`/`limited`/`designated`)                                                  |
| `changing_table`       | `changing_table` (`yes`/`no`/`limited`)                                                           |
| `unisex`               | `unisex`                                                                                          |
| `level`, `indoor`      | `level`; `indoor=yes`→`true`, `indoor=no`→`false`                                                 |
| `portable`             | `portable=yes`→`true`, `portable=no`→`false`                                                      |
| `description`          | `description`                                                                                     |
| `licence`, `attribution` | `'ODbL-1.0'`, `'OpenStreetMap'`                                                                 |

Elements with `access=private` or `access=no` are still emitted as source
records, with that access value, so the ranking layer can exclude them; they
are not dropped at ingestion, because the wiki says such toilets should not be
tagged `amenity=toilets` at all and a later mapper may fix the tag.

Venue toilets (`toilets=*` on other features, 224 elements observed in the
bounding box) are **not** part of the first adapter. The contract reserves
`source_name = 'osm-venue'` for them; adding it needs a second mapping
(`toilets:access`, `toilets:wheelchair`, `toilets:fee`, `toilets:charge` per
the OSM wiki) and a decision on how venue opening hours apply.

### Removal

An element present in a previous snapshot and absent from the current one is
marked as a removal candidate in the source record; the canonical toilet is
not set to `removed` automatically. Deletion semantics are TASK-004's to
implement and TASK-003's to model.

### Obligations carried with the data

- Attribution "OpenStreetMap" linked to `https://www.openstreetmap.org/copyright`
  wherever OSM-derived toilets are shown, and an ODbL notice in any export.
- The toilet layer is treated as an ODbL Derivative Database (ADR 0002 D2);
  the adapter keeps `raw_payload` so a diff against the input can be produced.
- Source data is not edited by hand. Corrections learned from the product go
  back as user reports or as OSM edits, not as silent changes to the snapshot.

## 3. Source: `metro-rule` — Warsaw Metro station toilets

### Provides

One rule, not a list of records. Stated by the city on
https://warszawa19115.pl/web/guest/-/automatyczne-toalety-miejskie (page
updated 2026-09-10, observed 2026-09-13):

- every metro station has a publicly accessible toilet;
- daily, 06:00–22:00;
- outside the ticketed zone;
- free.

### Input

A versioned file in the repository, `metro-rule.json` (location decided by
TASK-004), holding the rule with `source_url`, `source_page_updated_at =
2026-09-10`, `observed_at = 2026-09-13`, and `valid_until = null`. The rule is
re-verified against the page on each ingestion run's schedule; a changed page
does not change the rule automatically, it flags it.

### Mapping

The adapter applies the rule to station features from the OSM snapshot
(`railway=station` + `station=subway` inside relation 336074), one record per
station:

| Record field          | Value                                                                           |
| --------------------- | ------------------------------------------------------------------------------- |
| `source_record_id`    | `metro/<osm type>/<osm id>` of the station feature                              |
| `source_url`          | the 19115 page URL                                                              |
| `position`            | station feature position, `position_kind = 'station'`                          |
| `name`                | `Toaleta, stacja metra <station name>` derived from the station's `name`        |
| `operator`            | `Metro Warszawskie Sp. z o.o.`                                                  |
| `access`              | `public`                                                                        |
| `fee`                 | `free`                                                                          |
| `opening_hours_raw`   | `Mo-Su 06:00-22:00`, `opening_hours_format = 'osm'` (the page's "codziennie … 6:00 - 22:00" rendered in OSM syntax) |
| `description`         | `Poza strefą biletową` (from the page)                                          |
| `licence`             | `curated-fact`                                                                  |
| everything else       | `null`                                                                          |

The station list is derived from OSM, so the station positions carry the OSM
obligations above. The number of stations was not observed in TASK-002 and the
adapter reports it per run.

Where an OSM `amenity=toilets` element already exists at a station (the
observed data contains 18 elements with operator `Metro Warszawskie Sp. z
o.o.`, all with `Mo-Su 06:00-22:00` and `fee=no`), reconciliation treats the metro-rule record as
authoritative for access, fee and hours (ADR 0002 D7) and the OSM element as
authoritative for position and facilities.

## 4. Source: `hub-curated` — transport-hub layer

### Provides

Hand-maintained records for railway stations, each a set of facts observed on
an official page, with the page URL and observation date. Initial content, all
observed on 2026-09-13 on `www.pkp.pl`:

| `source_record_id`   | Facts                                                                                    |
| -------------------- | ---------------------------------------------------------------------------------------- |
| `pkp/warszawa-zachodnia` | position 52.218857, 20.965947 (from the page); hours `03:20-24:00` with technical break `00:00-03:20`; payment cash and card; price not stated |
| `pkp/warszawa-wschodnia-dalekobiezna` | ul. Kijowska 20; hours 24 h; price 4,50 zł                                    |
| `pkp/warszawa-wschodnia-podmiejska`   | ul. Lubelska 24; hours `06:00-20:00`; price 4,50 zł                           |
| `pkp/warszawa-centralna`              | Aleje Jerozolimskie 54; publicly accessible toilet adapted for reduced mobility; hours and price not stated |

Wschodnia is two records because the page gives two halls with different
hours. Positions for Wschodnia and Centralna were not stated on the pages
observed and must be filled from the OSM station feature or a later
observation, with the method recorded in `position_kind`.

### Input

A versioned file, `hubs.json` (location decided by TASK-004). Every row has
`source_url`, `observed_at`, and only the fields the page stated; the rest are
`null`. A row without a `source_url` is invalid and the adapter rejects it.

### Mapping

Direct: the row already uses the record fields. `opening_hours_raw` holds the
page's wording with `opening_hours_format = 'text'` when it cannot be expressed
losslessly in OSM syntax (the Zachodnia technical break can:
`Mo-Su 03:20-24:00`). `licence = 'curated-fact'`.

## 5. Source: city dataset — not yet contracted

`source_name = 'warsaw-city'` is reserved. No adapter is written until the
items listed in `tasks/002-data-source-research.md` under "Warsaw city open
data" are observed on `dane.um.warszawa.pl` and recorded in a dated research
snapshot. When that happens this contract gains a section 6 with the dataset
identifier, endpoint, field mapping, cadence, deletion semantics and licence,
and ADR 0002 D7 is updated. Until then nothing in the product is sourced from
it.

## 6. Reconciliation inputs

Matching between sources (`ARCHITECTURE.md` 14) receives, per record:
`position`, `name`, `operator`, `address`, `level`, `source_name` and
`source_record_id`. Thresholds are not set here. Every source record survives
reconciliation unchanged; only the canonical toilet is merged.

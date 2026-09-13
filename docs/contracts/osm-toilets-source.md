# Contract — OpenStreetMap as a toilet data source

Status: Accepted for TASK-004 ingestion, with observation gaps listed at the end
Date: 2026-09-13
Owner task: TASK-002
Decision record: `docs/adr/0003-first-data-source.md`

This contract describes what OpenStreetMap (OSM) provides and the shape the
ingestion adapter consumes. It follows the adapter pattern in
`ARCHITECTURE.md` section 13:

```text
fetch -> validate -> normalise -> stage/match -> upsert source record -> reconcile canonical toilet
```

Each statement below is marked **OBSERVED** with a date, **DECIDED** as a
project choice, or **UNVERIFIED** where nobody has yet read the live source.
An UNVERIFIED item is not a fact and must not be treated as one.

## 1. Source identity

| Item | Value | Status |
| --- | --- | --- |
| Name | OpenStreetMap | DECIDED |
| Licence | Open Database License (ODbL) 1.0, as cited by the research at `https://wiki.openstreetmap.org/wiki/Legal_FAQ` | UNVERIFIED from the live page; see section 9 |
| Attribution | Required; guidelines at `https://osmfoundation.org/wiki/Licence/Attribution_Guidelines` | UNVERIFIED from the live page; see section 9 |
| Data reachable from the project's cloud environment | Yes, Overpass answered HTTP 200 on 2026-09-13 | OBSERVED, reported by the project owner |

## 2. Acquisition

**DECIDED.** A scheduled, bounded pull from the Overpass API, run from GitHub
Actions on a fixed cadence, with every raw response stored before any
processing. Not per-request. Not from the browser.

Why Overpass and not a regional extract: the Warsaw toilet set is a few hundred
elements. A bounded query is small, cheap for the public instance, and needs no
tooling to slice a multi-gigabyte file. The public Overpass instance is meant for
moderate use, and one query per week is moderate.

Why not per-request: `docs/research/2026-09-13-warsaw-toilet-sources.md`
section 1.4 and the Overpass usage policy both say the public instance is not a
production backend. Users never wait on it.

**Fallback, DECIDED.** If the public instance proves unreliable, and it returned
HTTP 504 to one of two queries on 2026-09-13, switch to a Geofabrik regional
extract for Mazowieckie filtered with `osmium`. The adapter must not assume which
of the two it is reading from; both yield the element shape in section 4.

**Cadence, DECIDED.** Weekly at first. OSM changes continuously, so cadence is
the project's choice, not the source's. `ARCHITECTURE.md` section 13 forbids
pulling more often than the terms justify. Raise it only with evidence that
Warsaw toilet edits happen faster than weekly.

**Identification, DECIDED.** Every request carries a User-Agent naming the
project and the repository URL, as the probe already does.

## 3. Area

**DECIDED.** Ingestion selects elements inside the Warsaw administrative
boundary, not a bounding box. A bounding box over Warsaw includes neighbouring
municipalities and excludes nothing the product should exclude.

**UNVERIFIED.** The OSM relation id of the Warsaw administrative boundary has
not been observed in this session. TASK-004 records the id it uses and the date
it checked it.

The probe uses a bounding box for convenience only:
`52.0979,20.8512,52.3679,21.2711`. Counts from it are indicative, not the
project's figures.

## 4. Elements selected and raw shape

**DECIDED.** Two selections, kept apart because they mean different things:

1. **Toilets.** Nodes, ways and relations tagged `amenity=toilets`. Each is a
   toilet facility.
2. **Venues with toilets.** Elements carrying `toilets=*` other than
   `toilets=no`. Each is a venue that states it has a toilet. It is not a
   toilet, and its access rules are the venue's. The research (section 1.6)
   requires these never be shown as public toilets without their access
   condition.

The adapter receives Overpass JSON elements requested with `out center tags meta`
or the equivalent from an extract:

```text
type        node | way | relation
id          integer, stable per type
lat, lon    for nodes
center      {lat, lon} for ways and relations
tags        string -> string
version     integer
timestamp   ISO 8601, last edit of the element
changeset   integer
```

**Privacy, DECIDED.** The `user` and `uid` fields of `meta` are OSM usernames.
They are not persisted. `AGENTS.md` requires validating external data before
persistence and forbids retaining what the product does not need.

**Raw retention, DECIDED.** The full raw element is stored on the source record.
ODbL permits this; the raw record is what makes a later conflict explainable.

## 5. Identity and change detection

| Concern | Rule | Status |
| --- | --- | --- |
| Source record key | `osm:<type>/<id>`, for example `osm:node/123456` | DECIDED |
| Change detection | `version` and `timestamp` differ from the stored record | DECIDED |
| Element missing from a new pull | Mark the source record `not_seen_since <run>`; never delete it; never delete the canonical toilet on that signal alone | DECIDED, per `ARCHITECTURE.md` section 14 |
| Element type change | Treated as a new source record; the old one goes `not_seen_since` | DECIDED |

## 6. Field mapping

The adapter produces the normalised shape below. **A missing tag is unknown.**
It is never `false`, `no`, `free` or `open`. This is the single most important
rule in this contract and the research states it four times.

| Normalised field | OSM tag(s) | Values | When absent |
| --- | --- | --- | --- |
| `exists` | `amenity=toilets` | true | not selected |
| `name` | `name` | text | null |
| `operator_name` | `operator` | text | null |
| `opening_hours_raw` | `opening_hours` | raw expression, unparsed here | null |
| `fee_state` | `fee` | `yes` → paid, `no` → free | unknown |
| `charge_raw` | `charge` | raw text | null |
| `payment_methods_raw` | `payment:*` | tag list, raw | unknown |
| `access_type` | `access` | see below | unknown |
| `wheelchair` | `wheelchair` | `yes` / `no` / `limited` | unknown |
| `changing_table` | `changing_table` | `yes` / `no` / `limited` | unknown |
| `gender` | `male`, `female`, `unisex` | set of those present | unknown |
| `level` | `level` | text | null |
| `indoor` | `indoor` | `yes` → true | unknown |
| `source_verified_at` | `check_date`, else `survey:date` | date | null |
| `description_raw` | `description`, `note` | text, never rendered unreviewed | null |

**Access mapping, DECIDED**, following the research's list in section 1.6:

| `access` value | `access_type` |
| --- | --- |
| absent | `unknown` |
| `yes`, `public` | `public_unconditional` |
| `permissive` | `public_unconditional`, with `confidence` lowered |
| `customers` | `customers_only` |
| `private`, `no` | `not_public` |
| anything else | `unknown`, raw value kept |

Opening hours are stored raw. Parsing into open/closed/likely/unknown belongs to
TASK-013 and must not be attempted in the adapter.

## 7. Validation before persistence

**DECIDED.** Reject the element, record the rejection, and continue:

- `lat`/`lon` or `center` missing, non-numeric, or outside the Warsaw area;
- `id` or `version` missing or non-integer;
- `tags` not a string-to-string map;
- any tag value over 4,096 characters.

Never let a malformed element reach the canonical tables. Never log the raw
body of a rejected element at error level; log the key and the reason.

## 8. What this source does not provide

Stated so nobody designs around it:

- no guarantee of freshness, and no per-record refresh cadence;
- no operational status; `opening_hours` is a schedule, never "open right now";
- no city agreements with private venues;
- no official hours for municipal toilets, only what a mapper entered;
- no entrance guidance beyond an occasional `description`;
- no sensor data of any kind.

## 9. Licence and attribution

**UNVERIFIED in this session.** The egress policy of the session that wrote this
contract denies `wiki.openstreetmap.org` and `osmfoundation.org`, so the terms
were not read live. The research document cites them; citations are not
observations.

What must be recorded, from a session or a person that can read the pages:

- the licence name and version, quoted from the Legal FAQ, with the date read;
- the attribution wording OSMF asks for, quoted, with the date read;
- where the product will show it: on the map, on any page that lists toilets,
  and on a `/copyright` or equivalent page.

**Share-alike, flagged for legal review, DECIDED not to assert.** The community
FAQ distinguishes a Produced Work from a Derivative Database, and share-alike
attaches to a Derivative Database that is Publicly Used. The product database
will combine OSM elements with user reports and, later, city data, and will
answer public queries from it. Whether that makes the toilet database a
Derivative Database that must itself be offered under ODbL, or whether keeping
OSM-derived rows in a separately identifiable dataset keeps it a Collective
Database, is a legal question. This contract records the two designs so the
schema in TASK-003 can support either:

1. accept ODbL for the toilet dataset and publish it, which is consistent with
   the product's own trust positioning; or
2. keep OSM-derived source records physically separable from other sources so
   they can be published alone.

Design 2 costs nothing now and is what section 5 already implies, so TASK-003
builds for it. The choice between them is made after legal review and recorded
in the ADR.

## 10. Observation status summary

| Item | Status | How to close it |
| --- | --- | --- |
| Overpass reachable from the cloud environment | OBSERVED 2026-09-13 | closed |
| `amenity=toilets` count in the probe bbox | UNVERIFIED; the run returned 200 but the value was not carried into the repository | run `pnpm research:probe -- --full`, paste the count from `OBSERVATIONS.md` |
| `toilets=*` venue count | UNVERIFIED; HTTP 504 on the only run | same run; the probe now retries once |
| Tag coverage for the fields in section 6 | UNVERIFIED | same run |
| Licence text | UNVERIFIED | read the Legal FAQ, quote it, date it |
| Attribution wording | UNVERIFIED | read the guidelines, quote them, date them |
| Warsaw boundary relation id | UNVERIFIED | TASK-004 |
| Share-alike conclusion | flagged for legal review | legal review, then ADR |

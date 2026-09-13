# TASK-002 — live source observations

**Observed:** 13 September 2026, between 11:53 and 12:15 UTC unless a line says
otherwise.
**Environment:** a sandboxed agent container whose outbound HTTPS goes through
an egress proxy. Every request below was made from that container. Where the
proxy or the remote host refused the connection, the failure is recorded and the
value it would have produced stays UNVERIFIED.
**Method:** `curl` with an identifying `User-Agent`
(`GdzieKibel.pl TASK-002 source research (one-off; contact via repository)`),
plus one run of `pnpm research:probe -- --full`. Raw responses were kept outside
the repository, as `tasks/002-data-source-research.md` requires. Quotations are
copied from the fetched page text and are not paraphrased.

This file is evidence, not a decision. The decision is in
`docs/adr/0002-toilet-data-sources.md`; the adapter-facing shape is in
`docs/contracts/toilet-sources.md`.

## 0. Reachability

| Host                          | Result on 2026-09-13                                                                        |
| ----------------------------- | ------------------------------------------------------------------------------------------- |
| `dane.um.warszawa.pl`         | CONNECT accepted by the proxy, then TLS handshake `Connection reset by peer` (11:53, 11:54, 12:01 UTC, also with TLS 1.2 and HTTP/1.1 forced). The probe's Node `fetch` received HTTP 503 with body `upstream connect error or disconnect/reset before headers … connection timeout`. `WebFetch` from a different network path: HTTP 503. **Unreachable.** |
| `api.um.warszawa.pl`          | Same as above (reset at TLS; probe: 503 `remote connection failure`; `WebFetch`: 503). **Unreachable.** |
| `iot.warszawa.pl`             | Same reset at TLS. `WebFetch`: 503. **Unreachable.**                                        |
| `um.warszawa.pl`, `www.um.warszawa.pl`, `mapa.um.warszawa.pl` | Proxy answered HTTP 403 to CONNECT. **Blocked at the proxy.**              |
| `warszawa19115.pl`            | HTTP 200. **Reachable.**                                                                    |
| `overpass-api.de`             | HTTP 200 on `/api/status` and on small queries. **Reachable**, with limits described in section 2.4. |
| `wiki.openstreetmap.org`      | HTTP 200. **Reachable.**                                                                    |
| `www.openstreetmap.org`, `osmfoundation.org`, `operations.osmfoundation.org` | HTTP 200. **Reachable.**                                     |
| `pkp.pl`, `www.pkp.pl`        | HTTP 200. **Reachable.**                                                                    |
| `metro.waw.pl`, `www.metro.waw.pl`, `www.wtp.waw.pl` | Proxy answered HTTP 403 to CONNECT. **Blocked at the proxy.**                       |
| `opendatacommons.org`         | Proxy answered HTTP 403 to CONNECT. The ODbL legal text could not be read at its source.   |
| `dane.gov.pl`, `api.dane.gov.pl` | Proxy answered HTTP 403 to CONNECT. The national portal could not be used as an alternative route to the city dataset. |
| `download.geofabrik.de`       | Proxy answered HTTP 403 to CONNECT. Extract availability is therefore quoted from the OSM wiki, not observed. |
| Other public Overpass instances (`overpass.osm.ch`, `overpass.private.coffee`, `z.overpass-api.de`, `lz4.overpass-api.de`, `overpass.kumi.systems`, `overpass.osm.jp`, `maps.mail.ru`) | Proxy answered HTTP 403 to CONNECT. |

The three Warsaw city hosts fail differently from the proxy-blocked hosts: the
proxy opens the tunnel and the far end resets it before a TLS handshake
completes, and the proxy's own relay log records `tunnel closed … 517 B sent,
39 B received`. This is consistent with the city hosts refusing connections from
the egress network. It is not the HTTP 403 CONNECT denial recorded for the same
hosts on the earlier TASK-001 environment, but the effect is identical: nothing
from `dane.um.warszawa.pl`, `api.um.warszawa.pl` or `iot.warszawa.pl` was
observed.

## 1. Warsaw city open data

### 1.1 What could not be observed

Every acceptance item under "Warsaw city open data" in
`tasks/002-data-source-research.md` depends on reaching `dane.um.warszawa.pl`
or `api.um.warszawa.pl`. Neither host answered (section 0). Therefore all of the
following are **UNVERIFIED** as of 2026-09-13:

- dataset identifier;
- endpoint, and whether an API key or registration is required;
- field list, types and an example record;
- record count;
- publisher-stated refresh cadence;
- licence or reuse terms;
- pagination and rate limits;
- representation of removed or temporarily unavailable facilities;
- per-record last-modified timestamp;
- whether operational status is exposed separately from opening hours;
- how the legacy and new services differ.

The probe (`pnpm research:probe -- --full`, run 11:57–12:01 UTC) issued sixteen
catalogue requests, eight per host, covering both CKAN `package_search` paths
and the terms `toaleta`, `toalety`, `szalet`, `WC`. All sixteen returned HTTP
503 from the proxy with an upstream connection failure. Its report
`.research-output/OBSERVATIONS.md` records every request and marks the
catalogue UNVERIFIED. The script exited non-zero, as designed.

Nothing in this section is inferred from memory. A dataset name, field or
licence that appears in the desk research or in general knowledge is not
recorded here because it was not observed.

### 1.2 What the city says about its data on pages that were reachable

Source: https://warszawa19115.pl/web/guest/-/dane-po-warszawsku, observed
2026-09-13 12:01 UTC, page footer `Zaktualizowano: 2026-04-21 09:05`:

> Zapraszamy do nowej odsłony serwisu dane.um.warszawa.pl. W ciągu najbliższych
> miesięcy serwis Otwarte dane Warszawy całkowicie zastąpi dotychczasowy
> serwis: https://api.um.warszawa.pl.

Source: https://warszawa19115.pl/en/-/warszawska-platforma-iot, observed
2026-09-13 12:01 UTC, page footer `Zaktualizowano: 2024-11-22 14:49` (the page
body is Polish despite the `/en/` path):

> Dane prezentowane na naszej platformie IoT dostarczane są z warszawskiej
> platformy Otwartych Danych (https://api.um.warszawa.pl) opartej o powszechnie
> znane rozwiązanie CKAN (https://ckan.org/).

Source: https://warszawa19115.pl/web/guest/-/automatyczne-toalety-miejskie,
observed 2026-09-13 12:01 UTC, page footer `Zaktualizowano: 2026-09-10 12:06`:

> Na mapie znajdują się toalety publiczne stacjonarne i przenośne. Można znaleźć
> toalety w obiektach użyteczności publicznej i obiektach prywatnych
> udostępnione dla wszystkich mieszkańców.
> Po wybraniu punktu na mapie wyświetla się dokładny adres toalety, godziny
> otwarcia, informacje o odpłatności (jeśli występuje), dostępnych przewijakach
> i dostosowaniu obiektu dla osób niepełnosprawnych.

> W serwisie mapowym Warszawy znajdują się lokalizacje kilkuset toalet.

> W 350 najbardziej uczęszczanych miejscach w Warszawie znajdują się tabliczki
> zamontowane na ulicznych latarniach. Na tabliczkach znajduje się napis „Mapa
> WC” oraz kod QR.

What this establishes, and no more: the city states a newer service
(`dane.um.warszawa.pl`) is replacing the legacy one (`api.um.warszawa.pl`); the
IoT platform is fed from the legacy CKAN service as of a page last updated in
November 2024; and the city's map exposes address, opening hours, fee, changing
table and disability access per toilet. "Kilkuset" is a marketing figure, not a
record count. None of this identifies a dataset, a schema or a licence.

### 1.3 Other facts on the same 19115 page

The page also lists, as plain text without coordinates:

- 26 "Automatyczne Toalety Miejskie (ATM) – Zarząd Zieleni" locations by
  district and street description (e.g. `Śródmieście Park Ujazdowski`,
  `Mokotów Park Morskie Oko, od ul. Puławskiej, przy skrzyżowaniu z ul.
  Dworkową`);
- 4 "ATM – Urząd Dzielnicy Targówek" locations (`ul. H. Sternhela`,
  `ul. Uroczysko`, `Skwer S. Wiecheckiego „Wiecha”`, `ul. Samarytanka`);
- one toilet at Cmentarz Wojskowy, with the note that portable toilets are
  placed there during some holidays and anniversaries;
- toilets at the W-Z route stairs, managed by Zarząd Dróg Miejskich.

These are descriptions, not records. No opening hours, fee or coordinates are
given for them on that page.

## 2. OpenStreetMap

### 2.1 Licence and attribution, quoted

Source: https://www.openstreetmap.org/copyright/en, observed 2026-09-13
12:01 UTC:

> OpenStreetMap® is open data, licensed under the Open Data Commons Open
> Database License (ODbL) by the OpenStreetMap Foundation (OSMF). In summary:
> You are free to copy, distribute, transmit and adapt our data, as long as you
> credit OpenStreetMap and its contributors. If you alter or build upon our
> data, you may distribute the result only under the same license.

> Where you use OpenStreetMap data, you are required to do the following two
> things: Provide credit to OpenStreetMap by displaying our attribution notice.
> Make clear that the data is available under the Open Database License.

Source: https://osmfoundation.org/wiki/Licence/Attribution_Guidelines,
observed 2026-09-13 12:01 UTC, page revision dated 10 September 2026:

> Attribution must be presented to anyone who uses, views, accesses, interacts
> with, or is otherwise exposed to the map or produced work. The attribution
> format should not require individuals to interact with the map or produced
> work to see the attribution.

> Attribution must be to “OpenStreetMap”. Attribution must also make it clear
> that the data is available under the Open Database License. This may be done
> by making the text “OpenStreetMap” a link to openstreetmap.org/copyright

> The historical forms of attribution “© OpenStreetMap contributors” or
> “© OpenStreetMap” are acceptable.

> Databases: You must include attribution to OpenStreetMap and either the text
> of the ODbL or a link to it as part of the database, derivative database, or
> database as part of a collective database. You must include the notices in a
> location (such as a relevant directory) where users would be likely to look
> for it, such as a readme file, or within the data or metadata.

> Interactive maps: For a browsable map (e.g., embedded in a web page or
> application), the credit should typically appear in a corner of the map.
> […] If the attribution has been collapsed, the user must still be able to
> find the licence information if they look for it

The full ODbL legal text at `opendatacommons.org` could not be fetched
(section 0). Clauses quoted below are quoted as they appear inside the OSMF
guideline pages, which were fetched.

### 2.2 Share-alike: the text the conclusion rests on

Source: https://wiki.openstreetmap.org/wiki/Legal_FAQ, observed 2026-09-13
12:01 UTC:

> But if you do distribute or publicly use anything derived from it - a
> Derivative Database - then the derivative database must be available under
> the same licence as the OSM data (the Open Database License). You must make
> the derivative database available on request to anyone who received your
> data, viewed the work made from it, or used your service.

> However, if you make a database which includes OSM data and any additional
> information (including using information to decide on OSM features NOT to
> include in your database), then this would be classed as a "derivative
> database" and should be made available under the Open Database License

> If the two datasets are independent, no, you don't; this is a Collective
> Database. If you adapt them to work together (for example, by taking footpaths
> from the OSM data, roads from the third-party data, and connecting them for
> routing), this is a Derivative Database […] However, if the two datasets are
> matched "trivially" by, for example, automated matching using a simple
> criterion such as name/locality, this is not "substantial" and remains a
> Collective Database.

> Can I use OSM data and OpenStreetMap-derived maps to verify my own data
> without triggering share-alike? Yes, provided that you are only comparing and
> do not copy any OpenStreetMap data.

Source:
https://osmfoundation.org/wiki/Licence/Community_Guidelines/Collective_Database_Guideline_Guideline,
observed 2026-09-13 12:01 UTC, "Status: Endorsed by the OSMF board 2016-06-17":

> An OSM dataset and a non-OSM dataset combined in a single database will be
> considered independent (and thus form a Collective Database rather than a
> Derivative Database) so long as the data used for a particular data type is
> either all OSM or all non-OSM within the same regional cut.

> a non-OSM database replaces or adds a property of a primary feature, and uses
> either all OSM data or no OSM data for that property of that primary feature
> within the same regional cut

> You have a proprietary list of restaurants for a country. You would like to
> complement your list with the corresponding data from OpenStreetMap removing
> any duplicate objects in the process. The resulting, combined database would
> not be covered by this guideline and you would, if the dataset is publicly
> used, have to consider that your proprietary data may be subject to the ODbL
> share-alike terms.

Source:
https://osmfoundation.org/wiki/Licence/Community_Guidelines/Horizontal_Map_Layers_-_Guideline,
observed 2026-09-13 12:06 UTC:

> If you use OpenStreetMap data along with non-OpenStreetMap data for a given
> Feature Type, then the share-alike condition would apply

> You add a non-OpenStreetMap cemetery layer that is defined as "all cemeteries
> not found in the OpenStreetMap data layers." [listed under "Examples of where
> you DO need to share your non-OpenStreetMap data"]

Source:
https://osmfoundation.org/wiki/Licence/Community_Guidelines/Substantial_-_Guideline,
observed 2026-09-13 12:06 UTC:

> The systematic extraction of all eating places within an area or at all
> castles within an area would be considered to be systematic. [and therefore
> not insubstantial]

Source:
https://osmfoundation.org/wiki/Licence/Community_Guidelines/Trivial_Transformations_-_Guideline,
observed 2026-09-13 12:06 UTC, marked "This is at the proposal stage":

> Loading OpenStreetMap data into a database or transforming into other formats
> does not add any information that needs to be shared provided that no other
> source of data is involved.

The reasoning built on these quotations is in the ADR, not here.

### 2.3 Observed counts

Area definition. Overpass query
`relation["boundary"="administrative"]["name"="Warszawa"]; out tags;`
(observed 2026-09-13 12:02 UTC, data timestamp `2026-09-13T12:00:21Z`) returned
six relations named Warszawa. Three cover the city:

| Relation id | `admin_level` | `teryt:terc` | `wikidata` |
| ----------- | ------------- | ------------ | ---------- |
| 336074      | 8             | –            | Q270       |
| 336075      | 6             | 1465         | Q270       |
| 2907540     | 7             | 1465011      | Q270       |

The other three (13634794, 13634816, 16078721) are `admin_level=10` and are
not the city. Relation **336074** (`admin_level=8`, `alt_name=m.st. Warszawa`)
was used as the Warsaw area below. Overpass area id = 3600000000 + 336074 =
`3600336074`.

Count 1 — `amenity=toilets` inside the boundary. Observed 2026-09-13 12:02 UTC,
`timestamp_osm_base: 2026-09-13T12:01:20Z`,
`timestamp_areas_base: 2026-09-12T16:04:43Z`, HTTP 200 from
`https://overpass-api.de/api/interpreter` (GET, `data=` parameter):

```
[out:json][timeout:120];
area(3600336074)->.w;
(
  node["amenity"="toilets"](area.w);
  way["amenity"="toilets"](area.w);
  relation["amenity"="toilets"](area.w);
);
out count;
```

| nodes | ways | relations | total |
| ----- | ---- | --------- | ----- |
| 448   | 114  | 0         | 562   |

This is a count of OSM elements tagged `amenity=toilets`, each of which the
OSM wiki defines as "publicly accessible toilets". It is not a count of
usable toilets, and it is not comparable to the city's "kilkuset".

Count 2 — venues carrying `toilets=*` inside the boundary. UNVERIFIED as of
12:15 UTC. The area-filtered query
`area(3600336074)->.w; nwr["toilets"](area.w); out count;` was attempted at
12:03, 12:03, 12:05 and 12:06 UTC and returned HTTP 504 each time with the
Overpass body
`Dispatcher_Client::request_read_and_idx::timeout. The server is probably too
busy to handle your request`, or was reset by the relay before a response
(section 2.4). See section 2.5 for the bounding-box fallback.

### 2.4 Overpass service behaviour observed

- `https://overpass-api.de/api/status` (12:01 UTC): `Rate limit: 2`,
  `2 slots available now`.
- A POST of the boundary query at 12:02 UTC returned HTTP 429 after a GET of
  the same query had succeeded seconds earlier. Later queries were paced.
- The main instance's own wiki entry
  (https://wiki.openstreetmap.org/wiki/Overpass_API, observed 12:01 UTC)
  states its usage policy:

  > You can assume that you don't disturb other users when you do less than
  > 10,000 queries per day and download less than 1 GB data per day. That
  > limit is fine for a one-off use of Overpass. If you set something up that
  > uses the Overpass API regularly, then divide those numbers by 100 (making
  > less than 100 queries fetching less 10 MB of data per day fine). If you
  > have an app or website, then the usage counts towards the sum of requests
  > made by all your users.

  > Commercial use should use self-hosted or paid Overpass servers. Cache and
  > rate-limit calls, use extracts if you need a lot of data

  > Nowadays this server is overloaded - be mindful of that, do not
  > overconsume resources and do not expect high reliability. Use
  > alternatives if possible.

  and, at the top of the public-instances section:

  > Free public servers are designed for small projects and can often become
  > overloaded. Consider deploying your own server or using a commercial
  > provider. Or download the regional dumps and filter it using osmium

- From this environment, responses that take longer than roughly ten seconds
  are cut by the egress relay (`ws_closed_mid_exchange … after 12s`). This is
  an environment limit, not an Overpass one, but it is why area-filtered
  queries other than the first count could not be completed here.

- Nominatim usage policy (https://operations.osmfoundation.org/policies/nominatim/,
  observed 12:01 UTC) forbids "Systematic queries […] downloading all POIs in
  an area. If you need complete sets of data, get it from the OSM planet or an
  extract." and requires an identifying User-Agent and at most one request
  per second. Nominatim is therefore not a candidate ingestion path.

- Extracts. The OSM wiki (https://wiki.openstreetmap.org/wiki/Planet.osm,
  observed 12:01 UTC) states: "If you only want data for an area, you can
  download an extract that has that data only, extracted from the full planet
  file." and lists "Minutely diffs and daily extracts in PBF: Entire
  continents, Many countries in all continents" for the Geofabrik mirror.
  `download.geofabrik.de` itself was blocked here, so the existence, size and
  update time of a Poland or Mazowieckie extract were not observed.

### 2.5 Bounding-box fallback and tag coverage

Because area-filtered queries kept timing out, the two remaining queries were
re-run with the probe's bounding box `52.0979,20.8512,52.3679,21.2711`, which
is larger than the administrative boundary and includes some neighbouring
municipalities. Bounding-box counts are therefore **not** comparable to the
562 above; they are recorded because they were what could be observed. Both
were run one at a time, 30 seconds after each failure, from a script that made
no parallel requests. Attempts and results:

- venue count: 504, 504, reset, then HTTP 200 at 12:11:57 UTC;
- full tag download: reset, then HTTP 200 at 12:12:40 UTC.

Count 2 (bounding box) — venues carrying any `toilets=*` tag. Observed
2026-09-13 12:11 UTC, `timestamp_osm_base: 2026-09-13T12:10:21Z`:

```
[out:json][timeout:25][bbox:52.0979,20.8512,52.3679,21.2711];
nwr["toilets"];
out count;
```

| nodes | ways | relations | total |
| ----- | ---- | --------- | ----- |
| 156   | 67   | 1         | 224   |

This counts features of any kind (fuel stations, shops, parks, stations…)
that state something about toilets, including `toilets=no`. It is not a count
of usable toilets.

Count 3 (bounding box) — `amenity=toilets` with tags. Observed 2026-09-13
12:12 UTC, `timestamp_osm_base: 2026-09-13T12:11:26Z`:

```
[out:json][timeout:25][bbox:52.0979,20.8512,52.3679,21.2711];
nwr["amenity"="toilets"];
out center tags;
```

604 elements (479 nodes, 125 ways). Tag coverage over those 604 elements,
computed locally from the response:

| Tag                  | Present | Share |
| -------------------- | ------- | ----- |
| `fee`                | 424     | 70.2% |
| `wheelchair`         | 411     | 68.0% |
| `changing_table`     | 267     | 44.2% |
| `check_date`         | 195     | 32.3% |
| `access`             | 193     | 32.0% |
| `level`              | 186     | 30.8% |
| `opening_hours`      | 163     | 27.0% |
| `operator`           | 146     | 24.2% |
| `toilets:disposal`   | 105     | 17.4% |
| `unisex`             | 74      | 12.3% |
| `indoor`             | 72      | 11.9% |
| `male` / `female`    | 60 each | 9.9%  |
| `portable`           | 45      | 7.5%  |
| `addr:street`        | 32      | 5.3%  |
| `charge`             | 24      | 4.0%  |
| `toilets:position`   | 24      | 4.0%  |
| `description`        | 11      | 1.8%  |
| `name`               | 5       | 0.8%  |
| `toilets:wheelchair` | 4       | 0.7%  |
| `payment:cards`      | 2       | 0.3%  |
| `payment:cash`       | 1       | 0.2%  |
| `locked`             | 0       | 0.0%  |

32 elements carry no tag other than `amenity=toilets`. An absent tag means
unknown; it does not mean no.

Value distributions among elements that carry the tag:

- `access`: `yes` 130, `permissive` 23, `customers` 18, `private` 17, `no` 4,
  `unknown` 1;
- `fee`: `no` 353, `yes` 71;
- `wheelchair`: `yes` 306, `no` 84, `limited` 14, `designated` 7;
- `changing_table`: `yes` 153, `no` 114;
- `opening_hours`, most common: `24/7` 37, `Mo-Su 06:00-22:00` 28,
  `06:00-22:00` 18, `10:00-20:00` 4, `Mo-Fr 08:00-16:00` 4;
- `portable`: `yes` 39, `no` 6;
- `check_date`: earliest `2022-06-02`, latest `2026-09-09`;
- `operator`, most common: `Metro Warszawskie Sp. z o.o.` 18, `Toi Toi` 13,
  `Zarząd Zieleni m.st. Warszawy` 10, `Biblioteka Publiczna w dz. Białołęka
  m. st. Warszawy` 7.

All 18 elements with operator `Metro Warszawskie Sp. z o.o.` carry
`opening_hours=Mo-Su 06:00-22:00` and `fee=no`, which matches the city's
metro rule (section 3). Eighteen is fewer than the number of metro stations,
so OSM alone does not cover the rule.

One complete example record, as returned (way 1201210007, centre computed by
Overpass):

```json
{"type": "way", "id": 1201210007,
 "center": {"lat": 52.2192425, "lon": 21.0266934},
 "tags": {"access": "customers", "amenity": "toilets", "building": "toilets",
  "building:colour": "#b2ada4", "building:levels": "1", "changing_table": "yes",
  "charge": "1 PLN", "fee": "yes", "height": "3",
  "name": "Automatyczna toaleta miejska", "opening_hours": "24/7",
  "operator": "Zarząd Zieleni m.st. Warszawy", "payment:coins": "yes",
  "payment:contactless": "yes", "roof:colour": "#b2ada4", "roof:shape": "flat",
  "short_name": "ATM", "source:building": "EGiB", "toilets:disposal": "flush",
  "unisex": "yes", "wheelchair": "yes"}}
```

Note `access=customers` on a paid municipal automatic toilet: mappers use the
value for "pay to enter", which is not what the wiki defines it as. The
adapter must carry the value through and let the product decide how to label
it; it must not read it as "customer-only venue".

No element metadata (`timestamp`, `version`, `user`) was requested, so per
element last-modified is unobserved here; `check_date` is a mapper-entered
survey date present on 32% of elements.

### 2.6 Tagging documentation, quoted

Source: https://wiki.openstreetmap.org/wiki/Tag:amenity%3Dtoilets, observed
2026-09-13 12:01 UTC:

> Indicates publicly accessible toilets.

> fee=yes/no - specify whether a fee is required. opening_hours=* - specify
> opening hours of the toilet. Toilets which are always available can be tagged
> with opening_hours=24/7. operator=* - name of entity responsible for toilet
> […] changing_table=yes/no/limited - availability of a nappy changing table.

> access=yes - explicitly public and open to whoever walks up (a fee=* may
> still apply). access=customers - while open to the public, the clear policy
> is to require a purchase prior to use. You may need a key or code to get in.

> access=private, access=no use room=toilets because amenity=toilets is for
> toilets "open to the public".

> toilets:access=* - refers to toilets accessible to a member of the public.
> Note that for example toilets:access=customers means that a toilet exists but
> is only available to customers. […] Do not use toilets:access=* on toilets
> tagged as a separate object with amenity=toilets, use access=* instead.

Source: https://wiki.openstreetmap.org/wiki/Key:toilets, observed 2026-09-13
12:01 UTC:

> Whether the toilet is suitable for wheelchair users. Use
> toilets:wheelchair=yes/no/limited.

> toilets:access=yes may be used to indicate that toilet is available for
> everybody and toilets:access=customers may be used to indicate that access is
> restricted to customers of the object.

> Some mappers use the toilets:\*=\* namespace also for additional information,
> like for example toilets:fee=\* or toilets:charge=\*.

## 3. Warsaw Metro

Source: https://warszawa19115.pl/web/guest/-/automatyczne-toalety-miejskie,
observed 2026-09-13 12:01 UTC, page footer `Zaktualizowano: 2026-09-10 12:06`,
section "Toalety w metrze":

> Na wszystkich stacjach metra funkcjonują ogólnodostępne toalety.
> Toalety na wszystkich stacjach metra dostępne są codziennie, przez 7 dni w
> tygodniu, w stałych godzinach 6:00 - 22:00.
> Toalety zlokalizowane są poza strefą biletową i są bezpłatne dla wszystkich
> użytkowników.
> Koszty ich funkcjonowania pokrywa Metro Warszawskie Sp. z o.o.

The operator's own site (`metro.waw.pl`) was blocked at the proxy, so this rule
rests on the city's 19115 page only. The list of stations the rule applies to
was not observed from any Metro or city page; it has to come from the map data
(OSM `station=subway` inside the Warsaw boundary) and its count is UNVERIFIED.

## 4. PKP and transport hubs

### 4.1 Structured feed

No structured feed for station toilet data was found on `pkp.pl`:

- https://www.pkp.pl/pl/ (observed 12:01 UTC): the page text contains no
  mention of an API, feed, JSON or open data.
- Station information pages are HTML articles under
  `/pl/?option=com_content&view=article&id=…`.
- https://www.pkp.pl/pl/bez-barier?option=com_withoutbarriers&station=Warszawa+Centralna
  (observed 12:01 UTC) is an HTML form with a fixed station list and returns a
  list of facility labels (`WC`, `Przewijak dla dzieci`, …) plus prose, not a
  data file.
- `dane.gov.pl` could not be checked (section 0).

Conclusion recorded in the ADR: no structured feed; a manually curated hub
layer replaces it.

### 4.2 Observed station facts

Source:
https://www.pkp.pl/pl/?catid=21&id=155%3Awarszawa-zachodnia-informacje-dla-pasazera&lang=pl-PL&option=com_content&view=article,
observed 2026-09-13 12:01 UTC:

> Adres: Aleje Jerozolimskie 142, 02-305 Warszawa, Współrzędne: 52.218857,
> 20.965947
> Godziny otwarcia dworca: całodobowo

> WC
> Toalety czynne w godzinach 3:20-24:00 (24:00-3:20 przerwa techniczna).
> Możliwa płatność gotówką i kartą płatniczą.

No price is stated on the Zachodnia page.

Source:
https://www.pkp.pl/pl/?catid=21&id=154%3Awarszawa-wschodnia-informacje-dla-pasazerow&lang=pl-PL&option=com_content&view=article,
observed 2026-09-13 12:01 UTC:

> Adres: Warszawa Wschodnia Dalekobieżna: ul. Kijowska 20, 03-743 Warszawa;
> Warszawa Wschodnia Podmiejska: ul. Lubelska 24, 03-802 Warszawa

> WC
> Toalety czynne całodobowo (Warszawa Wschodnia Dalekobieżna) i od 6:00 do
> 20:00 (Warszawa Wschodnia Podmiejska), płatne 4,50 zł

Source:
https://www.pkp.pl/pl/bez-barier?option=com_withoutbarriers&station=Warszawa+Centralna,
observed 2026-09-13 12:01 UTC:

> Dworzec: Warszawa Centralna; ul. Aleje Jerozolimskie 54, 00-024 Warszawa

> Toaleta
> Na dworcu znajduje się ogólnodostępna toaleta dostosowana do potrzeb osób o
> ograniczonej mobilności.

No opening hours or price for Centralna were observed.

The station selector on the "bez barier" form lists these Warsaw stations
(observed 12:01 UTC): Warszawa Centralna, Warszawa Gdańska, Warszawa Ochota,
Warszawa Powiśle, Warszawa Rembertów, Warszawa Śródmieście, Warszawa Stadion,
Warszawa Ursus, Warszawa Wileńska, Warszawa WKD Śródmieście, Warszawa Włochy,
Warszawa Wschodnia, Warszawa Zachodnia — thirteen stations. Only three of them
have a toilet fact observed in this session (Zachodnia, Wschodnia, Centralna).

No reuse terms for `pkp.pl` content were read. The facts above are opening
hours, prices and addresses stated for public information; the curated layer
records them as facts with their source URL and date, and does not copy page
text.

## 5. What remains unobserved

- Everything about the Warsaw city toilet dataset (section 1.1).
- The ODbL legal text at its source (quoted via OSMF pages instead).
- Availability and size of a Poland/Mazowieckie OSM extract.
- Count of `toilets=*` venues inside the administrative boundary (section 2.3,
  count 2); only the bounding-box count in section 2.5 was observed.
- Per-element OSM `timestamp`/`version` metadata (not requested).
- The metro station list and count.
- Opening hours and price at Warszawa Centralna and the other ten PKP stations.
- Reuse terms for `warszawa19115.pl` and `pkp.pl` page content.

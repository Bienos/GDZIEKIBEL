# GDZIEKIBEL.PL — RESEARCH

**Research snapshot:** 13 September 2026  
**Scope:** Warsaw only  
**Product type:** mobile-first web app / PWA for finding the nearest *actually usable* toilet  
**Core question:** how do we get a user from “I need a toilet now” to a trustworthy, reachable option with the fewest possible decisions?

---

## Executive conclusion

GdzieKibel.pl is not entering an empty market. Warsaw already exposes public-toilet information through **Warszawa 19115 / the Warsaw IoT platform**, OpenStreetMap contains structured toilet data, and a Polish web product called **Wyszczaj.to** already offers a very similar utility with maps, filters, nearest-toilet search, navigation and intentionally irreverent branding.

That changes the product strategy.

The winning product cannot simply be:

> “A funny map of toilets in Warsaw.”

That already exists in several forms.

The strongest opportunity is instead:

> **The fastest, most trustworthy answer to one urgent question: “Which toilet can I actually use right now?”**

The research points to five product advantages worth building around:

1. **Availability certainty rather than map density.** A toilet that exists but is locked, customer-only or closed is a failed result.
2. **A “best usable toilet” ranking rather than pure distance.** Open now, access rules, walking time, price and freshness should influence ranking.
3. **Field-level provenance and freshness.** “Last verified”, source and confidence should be first-class data, not backend metadata.
4. **Real-world findability.** Building name, entrance, floor, “inside the metro concourse”, “ask staff for key”, payment method and access conditions are often more useful than a raw coordinate.
5. **One-tap correction loops.** “Open / closed / gone / price changed / customer-only / wrong entrance” should be reportable in seconds.

The main project risk is therefore **not frontend implementation**. It is creating and maintaining a canonical toilet dataset that distinguishes *existence* from *usability*.

---

# 0. Research method and evidence quality

This report uses four evidence types throughout.

### FACT
A claim directly supported by an official source, app-store listing, documented standard or primary product page.

### USER EVIDENCE
A qualitative signal from app reviews, Reddit, forums or user discussions. It is useful for identifying failure modes and language, but it is **not representative survey data** unless explicitly stated.

### INFERENCE
A conclusion drawn by comparing facts and user evidence. It should be treated as a product hypothesis until validated.

### RECOMMENDATION
An action for GdzieKibel.pl based on the evidence.

### Important limitations

- The exact current **Warsaw open-data toilet dataset endpoint, schema and dataset-specific licence** were not reliably surfaced through indexed web results during this research. Official city pages confirm that toilet data are presented via the Warsaw IoT platform and that the IoT platform is fed from Warsaw Open Data, but the exact production endpoint must be verified directly before implementation.
- Counts of “toilets in Warsaw” vary strongly between products because they use different definitions and data sources. Counts should not be compared as if they measure the same thing.
- App-store and Reddit evidence is intentionally used to identify recurring pain points. It is not a substitute for moderated usability testing.
- Most sources provide scheduled availability, not true sensor-based real-time “door open / door locked” status. The product must not call scheduled data “live” unless it actually is live.

---

# 1. DATA SOURCES FOR TOILETS IN WARSAW

## 1.1 Warsaw 19115 / Warsaw city toilet map

### FACT

Warsaw officially maintains a map of publicly accessible toilets. The Warsaw 19115 information page states that the map includes:

- stationary public toilets;
- portable toilets;
- toilets in public-use buildings;
- toilets in private buildings made available to residents;
- exact address;
- opening hours;
- fee information where applicable;
- baby-changing availability;
- accessibility for people with disabilities.

The same city page says the Warsaw map contains **“kilkaset” (several hundred)** toilet locations and includes some gastronomic venues that make toilets available to passers-by or tourists under an agreement with the city.

The city has also installed **350 “Mapa WC” QR signs** in high-footfall locations, directing people to the city toilet map.

Source: Warsaw 19115 — Toalety Miejskie  
https://warszawa19115.pl/web/guest/-/automatyczne-toalety-miejskie

### FACT

The official Warsaw IoT platform has a dedicated toilet layer and describes it as providing current information about toilet availability and distribution. The city states that data presented on the IoT platform are supplied from the Warsaw Open Data platform and that the legacy API platform is based on CKAN.

Source: Warsaw 19115 — Warszawska Platforma IoT  
https://warszawa19115.pl/en/-/warszawska-platforma-iot

Source: Warsaw IoT  
https://iot.warszawa.pl/

### FACT

Warsaw is transitioning from the legacy `api.um.warszawa.pl` open-data service to a newer `dane.um.warszawa.pl` service. The city states that the new service will replace the older one over time.

Source: Warsaw 19115 — Dane po warszawsku  
https://warszawa19115.pl/web/guest/-/dane-po-warszawsku

### INFERENCE

This should be treated as the **highest-value source for the Warsaw MVP**, because it is local, city-maintained and already contains fields directly relevant to the user decision.

However, “official” does not automatically mean “operationally perfect”. A city record can still be stale, scheduled incorrectly or lack entrance-level detail.

### RECOMMENDATION

Use Warsaw city data as the **authoritative first-party source**, but do not expose it directly as the product database.

Build an internal canonical model that stores:

- original source record;
- source identifier;
- source timestamp where available;
- imported value for each field;
- later verification or conflicting source evidence.

Do **not** overwrite source data destructively during ingestion.

### CRITICAL PRE-BUILD TASK

Before production work begins, verify directly on `dane.um.warszawa.pl` / the current Warsaw API:

1. exact toilet dataset ID;
2. API endpoint and authentication requirements;
3. full schema;
4. refresh cadence;
5. current licence / reuse terms;
6. pagination and rate limits;
7. whether deleted/temporarily unavailable facilities are represented;
8. whether last-modified timestamps exist per record;
9. whether the city exposes status separately from opening hours.

This should be a hard gate before finalising the ingestion architecture.

---

## 1.2 Warsaw Metro

### FACT

Warsaw 19115 states that **all metro stations have publicly accessible toilets**. They are:

- outside the ticketed zone;
- free;
- open every day;
- listed as operating from **06:00 to 22:00**.

Source: Warsaw 19115 — Toalety Miejskie  
https://warszawa19115.pl/web/guest/-/automatyczne-toalety-miejskie

### INFERENCE

Metro toilets are unusually useful because they form a relatively predictable network with simple rules.

This makes them good “anchor toilets” for high-confidence results, particularly in central Warsaw.

### RECOMMENDATION

Create a source rule for metro toilets with:

- operator = Metro Warszawskie;
- access = public;
- fee = 0;
- default recurring schedule = 06:00–22:00;
- source confidence = high;
- parent venue = specific metro station;
- entrance/access note where known.

Do not assume the schedule is permanently immutable. Keep it source-backed and dateable.

---

## 1.3 Automatic municipal toilets and portable toilets

### FACT

Warsaw publishes a list of automatic municipal toilets managed by city units, including locations in Śródmieście, Praga, Żoliborz, Mokotów, Ochota, Rembertów and Włochy. The same city page explicitly notes that portable toilets may be placed temporarily at some locations during events or commemorations.

Source:  
https://warszawa19115.pl/web/guest/-/automatyczne-toalety-miejskie

### INFERENCE

A single `toilet` entity is insufficient unless it supports:

- permanent vs seasonal vs temporary;
- validity windows;
- operator changes;
- temporary closure;
- event-only availability.

### RECOMMENDATION

Model `valid_from`, `valid_to`, `seasonality`, `temporary_status` and `status_until` separately from normal opening hours.

A portable toilet that existed last weekend must not survive indefinitely in the canonical dataset.

---

## 1.4 OpenStreetMap

### FACT

OpenStreetMap uses `amenity=toilets` for publicly accessible toilets. Relevant structured tags include:

- `fee=*`;
- `opening_hours=*`;
- `wheelchair=*`;
- `changing_table=*`;
- `operator=*`;
- gender-related tags;
- `access=*`.

OSM explicitly distinguishes public access from `access=customers` and notes that customer-only access may require a purchase, key or code.

It also supports toilet attributes on other venues via `toilets=*` / `toilets:access=*`.

Source: OpenStreetMap Wiki — amenity=toilets  
https://wiki.openstreetmap.org/wiki/Toilets

Source: OpenStreetMap Wiki — Key:toilets  
https://wiki.openstreetmap.org/wiki/Key%3Atoilets

### FACT

OSM data are available under the **ODbL**, requiring attribution and carrying share-alike obligations for derived databases in relevant cases.

Source: OpenStreetMap Foundation attribution guidance  
https://osmfoundation.org/wiki/Licence/Attribution_Guidelines

Source: OpenStreetMap Legal FAQ  
https://wiki.openstreetmap.org/wiki/Legal_FAQ

### FACT

Public Overpass servers are intended for moderate use, not as an unlimited production database. OSM documentation warns that public servers can become overloaded and suggests self-hosting, commercial providers or extracts for heavier use.

Source: OpenStreetMap Wiki — Overpass API  
https://wiki.openstreetmap.org/wiki/Overpass_API

### FACT

The public OSM tile servers are not a free unlimited map-hosting CDN. They have usage requirements and no SLA. Likewise, the public Nominatim instance has strict usage limits and prohibits autocomplete and systematic POI downloading.

Sources:  
https://operations.osmfoundation.org/policies/tiles/  
https://operations.osmfoundation.org/policies/nominatim/

### INFERENCE

OSM is extremely valuable as a **coverage and enrichment source**, but it should not be treated as ground truth for usability.

A toilet node can exist while:

- opening hours are missing;
- the fee is unknown;
- access rules are missing;
- the marker is inside a large building without entrance guidance;
- the toilet is technically present but locked outside event hours.

### RECOMMENDATION

Use OSM in three roles:

**A. Discovery** — find facilities absent from city data.  
**B. Enrichment** — fill structured fields such as wheelchair, changing table or access rules where strongly specified.  
**C. Conflict detection** — flag differences between OSM and city records for review.

Do not use “missing OSM tag” as `false`. Missing means **unknown**.

Do not call public Overpass/Nominatim directly from every user session. Import/cache the subset required for Warsaw into your own data layer.

---

## 1.5 PKP railway stations

### FACT

PKP publishes station-specific toilet information that can include opening hours, payment methods, price and accessibility.

Examples surfaced during research:

- **Warszawa Zachodnia:** WC listed as open 03:20–24:00, with a technical break 00:00–03:20; cash and card accepted.
- **Warszawa Wschodnia:** long-distance station WC listed as 24/7; suburban section 06:00–20:00; price listed as 4.50 PLN.
- PKP accessibility pages identify stations with publicly accessible toilets adapted for people with reduced mobility.

Sources:  
https://www.pkp.pl/pl/?catid=21&id=155%3Awarszawa-zachodnia-informacje-dla-pasazera&lang=pl-PL&option=com_content&view=article  
https://www.pkp.pl/pl/?catid=21&id=154%3Awarszawa-wschodnia-informacje-dla-pasazerow&lang=pl-PL&option=com_content&view=article  
https://www.pkp.pl/pl/bez-barier?option=com_withoutbarriers&station=Warszawa+Centralna

### INFERENCE

Large transport hubs deserve first-party enrichment because an incorrect time, price or access assumption has disproportionate impact.

### RECOMMENDATION

For major stations, prefer a current official operator source over crowdsourced values when the fields conflict and record the source date.

Do not scrape large numbers of pages in production unless terms permit it. For the Warsaw MVP, a small manually curated/verified transport-hub layer may be sufficient if no structured feed exists.

---

## 1.6 Private venues: malls, cafés, restaurants, supermarkets, petrol stations

### FACT

Warsaw’s official toilet map includes some private establishments that make toilets available to the public under agreements with the city.

OSM distinguishes public toilets from customer-only toilets. A business having a toilet does **not** mean a person on the street has unconditional access.

Source:  
https://warszawa19115.pl/web/guest/-/automatyczne-toalety-miejskie  
https://wiki.openstreetmap.org/wiki/Toilets

### USER EVIDENCE

Warsaw Reddit users repeatedly describe malls, cafés, public institutions, metro stations and restaurants as fallback options. Some comments specifically note that café/restaurant access may require buying something or obtaining a code.

Source: Reddit — Public restrooms in Warsaw  
https://www.reddit.com/r/warsaw/comments/u0hsth

### INFERENCE

The useful question is not “does this venue contain a toilet?” but:

> **Can a non-customer legally/practically use it right now, and under what condition?**

### RECOMMENDATION

Represent access policy explicitly:

- public_unconditional;
- public_paid;
- customers_only;
- purchase_required;
- ask_staff;
- key_required;
- code_required;
- ticket_required;
- unknown.

Do not infer public access merely because a restaurant, supermarket, hotel or café normally has a toilet.

---

## 1.7 User reports as a data source

### USER EVIDENCE

Across toilet-finder app reviews, one of the strongest recurring requests is the ability to correct:

- closed facilities;
- wrong location;
- missing opening hours;
- missing notes;
- accessibility details;
- whether a facility is inside another venue;
- temporary/conditional access.

Sources include Toilet Finder reviews on Google Play / App Store and Flush reviews.

https://play.google.com/store/apps/details?id=com.bto.toilet  
https://apps.apple.com/gb/app/toilet-finder/id311896604  
https://apps.apple.com/us/app/flush-toilet-finder-map/id955254528

### INFERENCE

For a product whose usefulness depends on current physical reality, user feedback is not an optional “community” feature. It is part of the data-maintenance system.

### RECOMMENDATION

MVP reporting should be one tap plus optional detail:

- **Jest otwarty**
- **Zamknięty**
- **Nie istnieje**
- **Inne godziny**
- **Inna cena**
- **Tylko dla klientów**
- **Nie da się znaleźć wejścia**
- **Błędna lokalizacja**
- **Brak dostępu dla wózka**
- **Inny problem**

Reports should create **verification events**, not directly mutate canonical truth.

---

# 2. COMPETITOR RESEARCH

## 2.1 Warszawa 19115

### FACT

Warszawa 19115 is the city’s broad municipal app and includes a toilet layer. Its toilet data include public stationary and portable toilets, public buildings and some private venues made available to residents.

The current App Store / Google Play product also notes that new toilet filters were added in a recent release.

Sources:  
https://play.google.com/store/apps/details?id=pl.xentivo.ummobile  
https://apps.apple.com/pl/app/warszawa-19115/id735957277

### FACT

At the time of this research, App Store reviews show a low overall rating (around 2.1/5 in the Polish App Store result surfaced), and Google Play results also show weak ratings depending on locale/index snapshot.

User reviews complain about issues including:

- lack of English;
- address search not working;
- freezes / lost submissions;
- location-related failures;
- unintuitive interaction patterns.

These are app-wide reviews, not toilet-layer-specific reviews.

### USER EVIDENCE

A Warsaw Reddit thread recommends Warszawa 19115 for toilets, but a tourist immediately asks about English support; another user says the app did not show toilets when entering some addresses and wondered whether location was required.

Source:  
https://www.reddit.com/r/warsaw/comments/u0hsth

### INFERENCE

Warszawa 19115 has the strongest official-data position but is a **municipal super-app**, not a single-purpose urgent utility.

That creates an opening for GdzieKibel.pl even if it uses overlapping underlying data.

### RECOMMENDATION

Beat 19115 on:

- time-to-answer;
- zero-install web access;
- clear English fallback for tourists;
- ranking rather than raw map browsing;
- plain-language access conditions;
- entrance/finding notes;
- visible freshness/confidence;
- one-tap feedback.

Do not try to beat it by having “more municipal features”.

---

## 2.2 Wyszczaj.to

### FACT

Wyszczaj.to is a Polish web/PWA product with striking overlap with GdzieKibel.pl. It advertises:

- nearest-toilet search;
- map;
- filters;
- directions;
- free/paid labels;
- gender;
- wheelchair accessibility;
- baby changing;
- open-now information when hours are available;
- no registration required;
- weekly data refresh;
- PWA behaviour.

Its Warsaw page currently states a database of **448 public toilets plus 87 petrol stations**, with 276 marked free, 222 wheelchair-accessible, 95 with changing tables and 22 open 24/7.

Sources:  
https://wyszczaj.to/  
https://wyszczaj.to/toalety/warszawa  
https://wyszczaj.to/about

### FACT

Wyszczaj.to also uses intentionally crude/humorous branding and includes a separate crowdsourced category of “places to pee”.

### INFERENCE

This is the most strategically important competitor because it invalidates a weak differentiation thesis:

> “We’ll make a Polish, funny, mobile toilet map.”

That is not enough.

### RECOMMENDATION

Differentiate GdzieKibel.pl around **trust and urgency**, not just tone.

A stronger positioning:

> **Nie pokazujemy ci najbliższej kropki. Pokazujemy kibel, do którego masz największą szansę wejść teraz.**

Product advantages to pursue:

- confidence score;
- field-level verification dates;
- “closing soon” logic;
- access-condition clarity;
- payment method;
- entrance instructions;
- stronger user verification loop;
- best-usable ranking;
- language switch for tourists;
- current-location-first interaction.

---

## 2.3 Flush Toilet Finder

### FACT

Flush markets itself as a very simple toilet-finder: open the app and see nearby toilets. It advertises over 200,000 toilets globally, directions, disabled access, fee/key information, adding toilets, ratings and reports.

Source:  
https://apps.apple.com/pl/app/flush-toilet-finder-map/id955254528

### USER EVIDENCE

A high-rated review praises its simplicity but asks for the ability to update toilet details and add changing-table information.

Source:  
https://apps.apple.com/us/app/flush-toilet-finder-map/id955254528

### INFERENCE

The category validates that “open → nearest toilet immediately” is the correct primary interaction. The weakness is data correction depth.

### RECOMMENDATION

Copy the **interaction principle**, not the UI:

> current location → immediate ranked answer.

Then outperform it on data maintenance and access context.

---

## 2.4 Toilet Finder by BeTomorrow

### FACT

Toilet Finder reports 500,000+ toilets, 1M+ Google Play downloads and includes free toilets, wheelchair-accessible toilets, ratings and community additions/closure notifications.

Source:  
https://play.google.com/store/apps/details?id=com.bto.toilet

### USER EVIDENCE

Recurring review complaints include:

- inability to clearly mark a toilet as closed rather than nonexistent;
- toilets shown in schools / non-useful places;
- missing opening hours;
- missing notes;
- inability to say exactly where inside a grocery store the toilet is;
- poor or vague coordinates;
- missing facility/business names;
- desire to search locations other than current position.

Sources:  
https://play.google.com/store/apps/details?id=com.bto.toilet  
https://apps.apple.com/us/app/toilet-finder/id311896604?platform=ipad&see-all=reviews  
https://apps.apple.com/au/app/toilet-finder/id311896604?platform=iphone&see-all=reviews

### INFERENCE

The recurring failure is not discovery of a point. It is **context needed to successfully complete the last 100 metres**.

### RECOMMENDATION

Store and display:

- venue name;
- entrance point;
- floor/level;
- “inside X” note;
- access requirement;
- conditional opening note;
- source + verification date.

---

## 2.5 LooCation / emerging medical-accessibility positioning

### USER EVIDENCE / COMPETITOR CLAIM

In 2026, a newer toilet-finder project called LooCation has repeatedly positioned itself around the anxiety or “stress loop” experienced by people with IBS, Crohn’s disease and ostomies. Its creator highlights filters such as ostomy-friendly facilities, Eurokey/Radar Key, purchase requirement and opening hours.

Sources are primarily self-posted Reddit product discussions, so claims should be treated as competitor claims rather than independent market data.

Examples:  
https://www.reddit.com/r/ostomy/comments/1sriqjt/i_built_a_free_app_to_find_public_toilets_because/  
https://www.reddit.com/r/iosapps/comments/1sugqzl/my_loocation_toilet_finder/

### INFERENCE

There is a meaningful segment for whom toilet discovery is not merely convenience or humour. For these users, confidence and accessibility matter more than branding.

### RECOMMENDATION

GdzieKibel.pl can remain funny by default while offering a **serious accessibility layer**. Medical/accessibility filters should never be presented as a joke.

---

## 2.6 SEO toilet-map aggregators

### FACT

Other toilet-map sites report materially different Warsaw counts. Examples surfaced in research include a site claiming 532 toilets and another claiming over 3,000 locations.

Sources:  
https://toiletmap.app/warsaw-masovian-pl  
https://toiletnearest.com/poland/warsaw

### INFERENCE

The count itself is a weak trust signal because products may count:

- standalone public toilets;
- every restroom object inside a mall;
- toilets in businesses;
- duplicated indoor facilities;
- customer-only locations;
- petrol stations;
- imported points with weak access metadata.

### RECOMMENDATION

Do not market GdzieKibel.pl with “we have the most toilets”.

Market:

> **We show the toilets you can actually use.**

Quality beats raw count.

---

# 3. USER BEHAVIOUR RESEARCH

## 3.1 The user is not browsing — the user is resolving urgency

### USER EVIDENCE

Toilet-finder reviews repeatedly describe the app as something that “saved” the user in an urgent moment. A Warsaw Reddit poster with stomach issues asks specifically whether quick restroom access is easy in the city. Delivery/field workers describe needing bathrooms while working away from a fixed workplace.

Sources:  
https://www.reddit.com/r/warsaw/comments/u0hsth  
https://play.google.com/store/apps/details?id=sfcapital.publictoiletinsouthaustralia  
https://apps.apple.com/pl/app/flush-toilet-finder-map/id955254528?platform=ipad&see-all=reviews

### INFERENCE

The user’s cognitive bandwidth may be low. Every unnecessary screen, filter or onboarding decision is expensive.

### RECOMMENDATION

Default screen after permission:

**1. best choice**  
**2. two alternatives**  
**3. map for context**

Do not make users configure filters before receiving an answer.

---

## 3.2 “Exists” is not the same as “usable”

### USER EVIDENCE

One of the clearest repeated complaints across Toilet Finder reviews is arriving at a toilet that is padlocked or closed even though the facility physically exists. Users ask specifically for “open or closed” status and opening-hour notes.

Sources:  
https://apps.apple.com/gb/app/toilet-finder/id311896604  
https://apps.apple.com/au/app/toilet-finder/id311896604?platform=iphone&see-all=reviews

### INFERENCE

The worst failure is not “no result”. It is **false confidence**.

A result that says “2 minutes away” but is locked is worse than a result that says “6 minutes away, verified open”.

### RECOMMENDATION

Ranking should strongly penalise uncertainty and closure risk.

Never show a definitive **OTWARTY** badge unless there is enough evidence to support it.

Use language such as:

- OTWARTY;
- POWINIEN BYĆ OTWARTY;
- NIEPEWNE;
- ZAMKNIĘTY;
- ZAMYKA SIĘ ZA 12 MIN.

---

## 3.3 Access conditions are part of the answer

### USER EVIDENCE

Warsaw users mention cafés requiring purchase or a code. Toilet-finder users distinguish public facilities from restaurants, customer-only venues and facilities requiring a key.

Sources:  
https://www.reddit.com/r/warsaw/comments/u0hsth  
https://wiki.openstreetmap.org/wiki/Toilets  
https://apps.apple.com/pl/app/flush-toilet-finder-map/id955254528

### INFERENCE

Price alone is too simple. “Free” can still mean “buy coffee first”; “public” can still mean “ask the attendant”; “toilet exists” can still mean “ticketed area”.

### RECOMMENDATION

Put access rule next to distance, not hidden in details.

Examples:

- **ZA DARMO**
- **4,50 ZŁ · KARTA/GOTÓWKA**
- **TYLKO DLA KLIENTÓW**
- **TRZEBA KUPIĆ COKOLWIEK**
- **POPREŚ O KOD**
- **KLUCZ U OBSŁUGI**

---

## 3.4 The last 100 metres are a major failure point

### USER EVIDENCE

App reviews explicitly request building/business names, inside-location notes and more precise positions. A marker in a large sports field or store can be hundreds of metres from the real toilet or provide no clue how to reach it.

Sources:  
https://apps.apple.com/us/app/toilet-finder/id311896604?platform=ipad&see-all=reviews  
https://play.google.com/store/apps/details?id=com.bto.toilet  
https://apps.apple.com/au/app/toilet-finder/id311896604?platform=iphone&see-all=reviews

### INFERENCE

A map pin is not sufficient for indoor/venue toilets.

### RECOMMENDATION

Add a structured `finding_note` and optional `entrance_geometry`.

Examples:

> “Wejście od Marszałkowskiej, poziom -1.”  
> “Po prawej od kas, przed bramkami.”  
> “W środku stacji, ale poza strefą biletową.”

Allow users to report **“nie mogłem znaleźć wejścia”**.

---

## 3.5 Tourists have a language problem

### USER EVIDENCE

Warszawa 19115 reviews repeatedly request English. A Warsaw Reddit tourist asks whether the city app can be switched to English and is told it cannot.

Sources:  
https://play.google.com/store/apps/details?id=pl.xentivo.ummobile  
https://apps.apple.com/pl/app/warszawa-19115/id735957277  
https://www.reddit.com/r/warsaw/comments/u0hsth

### INFERENCE

A Warsaw-only product can still have significant tourist utility. English is unusually cheap relative to the value it provides.

### RECOMMENDATION

Polish remains the brand-default language, but support an English version very early.

The English tone should be direct, but not translated word-for-word from Polish profanity.

---

## 3.6 Parents need different metadata

### USER EVIDENCE

Warsaw parent discussions describe toilets as a specific problem in recreational areas and playground contexts. Major toilet apps also expose or receive requests for baby-changing information.

Sources:  
https://forum.gazeta.pl/forum/w%2C566%2C98106958%2C98106958%2Czabierac_nocnik_na_plac_zabaw_i_do_sklepu_.html  
https://apps.apple.com/us/app/flush-toilet-finder-map/id955254528  
https://wiki.openstreetmap.org/wiki/Toilets

### INFERENCE

For a parent, the “best” facility may not be the nearest. A changing table, accessible space and reliable opening hours may dominate distance.

### RECOMMENDATION

Keep `changing_table` in the core schema from day one even if the filter ships later.

---

## 3.7 People with IBS/Crohn’s/ostomies need confidence more than novelty

### USER EVIDENCE

Toilet-finder discussions from users with IBS and ostomy communities describe anxiety around being caught without a nearby usable facility. New competitor products explicitly build around this problem.

Sources:  
https://www.reddit.com/r/ParisTravelGuide/comments/1uslre7/apps_to_find_public_toilets/  
https://www.reddit.com/r/ostomy/comments/1sriqjt/i_built_a_free_app_to_find_public_toilets_because/

### INFERENCE

This segment can become a high-retention audience if the product is reliable. It also raises the cost of misleading information.

### RECOMMENDATION

Do not make medical conditions part of the joke layer.

Future capability can include a “Pewniak” / high-confidence mode that prioritises reliable open access, even at greater distance.

---

## 3.8 Seniors are a relevant Warsaw segment

### FACT / SECONDARY EVIDENCE

A 2024 Warsaw senior study is publicly available from the city. A local publication summarising the study reports that **20%** of surveyed Warsaw seniors named public toilets among things missing near their place of residence.

Official study:  
https://wsparcie.um.warszawa.pl/documents/67381/79564632/Badanie%2BSenior%C3%B3w%2Bpr%C3%B3ba%2Bog%C3%B3lnowarszawska.pdf/b121cef3-1e0c-19a0-0a8f-e8a53aedd2d1?t=1744810331498

Secondary report surfacing the 20% figure:  
https://passa.waw.pl/documents/pdfs/numer-17-1260-z-dnia-30042025-1.pdf

### INFERENCE

The product should not rely on youth-oriented visual cleverness alone. Large tap targets, high contrast and obvious directions matter.

### RECOMMENDATION

Keep the brand aggressive, but the utility layer accessible:

- large status text;
- high contrast;
- no tiny grey metadata;
- no gesture-only essential actions;
- straightforward “Prowadź mnie”.

---

## 3.9 Field workers and drivers are a distinct use case

### USER EVIDENCE

Reviews mention delivery drivers, canvassing teams and road workers using toilet-finder apps during work. They value nearest location, establishment name and one-tap navigation.

Sources:  
https://play.google.com/store/apps/details?id=sfcapital.publictoiletinsouthaustralia  
https://apps.apple.com/au/app/toilet-finder/id311896604?platform=iphone&see-all=reviews

### INFERENCE

The product can serve repeat users, not only one-off tourists.

### RECOMMENDATION

Deep-link immediately into external navigation and keep the chosen toilet card persistent on return.

Post-MVP, consider “search near destination” rather than only current location.

---

## 3.10 Payment uncertainty creates friction

### USER EVIDENCE

A September 2026 Tripadvisor thread asks how to obtain coins for paid toilets after arriving in Warsaw and whether mall toilets are free. This is anecdotal, but it illustrates a real traveller concern: the payment mechanism matters, not only the amount.

Source:  
https://www.tripadvisor.com/ShowTopic-g274723-i959-k15578146-Public_toilet-Poland.html

PKP’s current Warszawa Zachodnia page explicitly says the toilet accepts cash and card.

Source:  
https://www.pkp.pl/pl/?catid=21&id=155%3Awarszawa-zachodnia-informacje-dla-pasazera&lang=pl-PL&option=com_content&view=article

### INFERENCE

“Paid” should not be a single boolean.

### RECOMMENDATION

Store:

- amount;
- currency;
- card accepted;
- cash accepted;
- coins required;
- contactless if known;
- purchase requirement.

---

# 4. PRODUCT OPPORTUNITIES

## Opportunity 1 — Best usable toilet, not nearest toilet

### FACT

Competitors generally surface nearby toilets, while reviews repeatedly show that “nearby but locked/unusable” is a major failure.

### INFERENCE

Pure distance ranking optimises the wrong objective.

### RECOMMENDATION

Create a **Usability Rank** using at least:

- walking ETA;
- open-now confidence;
- access type;
- source freshness;
- verification confidence;
- fee/access friction;
- accessibility constraints if the user applies them.

Do not call this AI. It is a transparent ranking system.

---

## Opportunity 2 — “Pewniak” confidence layer

### FACT

Available toilet data come from multiple sources with different update rates and completeness.

### INFERENCE

Confidence is a user-facing product feature.

### RECOMMENDATION

Show:

**PEWNIAK** — recently confirmed / strong official schedule / no conflict.  
**RACZEJ DZIAŁA** — schedule known but verification is older.  
**NIEPEWNE** — incomplete/conflicting data.

Do not hide all uncertainty in a legal disclaimer.

---

## Opportunity 3 — One-tap “is it actually open?” verification

### USER EVIDENCE

Competitor reviews repeatedly want closed/open corrections.

### RECOMMENDATION

After a user navigates to a toilet, ask later:

> **Było otwarte?**  
> `TAK` / `NIE`

Optional follow-up only if `NIE`.

This produces high-value temporal verification with minimal friction.

---

## Opportunity 4 — Entrance-level navigation

### USER EVIDENCE

Users complain that addresses/pins are insufficient for toilets inside venues.

### RECOMMENDATION

For complex venues store a separate entrance point and finding note. Route to the entrance, not a venue centroid.

---

## Opportunity 5 — “Closing soon” urgency logic

### INFERENCE

A toilet 3 minutes away that closes in 2 minutes is not a good recommendation.

### RECOMMENDATION

Calculate arrival time against schedule.

Example:

> **NIE IDŹ TAM — ZAMYKAJĄ ZA 2 MIN.**

Rank an alternative higher if the user is unlikely to arrive in time.

---

## Opportunity 6 — Payment readiness

### RECOMMENDATION

Show access cost and mechanism in the list result itself when relevant.

> **4,50 ZŁ · KARTA OK**

is more actionable than simply **PŁATNY**.

---

## Opportunity 7 — Night mode as a product mode, not a colour theme

### INFERENCE

At night, most facilities close and the candidate set changes dramatically.

### RECOMMENDATION

When local time is late, automatically rank 24/7 and late-opening facilities higher and suppress already-closed noise.

Possible copy:

> **JEST 02:17. NIE POKAŻEMY CI KIBLA, KTÓRY OTWORZĄ O 8.**

---

## Opportunity 8 — Tourist mode / English

### USER EVIDENCE

English-language complaints against Warsaw 19115 are recurring.

### RECOMMENDATION

Polish / English toggle with translated access rules, not just translated headings.

---

## Opportunity 9 — Accessibility profile without account

### RECOMMENDATION

Allow optional persistent local-device preferences:

- wheelchair-accessible only;
- changing table;
- ostomy-friendly later;
- avoid customer-only;
- free only.

No account needed.

---

## Opportunity 10 — A correction system that feels like part of the joke

### RECOMMENDATION

Make reports extremely fast and brand-consistent:

> **TEN KIBEL KŁAMIE?**  
> Zamknięty / nie istnieje / cena z dupy / tylko dla klientów / zły pin

The backend should still store clean structured reasons.

---

## Opportunity 11 — QR/deep-link distribution

### FACT

Warsaw already uses 350 physical “Mapa WC” QR signs.

### INFERENCE

The behaviour of scanning a QR code for toilets is already taught in the city.

### RECOMMENDATION

GdzieKibel.pl can later create shareable deep links or partner QR stickers for bars, events, parks or venues without requiring an app install.

---

## Opportunity 12 — “Search there” for planned trips

### USER EVIDENCE

A Toilet Finder reviewer wanted to pan/search an area other than the current location, for a place they would visit later.

### RECOMMENDATION

Post-MVP: allow “Szukaj w okolicy…” with address/place search.

Do not let this complicate the initial urgent flow.

---

# 5. DATA MODEL IMPLICATIONS

## 5.1 Core principle: separate the real-world toilet from source records

### FACT

The same physical toilet can appear in multiple sources with conflicting attributes.

### RECOMMENDATION

Do not make one imported row equal one toilet.

Use a canonical structure conceptually like:

**TOILET** — the real-world facility.  
**SOURCE RECORD** — what one source says about it.  
**FIELD OBSERVATION** — a source/user statement about a specific field.  
**VERIFICATION EVENT** — evidence that something was observed at a time.  
**REPORT** — unreviewed user feedback.  
**SCHEDULE** — reusable/opening-hour representation.  
**ENTRANCE** — optional routing/finding point.

This makes deduplication and conflict management possible.

---

## 5.2 Canonical Toilet — recommended fields

### Identity

- `id`
- `name`
- `display_name`
- `slug`
- `parent_venue_name`
- `operator_name`
- `facility_type`

### Location

- canonical point geometry;
- entrance point geometry;
- address;
- district;
- indoor/outdoor;
- floor/level;
- finding note.

### Access

- public access type;
- customer-only flag/state;
- purchase required;
- ticket required;
- key required;
- code required;
- staff interaction required;
- access note.

### Cost

- free / paid / unknown;
- amount;
- currency;
- cash;
- card;
- coins required;
- contactless;
- price note.

### Schedule

- opening-hours expression;
- normal weekly schedule;
- exceptions;
- seasonal validity;
- temporary closure;
- status-valid-until;
- timezone.

### Facilities

- wheelchair accessibility: yes / no / limited / unknown;
- changing table: yes / no / limited / unknown;
- male;
- female;
- unisex;
- ostomy-friendly later;
- assistance features later.

### Trust

- canonical confidence score;
- confidence label;
- last verified at;
- last verified method;
- source count;
- conflicting fields count;
- current data-quality flags.

### Lifecycle

- active;
- temporarily closed;
- seasonal;
- removed;
- unknown;
- valid from / valid to.

---

## 5.3 Never collapse UNKNOWN into NO

### FACT

Competitor data frequently omit fields. Wyszczaj.to explicitly notes that absence of a badge means they do not have the information, not that the facility lacks the feature.

Source:  
https://wyszczaj.to/toalety/warszawa

### RECOMMENDATION

For accessibility, price, changing table, gender access and payment method use three/four-state fields:

- yes;
- no;
- limited where relevant;
- unknown.

A missing tag must never become false during import.

---

## 5.4 Opening hours must be temporal data, not text only

### USER EVIDENCE

Closed/padlocked toilets are one of the most recurring failure modes in reviews.

### RECOMMENDATION

Store both:

1. raw source expression/text;
2. parsed schedule structure.

Support:

- day-of-week;
- multiple windows per day;
- holidays;
- exceptions;
- seasonal schedules;
- temporary closure;
- unknown schedule.

`is_open_now` should be **computed**, not stored as a permanent field.

---

## 5.5 Field-level provenance

### INFERENCE

A toilet may have:

- position from Warsaw;
- wheelchair metadata from OSM;
- fee from PKP;
- “open today” user verification from GdzieKibel.

Record-level provenance is therefore too coarse.

### RECOMMENDATION

For important fields, preserve:

- source;
- source record ID;
- observed/imported timestamp;
- source publication timestamp if available;
- confidence;
- whether manually verified;
- superseded value.

This enables explainable conflict resolution.

---

## 5.6 Confidence model

### RECOMMENDATION

Do not base confidence only on source reputation.

Calculate confidence by dimensions:

### Existence confidence
Does this facility physically exist?

### Access confidence
Can a member of the public use it?

### Schedule confidence
Are current opening hours known and recent?

### Location confidence
Does the coordinate represent the actual entrance/facility?

### Attribute confidence
Are fee/accessibility/payment fields known?

### Recency confidence
How recently was this verified?

Then produce a user-facing aggregate label.

Example conceptual weighting:

- existence: 25%
- access: 25%
- schedule: 20%
- recency: 15%
- location: 10%
- ancillary attributes: 5%

Exact weights should be tested, not treated as final research output.

---

## 5.7 Deduplication model

### INFERENCE

Simple coordinate proximity will create false merges in places with multiple toilets, particularly malls, parks, stations and large venues.

### RECOMMENDATION

Deduplication should consider:

- geospatial distance;
- parent venue;
- operator;
- address;
- name similarity;
- source identifiers;
- facility type;
- floor/level;
- access attributes.

Flag ambiguous matches for manual review instead of aggressively merging.

---

## 5.8 User verification events

### RECOMMENDATION

Store user observations separately:

- toilet ID;
- event type;
- timestamp;
- optional geolocation proximity proof (privacy-preserving where possible);
- optional note;
- optional photo later;
- trust weight;
- moderation status.

Examples:

- confirmed_open;
- confirmed_closed;
- price_observed;
- access_denied;
- location_wrong;
- entrance_found;
- no_longer_exists.

A single anonymous report should not instantly rewrite official data.

---

# 6. RECOMMENDED SOURCE PRIORITY

The priority should be field-specific rather than one global source order.

| Data type | Preferred source | Secondary | Notes |
|---|---|---|---|
| Municipal toilet existence | Warsaw city open data | OSM | City first where clearly same facility |
| Metro access/hours | Warsaw/Metro official | user verification | Strong predictable network |
| PKP station fee/hours | PKP official | city / OSM | Prefer current station-specific operator data |
| Wheelchair | official operator/city | OSM | Preserve limited/unknown |
| Changing table | official/city | OSM/user | Unknown != no |
| Access type | official agreement/operator | OSM | User denial can downgrade confidence |
| Entrance/finding note | verified local data/user | OSM indoor data | Often absent from official sources |
| Temporary closure | operator/current city data | recent user reports | Decay quickly |
| Current operational confirmation | recent verified user signal | schedule | Treat as time-limited evidence |

---

# 7. MVP DATA STRATEGY

## Phase A — establish authoritative baseline

Import Warsaw city toilet data and capture every original field without destructive normalisation.

## Phase B — enrich with OSM

Pull Warsaw OSM toilet objects plus toilets attached to relevant public venues. Do not automatically include `access=customers` in the default public results without clear labelling.

## Phase C — create high-confidence anchor set

Manually/officially verify:

- every metro station;
- major railway stations;
- core tourist zones;
- major parks;
- selected 24/7 facilities;
- major malls if access is genuinely open to the public.

## Phase D — launch correction loop

Every toilet card gets a one-tap report mechanism. Navigation events create the opportunity for a later open/closed confirmation.

## Phase E — measure uncertainty

Track not just usage, but data-quality metrics:

- % with known hours;
- % with known access rule;
- % verified within 30/90/180 days;
- report disagreement rate;
- navigation-to-negative-report rate;
- number of ambiguous duplicates;
- number of results suppressed due to uncertainty.

---

# 8. WHAT NOT TO BUILD YET

### RECOMMENDATION

Do not spend MVP time on:

- star ratings for cleanliness;
- long reviews;
- social profiles;
- gamification;
- accounts;
- favourites;
- photos as a mandatory feature;
- nationwide coverage;
- AI chatbot;
- “smart recommendations” without explainable ranking;
- complex moderation dashboards;
- live crowding prediction;
- indoor navigation beyond simple entrance/finding notes.

The MVP should prove one thing:

> **Can we reliably get someone to a usable toilet faster than Google, a city map or a generic toilet finder?**

---

# 9. VALIDATION PLAN BEFORE FULL BUILD

## Test 1 — Data coverage audit

Take 50–100 known/likely toilet locations across:

- Śródmieście;
- Wola;
- Mokotów;
- Praga;
- residential outer districts;
- parks;
- metro;
- rail hubs.

Compare city, OSM, Wyszczaj.to and physical/official operator evidence.

Measure:

- presence;
- duplicates;
- opening hours;
- fee;
- accessibility;
- exact location;
- access condition.

## Test 2 — “Can I use it now?” audit

At multiple times of day, select the nearest result from candidate datasets and check whether the user could realistically enter.

This is more important than counting map pins.

## Test 3 — 5-second usability test

Give users a phone and scenario:

> “Jesteś tutaj. Musisz iść do toalety teraz.”

Measure:

- seconds to first decision;
- number of taps;
- whether they understand free/paid/open/access;
- whether they can start navigation;
- whether humour gets in the way.

## Test 4 — Last-100-metres test

Test 15 indoor/complex toilets. Give participants only the product directions and observe whether they find the entrance.

## Test 5 — Brand boundary test

Test the strong language with:

- Polish 18–30;
- Polish 30–50;
- seniors;
- tourists using English;
- parents;
- users who rely on accessible toilets.

The goal is not to make everyone love the humour. It is to make sure the humour never prevents use or trivialises accessibility/medical needs.

---

# 10. TOP 20 INSIGHTS

1. **Warsaw already has an official toilet dataset/map.** GdzieKibel.pl should build on/around it, not pretend the data problem starts from zero.
2. **The city already publishes the exact fields users need:** address, hours, fee, changing table and disability accessibility.
3. **All Warsaw metro stations are a strong high-confidence network:** free, outside fare gates and officially listed 06:00–22:00.
4. **Wyszczaj.to is a serious direct competitor in Poland.** Humour + map + filters + nearest search is not unique.
5. **The main differentiation should be trust, not toilet count.**
6. **Nearest is not the same as best.** Distance-only ranking can send users to locked or inaccessible toilets.
7. **Open/closed uncertainty is one of the strongest recurring pain points in competitor reviews.**
8. **Access rules matter as much as price.** Customer-only, purchase-required, key/code and ticketed access must be explicit.
9. **The last 100 metres matter.** Users need venue names, entrance notes and indoor context.
10. **Unknown must remain unknown.** Missing metadata cannot silently become “no”.
11. **User reports should be part of the data pipeline**, not an afterthought.
12. **Field-level provenance is necessary** because different sources can be best for different fields.
13. **Opening hours must be structured temporal data**, with exceptions and seasonality.
14. **Temporary/portable toilets require validity windows.**
15. **Payment method can change the recommendation.** “Paid” alone is not enough.
16. **Tourists are underserved by Warsaw 19115’s language experience.** English is a cheap, high-value addition.
17. **Accessibility metadata should be core schema even if filters ship later.**
18. **Medical/IBS users increase the importance of confidence and reduce tolerance for false certainty.**
19. **Map infrastructure cannot rely blindly on free OSM public services at scale.** OSM data are open; public servers have usage limits.
20. **The right MVP success metric is not installs or map pins. It is successful urgent journeys to usable toilets.**

---

# 11. TOP 10 RISKS

## 1. Official dataset endpoint / licence ambiguity

The city confirms the data ecosystem, but the exact current toilet API endpoint/schema/licence must be verified before production ingestion.

## 2. Stale opening hours

A physically existing toilet can become a high-severity product failure if it is locked.

## 3. False public-access assumptions

Restaurants, schools, offices and shops may contain toilets without allowing non-customers to use them.

## 4. Duplicate facilities

Multiple sources and indoor venues can create duplicate or incorrectly merged toilet records.

## 5. Overclaiming “open now”

Scheduled hours are not equivalent to real-time operational status.

## 6. Wyszczaj.to overlap

A product that differentiates only on funny Polish copy is too easy to dismiss as a clone.

## 7. Profanity reducing reach

The brand can become memorable but may create issues with institutions, families, SEO snippets, app-store distribution later or partnerships. Keep utility copy controllable and separate from the strongest campaign copy.

## 8. Map/provider cost and policy risk

Free public OSM services have rate/usage policies and no SLA. Production map/geocoding choices need explicit provider planning.

## 9. Privacy creep

Exact location is sensitive in practice even when not legally categorised the same way as special-category data. Avoid storing continuous movement history without a clear reason.

## 10. Feedback poisoning / low-quality reports

Crowdsourcing improves freshness but can also introduce vandalism, jokes and mistaken closures. Reports need weighting and moderation rules.

---

# 12. TOP 10 PRODUCT OPPORTUNITIES

## 1. **“Najbliższy sensowny kibel” ranking**
Rank by actual usability, not raw distance.

## 2. **PEWNIAK / RACZEJ / NIEPEWNE**
A visible confidence system based on source, freshness and verification.

## 3. **Closing-soon intelligence**
Do not route users to a toilet they are unlikely to reach before closing.

## 4. **Entrance-level guidance**
“Poziom -1, wejście od Marszałkowskiej” can be more valuable than another map pin.

## 5. **One-tap open/closed confirmation**
Turn successful journeys into data-freshness signals.

## 6. **Access-friction labels**
Free / paid / customer-only / buy something / code / key / ticket.

## 7. **Payment-method visibility**
Show card/cash/coins when known.

## 8. **Night-aware ranking**
Prioritise 24/7 and late-opening toilets automatically after hours.

## 9. **Tourist English mode**
Immediate advantage over the official app experience.

## 10. **Serious accessibility mode inside an irreverent brand**
Keep the public personality loud, but make wheelchair/changing/medical-critical information sober, precise and trustworthy.

---

# 13. PROPOSED PRODUCT POSITIONING AFTER RESEARCH

The original idea can be sharpened.

### Weak positioning

> Śmieszna mapa kibli w Warszawie.

### Stronger positioning

> **Chce ci się srać? Nie pokażemy ci 40 pinezek. Pokażemy ci, gdzie masz największą szansę wejść teraz.**

### Product promise

**GdzieKibel.pl finds the nearest *usable* toilet, not merely the nearest toilet record.**

### Brand-supporting message

> **MAPA MAPĄ. MY CHCEMY, ŻEBYŚ DOSZEDŁ I FAKTYCZNIE WSZEDŁ.**

---

# 14. RECOMMENDED NEXT DECISIONS

Before the next architecture/code phase, resolve these questions in order:

1. Can the current Warsaw toilet dataset be consumed legally and reliably through a documented API/export?
2. What is its exact schema and current number of canonical-looking records?
3. How much additional Warsaw coverage does OSM add after deduplication?
4. What percentage of combined records have usable opening hours?
5. What percentage have explicit public-access conditions?
6. How many candidate toilets can be confidently labelled “open now” at any given time?
7. What data gaps remain around entrance/floor/payment?
8. Which 100 locations should form the manual gold-standard evaluation set?
9. What ranking formula beats pure distance in offline evaluation?
10. What language intensity is acceptable in core UX versus marketing surfaces?

Until items 1–6 are answered with actual data, the final backend schema and ranking weights should remain adjustable.

---

# 15. SOURCE REGISTER

## Official Warsaw / transport

- Warsaw 19115 — Toalety Miejskie  
  https://warszawa19115.pl/web/guest/-/automatyczne-toalety-miejskie
- Warsaw 19115 — Warszawska Platforma IoT  
  https://warszawa19115.pl/en/-/warszawska-platforma-iot
- Warsaw IoT  
  https://iot.warszawa.pl/
- Warsaw 19115 — Dane po warszawsku  
  https://warszawa19115.pl/web/guest/-/dane-po-warszawsku
- Warszawa 19115 — Google Play  
  https://play.google.com/store/apps/details?id=pl.xentivo.ummobile
- Warszawa 19115 — Apple App Store  
  https://apps.apple.com/pl/app/warszawa-19115/id735957277
- PKP Warszawa Zachodnia  
  https://www.pkp.pl/pl/?catid=21&id=155%3Awarszawa-zachodnia-informacje-dla-pasazera&lang=pl-PL&option=com_content&view=article
- PKP Warszawa Wschodnia  
  https://www.pkp.pl/pl/?catid=21&id=154%3Awarszawa-wschodnia-informacje-dla-pasazerow&lang=pl-PL&option=com_content&view=article
- PKP accessibility search — Warszawa Centralna  
  https://www.pkp.pl/pl/bez-barier?option=com_withoutbarriers&station=Warszawa+Centralna

## OpenStreetMap / infrastructure rules

- OSM toilets tagging  
  https://wiki.openstreetmap.org/wiki/Toilets
- OSM toilets key  
  https://wiki.openstreetmap.org/wiki/Key%3Atoilets
- OSM attribution guidelines  
  https://osmfoundation.org/wiki/Licence/Attribution_Guidelines
- OSM legal FAQ  
  https://wiki.openstreetmap.org/wiki/Legal_FAQ
- Overpass API  
  https://wiki.openstreetmap.org/wiki/Overpass_API
- OSM tile usage policy  
  https://operations.osmfoundation.org/policies/tiles/
- Nominatim usage policy  
  https://operations.osmfoundation.org/policies/nominatim/

## Competitors

- Wyszczaj.to  
  https://wyszczaj.to/
- Wyszczaj.to — Warsaw  
  https://wyszczaj.to/toalety/warszawa
- Wyszczaj.to — About  
  https://wyszczaj.to/about
- Flush Toilet Finder  
  https://apps.apple.com/pl/app/flush-toilet-finder-map/id955254528
- Toilet Finder — Google Play  
  https://play.google.com/store/apps/details?id=com.bto.toilet
- Toilet Finder — App Store  
  https://apps.apple.com/us/app/toilet-finder/id311896604
- Where is Public Toilet — Google Play  
  https://play.google.com/store/apps/details?id=sfcapital.publictoiletinsouthaustralia
- Toilet Map Warsaw  
  https://toiletmap.app/warsaw-masovian-pl
- Toilet Nearest Warsaw  
  https://toiletnearest.com/poland/warsaw

## User evidence / discussions

- Reddit — Public restrooms in Warsaw  
  https://www.reddit.com/r/warsaw/comments/u0hsth
- Reddit — toilet apps / IBS travel  
  https://www.reddit.com/r/ParisTravelGuide/comments/1uslre7/apps_to_find_public_toilets/
- Reddit — LooCation / ostomy community  
  https://www.reddit.com/r/ostomy/comments/1sriqjt/i_built_a_free_app_to_find_public_toilets_because/
- Reddit — LooCation product discussion  
  https://www.reddit.com/r/iosapps/comments/1sugqzl/my_loocation_toilet_finder/
- Tripadvisor — Poland public toilet payment discussion  
  https://www.tripadvisor.com/ShowTopic-g274723-i959-k15578146-Public_toilet-Poland.html
- Warsaw parent discussion — public toilets / playgrounds  
  https://forum.gazeta.pl/forum/w%2C566%2C98106958%2C98106958%2Czabierac_nocnik_na_plac_zabaw_i_do_sklepu_.html

## Warsaw senior evidence

- Official Warsaw senior-needs study (2024)  
  https://wsparcie.um.warszawa.pl/documents/67381/79564632/Badanie%2BSenior%C3%B3w%2Bpr%C3%B3ba%2Bog%C3%B3lnowarszawska.pdf/b121cef3-1e0c-19a0-0a8f-e8a53aedd2d1?t=1744810331498
- Secondary publication surfacing the public-toilet result  
  https://passa.waw.pl/documents/pdfs/numer-17-1260-z-dnia-30042025-1.pdf

---

# Final research recommendation

Proceed with GdzieKibel.pl, but **change the product thesis from “better-looking toilet map” to “availability-confidence engine for toilets.”**

The visual identity and aggressive Polish copy can generate memorability and sharing. They are not the moat.

The moat can become:

> **a Warsaw toilet dataset that knows the difference between “there is a toilet there” and “you can walk in and use it now”.**

That is the part worth designing the backend, ingestion pipeline, UX states and user-feedback loop around.

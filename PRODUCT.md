# GDZIEKIBEL.PL — Product Specification v1

Status: Draft approved direction for implementation planning  
Initial market: Warsaw, Poland  
Product type: Mobile-first public web app / PWA  
Primary language: Polish  

## 1. Product statement

**GdzieKibel.pl helps a person in Warsaw find the nearest realistically usable toilet as fast as possible.**

The core experience is intentionally simple:

> Otwierasz stronę. Chce ci się srać. Widzisz najbliższy sensowny kibel. Klikasz „Prowadź mnie”. Idziesz.

The product is not a city directory, social network, review app, or general map product. It is an urgent utility with a distinctive Polish voice.

## 2. Product principles

In priority order:

1. **Answer fast.** A user in a hurry should understand what to do in seconds.
2. **Do not pretend uncertain data is certain.** Trust is more important than feature count.
3. **One-handed mobile usability.** Core flows must work comfortably on a phone while walking.
4. **The closest toilet is not always the best toilet.** Availability and confidence matter.
5. **Humour must never obscure action.** Brand copy can be aggressive; factual UI remains readable.
6. **No account required.** The core product is immediately usable.
7. **Warsaw first.** Do not dilute the MVP by expanding geography before the Warsaw experience is reliable.

## 3. Target users

### Primary

- People currently in Warsaw who need a toilet quickly.
- Residents moving through the city.
- Visitors and tourists.
- People on public transport or walking between locations.

### Important secondary contexts

- Parents with children.
- Older people.
- People who need step-free / wheelchair-accessible toilets.
- People with urgent digestive or bladder needs.
- Night-time users.
- People who cannot or do not want to buy something to access a toilet.

The product should support these contexts without forcing users into a specialised mode during MVP.

## 4. Jobs to be done

### Core job

> When I urgently need a toilet in Warsaw, show me a nearby option I can realistically use and help me get there with minimal thinking.

### Supporting jobs

- Tell me whether it is likely to be open.
- Tell me whether it is free or paid.
- Tell me whether public access is clear or uncertain.
- Tell me whether accessibility features are known.
- Let me compare a few nearby options.
- Let me report bad information quickly.
- Do not waste my time with a long onboarding flow.

## 5. Primary user journey

1. User opens `gdziekibel.pl` on mobile.
2. App immediately explains its purpose and asks for location access.
3. User grants location permission.
4. App loads nearby toilet candidates.
5. App highlights the **best nearby option**, not just the geometrically closest one.
6. User can see at minimum:
   - distance,
   - approximate walking time,
   - open / closed / uncertain status,
   - free / paid / unknown,
   - confidence indicator where useful.
7. User opens toilet details.
8. User taps **Prowadź mnie**.
9. App opens walking navigation in an external map application/service.

Target: the user should normally reach a navigation decision within a few seconds of granting location access.

## 6. Secondary journeys

### 6.1 Location denied

If the user denies geolocation:

- Do not dead-end.
- Explain plainly why location helps.
- Offer:
  - retry location permission,
  - browse a Warsaw map manually,
  - search by place/address later if implemented.

### 6.2 No useful result nearby

If no suitable toilet exists within the normal search radius:

- say so clearly;
- show the nearest known alternatives beyond the default radius;
- allow the user to expand the search;
- do not imply that no toilet exists anywhere.

### 6.3 User wants only specific toilets

MVP filters:

- open now / likely open,
- free,
- wheelchair accessible where data exists,
- baby changing where data exists,
- 24h where data exists.

Unknown data must remain distinguishable from `false`.

### 6.4 User spots wrong data

User can report a problem without an account.

MVP report reasons:

- toilet is closed,
- toilet no longer exists,
- opening hours are wrong,
- price is wrong,
- public access is not available,
- accessibility data is wrong,
- other.

A report must not immediately rewrite canonical data without moderation or confidence logic.

## 7. MVP scope

### Required

- Mobile-first responsive web app.
- Warsaw map.
- Browser geolocation.
- Nearby toilet retrieval.
- Map markers.
- Nearest/best toilet ranking.
- Toilet list view or list sheet.
- Toilet details sheet/page.
- Distance from user.
- Approximate walking-time label.
- Free / paid / unknown.
- Opening-status representation.
- Basic accessibility metadata where known.
- Core filters.
- External walking navigation.
- Data source / confidence support in backend model.
- User problem reporting.
- Basic product analytics without storing precise user location.
- Error and empty states.
- Accessibility baseline.
- Production deployment and monitoring.

### Explicit MVP non-goals

- User accounts.
- Social feed.
- Reviews and star ratings.
- Public comments.
- Gamification.
- Photo uploads.
- Full admin CMS.
- Route rendering inside GdzieKibel.pl.
- Turn-by-turn navigation.
- All of Poland.
- Native iOS/Android apps.
- Complex recommendation AI.
- Ads or monetisation implementation.

## 8. Core entities

### Toilet

A canonical toilet location presented to users.

Required conceptual fields:

- stable ID,
- name/label,
- coordinates,
- address where known,
- district where derivable,
- access type,
- price state,
- opening-hours state,
- accessibility fields,
- source provenance,
- last verification/update metadata,
- confidence state,
- lifecycle/status.

### Source record

A raw or normalised record imported from an external source. Multiple source records may map to one canonical toilet.

### Toilet report

A user-submitted issue against a toilet.

### Ingestion run

Metadata describing one import/update run for an external dataset.

## 9. Data truth model

The product must never silently collapse `unknown` into `no`.

Examples:

- `is_free = unknown` is not the same as `is_free = false`.
- `wheelchair_accessible = unknown` is not the same as `false`.
- missing opening hours do not mean closed.

### Confidence levels

Use an internal confidence model that can be surfaced selectively:

- **HIGH** — recent, trusted source or strong cross-source agreement.
- **MEDIUM** — plausible source with partial/stale metadata.
- **LOW** — old, single, incomplete or user-reported data not yet corroborated.

Exact scoring weights are an architecture/data decision and should be testable.

## 10. Opening status model

User-facing states:

- `OPEN`
- `CLOSED`
- `LIKELY_OPEN`
- `LIKELY_CLOSED`
- `UNKNOWN`

Rules:

- Never claim `OPEN` unless current time can be evaluated against sufficiently trusted hours or equivalent evidence.
- If hours are incomplete or stale, prefer a qualified state.
- For seasonal toilets, seasonality must be represented explicitly where the source supports it.

## 11. Ranking logic

The product ranks **usable nearby toilets**, not simply raw distance.

MVP ranking should consider, in order:

1. known closed vs usable/unknown,
2. geospatial distance,
3. confidence of availability/opening data,
4. public-access confidence,
5. user-selected filters,
6. price preference where relevant.

Suggested behaviour:

- Known closed toilets should not be the default recommendation.
- A slightly farther high-confidence open public toilet may outrank a closer uncertain one.
- The UI should still allow the user to see nearby alternatives.

The final score formula must be documented in code/tests when implemented; avoid an opaque magic score.

## 12. Distance and ETA

### MVP distance

Use geospatial distance from current user position to toilet coordinates.

### MVP walking-time estimate

If exact routing is not implemented, label the estimate as approximate and derive it conservatively from distance.

Do not present a straight-line estimate as an exact walking route time.

### Navigation

The `Prowadź mnie` action should open a walking route in a supported external maps provider using the toilet coordinates.

## 13. Functional requirements

### FR-01 Initial load

- Public page loads without authentication.
- Critical UI appears before non-critical decorative assets.
- App remains understandable if geolocation has not yet been granted.

### FR-02 Geolocation

- Request browser location only as part of a clear user action or explicit initial flow.
- Handle granted, denied, unavailable and timeout states.
- Never persist precise location by default.

### FR-03 Nearby toilets

- Given valid coordinates, return nearby canonical toilets within configured radius.
- Results must be ordered deterministically according to ranking rules.
- API must represent unknown values explicitly.

### FR-04 Map

- Display current location if permission is granted.
- Display nearby toilet markers.
- Selected marker and selected detail card remain synchronised.

### FR-05 Toilet detail

Display known values only, including:

- name/label,
- distance,
- approximate walking time,
- opening status,
- price,
- accessibility features,
- data-confidence/source hint where appropriate,
- report action.

### FR-06 Filters

Filters update map and list consistently.

### FR-07 Navigation

A single clear action launches external walking navigation.

### FR-08 Reports

- Reports require no account.
- Inputs are validated and rate-limited.
- Report submission must not expose private user data.
- Success and failure states are visible.

### FR-09 Analytics

Track product behaviour such as:

- app opened,
- location granted/denied,
- nearby results loaded,
- toilet selected,
- navigation clicked,
- filter applied,
- report submitted,
- no-results state.

Never send raw precise latitude/longitude to analytics.

## 14. Privacy requirements

- No account for core use.
- Do not store precise live user location in the product database.
- Do not include precise coordinates in analytics events.
- Avoid placing precise user coordinates in request URLs if avoidable, because URLs can appear in logs.
- Avoid third-party trackers not needed for the product.
- Document all external services that receive IP/location-derived information.

## 15. Accessibility requirements

- Core flows must be keyboard accessible.
- Touch targets at least 44x44 CSS px where practical.
- Sufficient contrast.
- Do not rely on colour alone for status.
- Map interactions must have list equivalents.
- Screen-reader labels for icons and markers.
- Strong/profane branding must not replace factual labels.
- Respect reduced-motion preferences.

## 16. Performance requirements

Target mobile experience:

- App shell becomes interactive quickly on modern mobile networks.
- Map library should not block the first meaningful call-to-action unnecessarily.
- Nearby query should normally complete fast enough to feel immediate after geolocation.
- Avoid downloading all Warsaw toilet data if a bounded nearby query is sufficient.
- Lazy-load non-critical visuals.

Concrete performance budgets should be added during foundation/performance tasks after baseline measurement.

## 17. SEO and share behaviour

MVP:

- Indexable home page describing the service.
- Correct title, description, Open Graph image and favicon.
- Dynamic toilet detail pages are optional; do not build them solely for SEO before core utility is reliable.

Potential post-MVP:

- district landing pages,
- public toilet pages with stable URLs,
- editorial pages such as `kible-24h-warszawa`.

## 18. Edge cases

The implementation must explicitly handle:

- user outside Warsaw,
- location accuracy is very poor,
- location permission denied,
- no toilets within default radius,
- only closed toilets nearby,
- price unknown,
- hours unknown,
- duplicate source records,
- toilet moved or removed,
- temporary/seasonal toilet,
- source import fails,
- map provider fails,
- external navigation app unavailable,
- slow network,
- malformed source data,
- repeated report abuse.

## 19. Product copy constraints

The product is allowed to swear. The brand should feel blunt and memorable.

However:

- Swear at the **situation**, not at protected groups or vulnerable users.
- Do not obscure instructions with jokes.
- Use at most one dominant joke/punchline per state/screen.
- Core facts such as `OTWARTY`, `ZAMKNIĘTY`, `240 M`, `2 PLN` stay literal.
- Error copy may be funny but must also explain the next action.

See `BRAND.md` and `DESIGN.md`.

## 20. Definition of MVP production-ready

The MVP is production-ready when:

- the primary journey works end-to-end on representative mobile browsers;
- Warsaw toilet data can be ingested reproducibly;
- nearby search is correct and performant;
- geolocation failure states are usable;
- navigation opens correctly;
- filters behave consistently;
- user reports are validated and rate-limited;
- no precise user location is stored in product analytics/database;
- critical flows have automated tests;
- accessibility baseline passes review;
- logging/error tracking is configured without leaking sensitive values;
- staging verification passes;
- production has a documented rollback path.

## 21. Assumptions requiring research/validation

This file intentionally does not invent answers to the following:

- final official/public Warsaw toilet data sources;
- legal/licensing terms for every source;
- exact source refresh frequencies;
- exact completeness of opening hours, price and accessibility data;
- final map tile provider pricing;
- final traffic scale and infrastructure cost;
- final deduplication thresholds after examining real datasets.

These must be resolved in research/data tasks before being treated as fact.

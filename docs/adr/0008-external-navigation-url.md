# ADR 0008 — External navigation URL

Status: Accepted
Date: 2026-09-13
Scope: TASK-012 — External walking navigation

## Context

`ARCHITECTURE.md` section 12 is specific but leaves two things open: "Provide
at least a Google Maps web fallback. Platform-specific Apple Maps support
may be added when tested," and "Do not embed private user coordinates into
shareable URLs unnecessarily; destination-only external links are
sufficient when the map app can use current location." Implementing the
`PROWADŹ MNIE` CTA requires picking an exact URL format and deciding
whether to build the optional Apple Maps path.

## Decisions

### Google Maps web URL, destination-only

`https://www.google.com/maps/dir/?api=1&destination=<lat>,<lng>&travelmode=walking`.
This is Google's documented, stable "Maps URLs" format: it needs no API
key, works from any browser without a maps SDK, and — critically — has no
`origin` parameter set. Google Maps supplies the starting point from the
device's own location once the link opens (with the user's own consent
inside Google Maps, a separate permission from this app's), exactly
matching "destination-only external links are sufficient when the map app
can use current location." The URL-building function's only input is the
toilet's own `{ lat, lng }`; there is no parameter through which this app's
own granted user location could be threaded into the generated URL even by
mistake.

### Apple Maps is not added

`ARCHITECTURE.md` conditions Apple Maps support on being tested
("may be added when tested"). This session has no way to genuinely test
that an `maps://` or `https://maps.apple.com/` link actually opens the
native Apple Maps app and produces a correct walking route on a real iOS
device — the same category of limitation already documented for the
MapTiler tile provider (no way to visually confirm real tiles from this
sandbox). Building it now would be exactly what `ARCHITECTURE.md`'s
phrasing warns against: shipping a second, untested code path. The single
Google Maps link already works correctly in Safari on iOS (it opens
Google Maps if installed, or the Google Maps website otherwise), so iOS
users are not left without a working action; a native Apple Maps deep link
is additive polish for later, once a session can test it.

### A real `<a>`, not a scripted `window.open`

The CTA is rendered as a plain anchor with `target="_blank"` and
`rel="noopener noreferrer"` rather than a button with an imperative
`window.open` call. An anchor is inspectable (its `href` is the actual,
final destination, verifiable in a test without executing a click),
keyboard- and screen-reader-native, and behaves correctly with browser
features a scripted approach would have to reimplement (open in new tab,
copy link, long-press-to-share on mobile). There is no reason implied by
`ARCHITECTURE.md` or `DESIGN.md` to prefer scripted navigation here.

## Consequences

- The navigation URL is client-generated from data the client already has
  (`NearbyToiletResult.lat`/`.lng`); no new server endpoint exists or is
  needed, matching `ARCHITECTURE.md` section 12's "server/client-side"
  phrasing choosing the simpler of the two.
- This session cannot verify that following the generated link actually
  reaches a working Google Maps walking route: a direct `curl` to
  `google.com` from this environment is refused by the egress proxy with
  HTTP 403, the same restriction already documented for MapTiler, Overpass,
  and the Warsaw open-data hosts. The URL format itself is Google's stable,
  documented "Maps URLs" scheme, and its construction is fully verified by
  unit test and by asserting the real rendered `href` in Playwright; only
  the live round trip through Google's own servers is unverified here.
- Adding Apple Maps later is additive: a second URL-builder function and a
  platform check, not a rewrite of this one.

## Not decided here

Whether to eventually add platform detection (Apple Maps on iOS, Google
Maps elsewhere) is left for whenever a session can actually test it on a
device, per `ARCHITECTURE.md`'s own condition.

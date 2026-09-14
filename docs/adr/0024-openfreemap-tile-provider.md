# ADR 0024 — OpenFreeMap tile provider

Status: Accepted
Date: 2026-09-14
Scope: Owner-directed addition outside the task sequence

## Context

`docs/adr/0005-map-tile-provider.md` chose MapTiler Cloud as a
provisional, swappable default, explicitly "not a final commercial
commitment." `ARCHITECTURE.md` section 23 left the real provider
decision open, to revisit "before production traffic." Across this
entire session, no environment has held a real `NEXT_PUBLIC_MAPTILER_KEY`
or had egress to `api.maptiler.com`, so the map has never been visually
verified rendering real tiles — recorded repeatedly in `PROGRESS.md` as
an open verification item. The project owner asked directly whether
MapLibre GL JS (already at 6.9.0 in this project) could be used with
OpenFreeMap, a free, keyless, production-oriented OSM vector tile
service, specifically to close this gap without waiting on a paid key.

## Decision

**OpenFreeMap** replaces MapTiler as the tile provider. `lib/map/tile-provider.ts`
now exports a fixed constant, `MAP_STYLE_URL`, pointing at OpenFreeMap's
`positron` style — no API key, no environment variable, no per-domain
restriction to configure.

### Why OpenFreeMap satisfies `ARCHITECTURE.md`'s "commercial/production-safe" bar

`ARCHITECTURE.md` section 2 requires "a commercial/production-safe
OSM-compatible tile provider" and forbids the public OSM tile servers
specifically. OpenFreeMap is not the public OSM tile server: it is a
purpose-built, separately-funded service explicitly designed for
unrestricted production use — no registration, no per-domain key, no
published rate limit — which is the substantive thing that clause rules
out (a service whose usage policy prohibits production traffic), not a
requirement that money change hands. The real, honest trade-off is that
OpenFreeMap carries no paid support tier or contractual SLA, unlike
MapTiler's paid plans; that is recorded as a named, accepted risk below,
not glossed over.

### `positron`, not `liberty` or `bright`

`DESIGN.md` section 8 requires "a muted dark or desaturated map style so
toilet markers dominate." OpenFreeMap ships three ready styles: `liberty`
and `bright` are both colourful, general-purpose styles that would
compete with the toilet markers for attention; `positron` is light and
desaturated, the closest available match. None is genuinely dark —
MapTiler's `dataviz-dark` was — but no OpenFreeMap style is, and this
project has no design-asset pipeline to author a custom one (the same
constraint `docs/adr/0022-seo-share-baseline.md` already named for the
share-image work).

### A fixed constant, not a function of a key

There is nothing left to "build" once no key exists, so `buildMapStyleUrl(key)`
becomes `MAP_STYLE_URL`, a plain exported string. It stays in its own
module, per ADR 0005's original reasoning: a future provider change
touches this one file, not every call site.

### The map shell now always attempts a real load

This is the one behavioural change worth naming explicitly. ADR 0005's
fallback design relied on an a-priori signal — "no key configured" — to
skip importing `maplibre-gl` and its stylesheet entirely
(`docs/adr/0020-lazy-load-map-library-styles.md`'s whole optimisation was
built around that signal). A keyless provider has no equivalent signal:
there is no longer a way to know in advance that loading would be
pointless. `components/map/MapShell.tsx`'s effect now runs on every
mount, in every environment, including this project's own sandboxed
development/CI sessions, which cannot reach `tiles.openfreemap.org`
either (confirmed directly: `curl` to it returns the same proxy `403`
already recorded for MapTiler and the Warsaw/OSM hosts). The fallback
state still renders correctly — now reached via a genuine failed load
(`map.on('error')` before the map's first successful load) rather than a
"key absent" short-circuit, which is arguably the more honest test of the
real fallback path than the old stub ever was.

TASK-025's other, separate optimisation — keeping `maplibre-gl`'s ~11 KB
(gzipped) stylesheet out of `globals.css` and the main bundle, loading it
only alongside the script that needs it — is unaffected and still real:
`e2e/home.spec.ts`'s regression test was rewritten to assert the new true
invariant (maplibre-gl's stylesheet is fetched, but never appears among
the stylesheets the server-rendered HTML itself links) rather than the
now-false "never fetched at all" claim.

## Consequences

- `NEXT_PUBLIC_MAPTILER_KEY` no longer exists anywhere in this codebase;
  removed from `.env.example`. No Vercel environment variable needs to be
  configured for the map to work.
- Every environment, including this sandboxed session, now attempts a
  real network request to OpenFreeMap on every map-shell mount. This was
  not previously true when no key was configured, and is a real, accepted
  change in what "just loading the page" costs on the network — bounded
  by the same existing fallback UI either way.
- This session still cannot visually confirm real tiles rendering: the
  same egress restriction that blocked MapTiler blocks OpenFreeMap too.
  This closes the *provider* half of the long-standing verification gap,
  not the *reachability-from-this-sandbox* half — that still needs a real
  deployment (now that one exists; see `PROGRESS.md`).
- No per-domain key restriction exists to misconfigure or leak; there is
  no key at all.

## Not decided here

Whether OpenFreeMap's lack of a formal SLA is acceptable for real
production traffic long-term, versus a paid provider once real usage
exists, is left for a future decision with real traffic data — the same
category of "first pass, not calibrated" decision as
`docs/adr/0016-report-rate-limiting.md`'s rate limit. Whether a custom,
genuinely dark style is worth authoring later (closing the remaining gap
against `DESIGN.md`'s "muted dark" preference) is also left open.

# ADR 0005 — Map tile provider

Status: Superseded by `docs/adr/0024-openfreemap-tile-provider.md` (2026-09-14)
Date: 2026-09-13
Scope: TASK-005 — Render Warsaw map shell

## Context

`ARCHITECTURE.md` section 2 requires MapLibre GL JS with "production/vector or
raster tiles from a commercial/production-safe OSM-compatible tile provider,"
and explicitly forbids relying on the public OpenStreetMap tile servers for
production traffic. Section 23 lists the exact provider as a decision still
requiring validation, and says the choice should stay configurable through
environment variables "until pricing/terms are validated."

TASK-005 needs a map rendering today. This ADR makes a provisional choice under
that explicit instruction to keep it swappable, not a final commercial
commitment.

## Decision

**MapTiler Cloud** is the default provider, selected through one environment
variable: `NEXT_PUBLIC_MAPTILER_KEY`.

Reasons:

- ships ready vector styles compatible with MapLibre GL JS out of the box,
  including a muted/dark style that matches `DESIGN.md` section 8's basemap
  requirement without custom style authoring;
- a usable free tier exists for development and low-volume staging;
- the API key MapTiler issues for this use is a **publishable key**, meant to
  sit in client-side code and be restricted by allowed domain in the MapTiler
  dashboard. It is not a secret credential, unlike `DATABASE_URL`. This is why
  it is a `NEXT_PUBLIC_` variable and not read through
  `lib/env/server.ts`, which is for values that must never reach the browser.

The style URL is built by one function, `lib/map/tile-provider.ts`, so
switching provider later means changing that module, not every call site.

## Why not the public OSM tile servers

`ARCHITECTURE.md` section 2 forbids this outright. The OSM tile usage policy
also prohibits it for anything beyond light, non-commercial use.

## Consequence: the map has a required fallback state

Because the key is an environment variable, and no key is committed or exists
in this environment, the map shell must render correctly with the variable
**absent**. `components/map/MapShell.tsx` checks for the key before importing
or initialising MapLibre at all; when it is absent, the component renders the
literal fallback state from `DESIGN.md` section 13 and `BRAND.md`'s
"API/network error" copy, translated in both locales, rather than a blank or
broken map.

This is not a workaround for this project's sandboxed environment alone. Any
deployment that has not yet configured a key needs the same graceful state,
and a misconfigured or revoked key in production needs it too.

## Consequences

- No API key is committed anywhere, including `.env.example`, which lists the
  variable name only.
- The live map has never been visually verified from this session: no
  environment here holds a real key, and this session's egress does not reach
  `api.maptiler.com`. `PROGRESS.md` records this as an open verification item
  alongside the OpenStreetMap ingestion fetch from ADR 0003.
- Switching provider later touches `lib/map/tile-provider.ts` and the one
  environment variable name; it does not touch `MapShell.tsx`'s rendering
  logic, which only needs a style URL string.

## Not decided here

Final commercial terms, a paid plan, a self-hosted tile server, and whether
raster or vector tiles are used past the default style. Revisit before
production traffic, per `ARCHITECTURE.md` section 23.

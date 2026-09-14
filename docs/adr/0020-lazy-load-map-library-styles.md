# ADR 0020 — Lazy-load the map library's stylesheet with its script

Status: Accepted
Date: 2026-09-14
Scope: TASK-025 — Performance pass

## Context

`PLAN.md`'s outcome: "measured mobile performance meets agreed budgets or
has documented remaining constraints." `PRODUCT.md` section 16 names "map
library should not block the first meaningful call-to-action
unnecessarily" as a target, but sets no number, asking instead for a
baseline measurement first.

A real mobile Lighthouse run (`pnpm build && pnpm start`, simulated
throttling, 390×844 mobile viewport) against the fallback path — the only
path this session's environment can exercise, since no
`NEXT_PUBLIC_MAPTILER_KEY`/egress to a real tile provider exists here —
found `unused-css-rules` scoring `0.5`, flagging 10,844 of 11,054
transferred bytes (98%) as unused on that page load. That chunk was
`maplibre-gl/dist/maplibre-gl.css` (≈83 KB raw), imported unconditionally
in `app/globals.css` and therefore downloaded on every page view — even
the fallback state, where no map ever mounts and none of that CSS's
selectors ever match anything in the DOM.

`components/map/MapShell.tsx` already dynamically imports the `maplibre-gl`
**script** (`import('maplibre-gl')`, gated behind `styleUrl` being set) for
exactly this reason, with its own doc comment stating the ~200 KB library
"is never fetched, and never touches the DOM, on the fallback path." The
CSS import was the one piece of that intent left unapplied.

## Decision

Move the CSS import into the same conditional, dynamically-imported code
path as the script: `Promise.all([import('maplibre-gl'), import('maplibre-gl/dist/maplibre-gl.css')])`,
constructing the `Map` instance only once both resolve. Remove the
unconditional `@import 'maplibre-gl/dist/maplibre-gl.css';` from
`app/globals.css`.

Both are awaited together, not the script alone, so the map's own DOM
(canvas, zoom controls) is never inserted before its styles have loaded —
avoiding a flash of unstyled map content on the one path that does load
both.

This generalises to a real, project-wide pattern rather than one-off
special-casing: **any library's CSS follows the same load gate as the
script that needs it** — if the JS is conditionally/lazily loaded, so is
its stylesheet. No CSS-in-JS or component-scoped-styles mechanism replaces
this; it is a direct application of the same reasoning already used for
the script, extended to cover the piece it missed.

## Measured result

Before/after, same real Lighthouse mobile run against the fallback page:

| Metric (fallback path)      | Before  | After           |
| ---------------------------- | ------- | ---------------- |
| `unused-css-rules` audit      | 0.5 (11 KiB est. savings) | 1.0 (nothing flagged) |
| Total page byte weight        | 257 KiB | 247 KiB           |
| Total Blocking Time            | 170 ms  | 130 ms / 50 ms (two runs) |
| Time to Interactive            | 2.6 s   | 2.4 s             |
| Performance score              | 97      | 97 / 98 (two runs) |

Largest Contentful Paint moved within normal simulated-lab run-to-run
noise (2.1 s / 2.4 s / 2.3 s across three runs of the same build) — not a
regression attributable to this change; the fallback page's LCP element
does not depend on this CSS. The Performance score was already
near-ceiling before this change (97/100) since the fallback page is
light; the fix is a real, measured reduction in dead weight and blocking
time on a page that will only ever get lighter from here, not a
score-moving headline number.

## Consequences

- The map's own DOM is now provably never created before its stylesheet
  has loaded, on the one path (a real tile-provider key configured) that
  loads both — `Promise.all` making that explicit, not implicit in
  import order.
- A future library added to this project with its own stylesheet should
  follow the same rule: gate the CSS import behind the same condition
  that gates the script, not `app/globals.css`.
- This session still cannot measure the real-tile-provider path (no
  `NEXT_PUBLIC_MAPTILER_KEY`/egress here, per every prior task's own
  recorded constraint) — the improvement is proven on the fallback path
  only; a session with real map access should re-run this same Lighthouse
  comparison against a granted-location, tiles-loaded view.

## Not decided here

No performance budget (a numeric pass/fail threshold) is set — `PRODUCT.md`
section 16 explicitly defers concrete budgets to "after baseline
measurement," and this session's baseline is itself incomplete (fallback
path only). Bundle-analyzer-driven optimisation of the maplibre-gl chunk
itself, `next/image` usage (no product images exist yet), and any
CDN/caching change are all out of this task's scope.

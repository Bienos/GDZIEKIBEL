# TASK-025 — Performance pass

## Goal

`PLAN.md`'s outcome: "measured mobile performance meets agreed budgets or
has documented remaining constraints." `PRODUCT.md` section 16 names the
target experience but deliberately sets no numbers: "app shell becomes
interactive quickly," "map library should not block the first meaningful
call-to-action unnecessarily," "nearby query should normally complete
fast enough to feel immediate after geolocation," "avoid downloading all
Warsaw toilet data if a bounded nearby query is sufficient," "lazy-load
non-critical visuals" — and says explicitly that "concrete performance
budgets should be added during foundation/performance tasks after
baseline measurement." This task's first real step is measurement, not
guessed optimisation.

## Design decision: measure first, fix only what the measurement proves

`AGENTS.md`'s own verification rule — "never claim success without
observed command/test evidence" — applies here as much as to correctness.
This task does not invent performance work; it runs a real mobile
Lighthouse audit and the framework's own bundle analyzer against a real
`pnpm build && pnpm start` production server (this session's own
established pattern for every prior task), records the numbers as the
budget baseline, and fixes only what that evidence shows is a real,
in-scope problem — not a larger performance-oriented refactor.

## Canonical constraint: never weaken location privacy for speed

`ARCHITECTURE.md` section 15 (Caching) already binds this task: the
nearby search response stays `no-store` (uncached) because it is built
from the current location; no shared cache may ever be keyed by precise
coordinates. Any caching work this task does must stay inside static/
config data and map provider assets, per section 15's own list — never
the location-bearing response itself.

## User-visible outcome

Faster first paint / first interaction on the fallback (no-tile-key) path
already exercised by this session's own e2e suite, from removing a
real, measured no-op cost. No visible change to any feature.

## Acceptance criteria

- A real Lighthouse mobile run against a running production build is
  recorded, with real numbers, not descriptions.
- A real bundle-composition snapshot (this Next.js version's own
  Turbopack analyzer, per its docs at
  `node_modules/next/dist/docs/01-app/02-guides/package-bundling.md`) is
  recorded.
- Any fix made is justified by that evidence, not applied speculatively.
- No existing test (unit, integration, e2e) regresses.

## In scope

- Running `next experimental-analyze --output` and `lighthouse` (via
  `npx`, using the pre-installed Chromium) against `pnpm build && pnpm
  start`, and recording the real results.
- Fixing any real, evidence-backed, low-risk issue the measurement
  surfaces that is already inside this project's existing scope (e.g., an
  unconditionally-loaded asset that a feature already lazy-loads its JS
  for) — not a new feature or a speculative refactor.
- Documenting the measured numbers as this project's performance budget,
  or documenting why a number could not be measured in this environment
  (no `NEXT_PUBLIC_MAPTILER_KEY`/egress to a real tile provider, per every
  prior task's own recorded constraint).
- An ADR if a real, generalisable pattern decision comes out of this
  (e.g., how CSS/JS for optional/heavy libraries is loaded going forward).

## Out of scope

Do **not**:

- add a new performance-monitoring service or dependency (`ARCHITECTURE.md`
  section 21 rules out adopting infrastructure without evidence; this
  session's own environment can already run Lighthouse and the built-in
  Turbopack analyzer with nothing new to install);
- change the nearby search response's caching (`no-store` stays, per
  `ARCHITECTURE.md` section 15);
- guess at optimisations the measurement does not support;
- attempt a real-tile-provider performance run (still blocked — no
  `NEXT_PUBLIC_MAPTILER_KEY`/egress in this session, per every prior
  task's own recorded constraint) — document the gap instead of
  fabricating a number.

## Canonical context to read

- `AGENTS.md`
- `PROGRESS.md`
- `PRODUCT.md` section 16
- `ARCHITECTURE.md` sections 15, 16, 21
- `node_modules/next/dist/docs/01-app/02-guides/production-checklist.md`,
  `package-bundling.md`, `lazy-loading.md` (this Next.js version's own
  guidance — "This is NOT the Next.js you know")

## Likely relevant code

- `app/globals.css` (the app's one global stylesheet)
- `components/map/MapShell.tsx` (the existing `import('maplibre-gl')`
  lazy-load, and its own doc comment on why)
- `next.config.ts`

## Constraints

- No new dependency; no new required environment variable.
- No change to any route's response shape, caching, or behaviour.

## Verification

Run and record:

- `pnpm lint`, `pnpm format:check`, `pnpm typecheck`
- `pnpm test:unit`, `pnpm test:integration`
- `pnpm build`
- `pnpm test:e2e`
- A real Lighthouse mobile run and a real bundle-analyzer run against
  `pnpm build && pnpm start`, before and after any fix, with real numbers
  quoted.

## Definition of done

TASK-025 is complete only when:

- a real, dated performance baseline (Lighthouse + bundle composition)
  exists in `PROGRESS.md`, not a description of intent;
- any fix made is backed by that same evidence, and every existing test
  still passes unmodified;
- the real, still-unmeasurable gap (no real tile provider/egress in this
  session) is named honestly, not silently skipped or fabricated;
- the complete diff contains no unrelated changes.

Then stop. Do not begin TASK-026.

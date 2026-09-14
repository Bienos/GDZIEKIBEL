# ADR 0022 — SEO/share baseline: code-generated assets, resolved site URL

Status: Accepted
Date: 2026-09-14
Scope: TASK-027 — SEO/share baseline

## Context

`PLAN.md`'s outcome: "metadata, social card, canonical basics and
crawler-safe landing content are correct." `PRODUCT.md` section 17 names
the MVP checklist: an indexable home page, correct title/description/OG
image/favicon, and an explicit rule against building dynamic toilet
detail pages solely for SEO.

Reading `app/[locale]/layout.tsx` directly showed `generateMetadata`
already produced a real per-locale `title`/`description` and
`alternates.canonical`/`languages` (from the TASK-002 language switch).
What was missing, confirmed by direct inspection rather than assumed: no
`public/` directory anywhere in the repository, no favicon, no
`openGraph`/`twitter` block, no `metadataBase`, no `robots.ts`, no
`sitemap.ts` — and `metaDescription`'s own copy in both locales was a
stale TASK-001 leftover ("Foundation build") describing a state the
product left behind twenty-six tasks ago.

## Decisions

### Code-generated `icon`/`opengraph-image`, not external image files

This session has no design asset pipeline and no way to author a real
bitmap by hand. This Next.js version's own file-convention docs
(`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/01-metadata/`)
document generating both via `next/og`'s `ImageResponse` — a first-party,
statically-optimised mechanism (built once per locale at build time,
confirmed by adding `generateStaticParams` to `opengraph-image.tsx` and
observing the build output change from dynamic to prerendered), not a
workaround. Both read this project's own `tokens.css` colours (signal
yellow `#ffd800`, ink `#0b0b0b`, paper `#f5f2ea`) and reuse the exact "WC"
mark `lib/toilets/marker-element.ts` already puts on every map marker, so
the tab icon and the in-app marker read as one visual language, not two
invented ones. The Open Graph image is locale-aware, built from the same
real `metaTitle`/`metaDescription` copy `generateMetadata` uses — never
placeholder text.

### `metaDescription` fixed with already-approved brand copy, not invented tone

`BRAND.md` section 6 ("Home / first open") already approves "WARSZAWA NIE
TRZYMA. MY SZUKAMY." as on-brand copy; section 10 ("Social / campaign
language") approves "WARSZAWA NIE TRZYMA." for exactly this kind of
external-facing, shareable context. The Polish description reuses that
approved phrase, paired with a literal factual clause (`PRODUCT.md`
section 19's own rule: "Core facts... stay literal," "at most one
dominant joke/punchline per state"). The English description stays
literal throughout, matching this project's established PL-brash/EN-plain
localisation pattern (`BRAND.md`'s "Polish internet humour" is explicitly
a Polish-market device, not something to force into the English string).
The visible in-page "stage" badge (`FUNDAMENT PROJEKTU`/`Project
foundation`) is left untouched — a separate, deliberate UI-copy decision,
not a metadata field this task owns.

### `SITE_URL` resolves from the real deployment, never a guessed domain

Once any URL-based metadata field uses a relative path, Next.js's own
docs are explicit: no `metadataBase` is a build error, not a graceful
fallback. `openGraph.images` here is exactly that relative path (the
`opengraph-image` route). `PROGRESS.md` already records this project's
one existing deployment (`gdziekibel-bienos.vercel.app`) as an unofficial,
manually-uploaded stopgap that does not even rebuild on push —
hardcoding it as `metadataBase` would treat an admittedly fragile fact as
a settled one, the exact thing `ARCHITECTURE.md`'s "Decisions still
requiring validation" warns against.

`lib/site-url.ts`'s `resolveSiteUrl` instead layers three sources, in
order: an explicit `SITE_URL` override (unset today; a future session can
set it the moment a real domain exists, no code change needed); Vercel's
own auto-provided `VERCEL_URL` (present on every Vercel deployment and
preview with zero configuration, per `ARCHITECTURE.md`'s own choice of
Vercel as host); `http://localhost:3000` as the last resort for local
development and this session's own build/e2e verification. `SITE_URL` is
deliberately not `NEXT_PUBLIC_`-prefixed: `generateMetadata`, `robots.ts`,
and `sitemap.ts` all run server-side only, so — unlike
`NEXT_PUBLIC_MAPTILER_KEY`, read directly inside a client component — no
client bundle ever needs this value.

### `robots.ts`/`sitemap.ts` point at the two real canonical URLs

`sitemap.ts` lists `/pl` and `/en` — the only two real, indexable pages —
and deliberately excludes the bare `/` redirect target: a sitemap should
name final canonical URLs, not one that immediately redirects.
`robots.ts` allows crawling everything (`/api/*` are POST-only endpoints
a crawler cannot usefully request regardless, and no private page exists
to disallow) and points at the real sitemap through the same
`resolveSiteUrl`.

## Measured result

Verified with a real curl smoke test against a running production build
(`pnpm build && pnpm start`): `/robots.txt` and `/sitemap.xml` return real
content; `/icon` returns a real 32×32 PNG; `/pl/opengraph-image` and
`/en/opengraph-image` return real 1200×630 PNGs (visually confirmed
on-brand); `/pl`'s rendered `<head>` carries a real `<title>`, the fixed
`description`, `rel="canonical"`, a complete `openGraph`/`twitter` block
with absolute image URLs, and `rel="icon"` — all resolved against
`http://localhost:3000` in this environment, exactly as `resolveSiteUrl`'s
own fallback chain predicts with no `SITE_URL`/`VERCEL_URL` set.

## Consequences

- The moment a real production domain is chosen, setting `SITE_URL` in
  that environment is the only change needed — no code, no redeploy of
  logic, matches this project's existing "config over code" precedent for
  environment-specific facts (`NEXT_PUBLIC_MAPTILER_KEY`,
  `DATABASE_URL`).
- Any future route needing its own share image or icon can reuse the same
  `ImageResponse` pattern rather than inventing a new one.

## Not decided here

The real production domain itself remains an open, project-owner
decision (`PROGRESS.md`'s own "Known unresolved decisions"). Dynamic
per-toilet share pages, district landing pages, and any custom-font
loading for the generated images (the current render uses `next/og`'s
system-font fallback, not a loaded brand typeface) are all left for a
later, explicitly-scoped task.

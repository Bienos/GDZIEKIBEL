# TASK-027 — SEO/share baseline

## Goal

`PLAN.md`'s outcome: "metadata, social card, canonical basics and
crawler-safe landing content are correct." `PRODUCT.md` section 17 names
the MVP checklist exactly: "Indexable home page describing the service,"
"Correct title, description, Open Graph image and favicon," and
explicitly rules out building dynamic toilet detail pages "solely for
SEO before core utility is reliable" — none exist yet, and this task adds
none.

## What already exists, read directly rather than assumed

`app/[locale]/layout.tsx`'s `generateMetadata` already sets a real,
per-locale `title`/`description` plus `alternates.canonical` and
`alternates.languages` for the `/pl`/`/en` hreflang pair (from the
TASK-002 language switch). Checking further found the real gaps: no
`public/` directory anywhere in this repository, no favicon file, no
`openGraph`/`twitter` metadata block, no `robots.ts`, no `sitemap.ts`, and
no `metadataBase` — the last one is not optional once any URL-based
metadata field (an Open Graph image, in particular) uses a relative path:
Next.js's own docs are explicit that this "will cause a build error"
without it.

Also found: `metaDescription`'s current copy in both locales ("Wersja
fundamentowa." / "Foundation build.") is stale — a real TASK-001 leftover
describing a state the product left behind twenty-six tasks ago, not
"correct" per this task's own acceptance bar.

## Design decision: code-generated assets, no external image files

This session has no design asset pipeline and no way to author a real
bitmap image file by hand. This Next.js version's own file-convention
docs (`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/01-metadata/`)
document generating `icon`/`opengraph-image` via code using `next/og`'s
`ImageResponse` — a real, first-party, statically-optimised (built once,
cached) mechanism, not a workaround. Both are built from this project's
own `tokens.css` palette and `BRAND.md`'s already-approved copy, not
invented design.

## Design decision: `metadataBase` resolves from the real deployment, not a guessed domain

`PROGRESS.md` already records that this project's one existing deployment
(`gdziekibel-bienos.vercel.app`) is an unofficial, manually-uploaded
stopgap that does not even rebuild on push — hardcoding it as a
permanent `metadataBase` would treat an admittedly fragile fact as a
settled one, the exact thing `ARCHITECTURE.md`'s "Decisions still
requiring validation" and `PROGRESS.md`'s "Known unresolved decisions"
both warn against. Instead: an explicit `SITE_URL` (unset by default, and
— unlike `NEXT_PUBLIC_MAPTILER_KEY` — never `NEXT_PUBLIC_`, since only
server-side code needs it) takes priority when a real domain exists;
Vercel's own auto-provided `VERCEL_URL` (present on every Vercel
deployment and preview, requiring no new configuration) is the fallback;
`http://localhost:3000` is the last resort for local development and this
session's own build/e2e verification. No domain is invented.

## User-visible outcome

A shared link shows a real title, description, and branded image instead
of a link with no preview. Search engines can index the home page and
find `/pl`/`/en` via a real sitemap. The browser tab shows a real favicon
instead of the browser's default.

## Acceptance criteria

- `metaDescription` accurately describes what the product does today, in
  both locales, drawing on already-approved `BRAND.md` copy rather than
  invented tone.
- A real favicon/icon renders in a built production page's `<head>`.
- A real Open Graph image (and matching Twitter card) exists for both
  locales, using a real absolute URL (`metadataBase` resolved, never a
  relative path left unresolved).
- `robots.ts` allows crawling the indexable home page and references a
  real `sitemap.ts` listing `/pl` and `/en`.
- No existing test regresses; the production build succeeds with the new
  metadata files.

## In scope

- `metaDescription` copy fix (both locales) in `lib/i18n/dictionaries.ts`.
- `app/icon.tsx` (code-generated favicon/icon via `next/og`).
- `app/[locale]/opengraph-image.tsx` (code-generated, locale-aware).
- `metadataBase` added to `generateMetadata`, plus `openGraph`/`twitter`
  metadata blocks.
- `lib/site-url.ts` (the `SITE_URL` → `VERCEL_URL` →
  localhost fallback, reused by `metadataBase`/`robots.ts`/`sitemap.ts`).
- `app/robots.ts`, `app/sitemap.ts`.
- `.env.example` documents the new optional variable.
- `docs/CODEMAP.md` and `PROGRESS.md` updates.

## Out of scope

Do **not**:

- build dynamic per-toilet detail pages for SEO (`PRODUCT.md` explicitly
  rules this out before core utility is reliable);
- hardcode a specific domain as a permanent fact when none is settled;
- add a district/editorial landing page (`PRODUCT.md`'s own "potential
  post-MVP" list, not this task's job);
- change the visible in-page "stage" badge copy (`FUNDAMENT
  PROJEKTU`/`Project foundation`) — a separate, deliberate UI-copy
  decision outside this task's SEO/metadata scope, not touched here even
  though it reads similarly dated.

## Canonical context to read

- `AGENTS.md`
- `PROGRESS.md` (the recorded, unofficial deployment; known unresolved
  domain decision)
- `PRODUCT.md` section 17
- `BRAND.md` section 6 ("Home / first open") and section 10 ("Social /
  campaign language") for already-approved copy
- `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/01-metadata/`
  (favicon/icon, opengraph-image, robots, sitemap — this Next.js
  version's own conventions, not assumed from training data)

## Likely relevant code

- `app/[locale]/layout.tsx` (`generateMetadata`)
- `lib/i18n/dictionaries.ts`
- `lib/map/tile-provider.ts` (the existing `NEXT_PUBLIC_*` env-reading
  pattern to mirror)

## Constraints

- No new dependency (`next/og`/`ImageResponse` and the metadata file
  conventions are already part of `next`).
- No new required environment variable — `SITE_URL` is
  optional with a real fallback.

## Verification

Run and record:

- `pnpm lint`, `pnpm format:check`, `pnpm typecheck`
- `pnpm test:unit`, `pnpm test:integration`
- `pnpm build` (confirms the new metadata files compile and the OG image
  route builds without the "relative path without metadataBase" error)
- `pnpm test:e2e`
- A real curl/inspection of a running production build's `<head>` output
  and the generated `/icon`, `/pl/opengraph-image`, `/robots.txt`,
  `/sitemap.xml` routes, confirming real, non-empty output.

## Definition of done

TASK-027 is complete only when:

- the real gaps found (favicon, OG image, `metadataBase`, robots,
  sitemap, stale description) are fixed, not merely described;
- every existing test still passes unmodified;
- `docs/CODEMAP.md` and `PROGRESS.md` reflect the repository, including
  the still-unresolved production domain named honestly;
- the complete diff contains no unrelated changes.

Then stop. Do not begin TASK-028.

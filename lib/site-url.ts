/**
 * Resolves the site's own absolute base URL for `metadataBase`, `robots.ts`,
 * and `sitemap.ts` (TASK-027, `docs/adr/0022-seo-share-baseline.md`).
 *
 * `PROGRESS.md` records this project's one existing deployment as an
 * unofficial, manually-uploaded stopgap — not a settled production domain.
 * Hardcoding it would treat an admittedly fragile fact as permanent. Instead:
 * an explicit override takes priority when a real domain exists; Vercel's own
 * auto-provided `VERCEL_URL` (present on every Vercel deployment/preview,
 * needing no configuration) is the fallback; `localhost` is the last resort
 * for local development and this project's own build/e2e verification.
 *
 * Server-only: no client component needs this value, so it is read as a
 * plain (not `NEXT_PUBLIC_`) variable, unlike `NEXT_PUBLIC_MAPTILER_KEY`.
 * Exported separately from {@link getSiteUrl} so it can be unit tested
 * without mutating the real process environment, the same reason
 * `lib/env/server.ts` exports `parseServerEnv` apart from `getServerEnv`.
 */
export function resolveSiteUrl(env: { SITE_URL?: string; VERCEL_URL?: string }): string {
  if (env.SITE_URL) return env.SITE_URL;
  if (env.VERCEL_URL) return `https://${env.VERCEL_URL}`;
  return 'http://localhost:3000';
}

export function getSiteUrl(): string {
  return resolveSiteUrl({ SITE_URL: process.env.SITE_URL, VERCEL_URL: process.env.VERCEL_URL });
}

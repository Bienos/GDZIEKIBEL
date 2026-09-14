/**
 * Resolves the site's own absolute base URL for `metadataBase`, `robots.ts`,
 * and `sitemap.ts` (TASK-027, `docs/adr/0022-seo-share-baseline.md`).
 *
 * The real production domain is still an open decision, so nothing is
 * hardcoded. The order is an explicit `SITE_URL` override; then, on a
 * production deployment, Vercel's own `VERCEL_PROJECT_PRODUCTION_URL` (the
 * project's stable production host, auto-provided, no configuration);
 * then `VERCEL_URL`; then `localhost` for local development and this
 * project's own build/e2e verification.
 *
 * Production deliberately prefers the stable host over `VERCEL_URL`,
 * which is the *deployment-specific* one (`gdziekibel-3y01rbagl-…`) and
 * therefore an immutable snapshot that never receives another deploy. A
 * production page that writes that host into its own `canonical`/`og:url`
 * hands every reader who copies, shares, or bookmarks a link a URL frozen
 * to one old build — which is exactly how this project's own owner spent
 * a debugging session reloading a pre-fix deployment while the real fix
 * was already live (`docs/adr/0026-maplibre-worker-static-asset.md`).
 *
 * Preview deployments keep `VERCEL_URL`: there the deployment-specific
 * host is the correct self-reference, since a preview is not the
 * production site and should not advertise itself as such.
 *
 * Server-only: no client component needs this value, so it is read as a
 * plain (not `NEXT_PUBLIC_`) variable — that prefix is only for a value a
 * client bundle must read directly.
 * Exported separately from {@link getSiteUrl} so it can be unit tested
 * without mutating the real process environment, the same reason
 * `lib/env/server.ts` exports `parseServerEnv` apart from `getServerEnv`.
 */
export function resolveSiteUrl(env: {
  SITE_URL?: string;
  VERCEL_ENV?: string;
  VERCEL_PROJECT_PRODUCTION_URL?: string;
  VERCEL_URL?: string;
}): string {
  if (env.SITE_URL) return env.SITE_URL;
  if (env.VERCEL_ENV === 'production' && env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  if (env.VERCEL_URL) return `https://${env.VERCEL_URL}`;
  return 'http://localhost:3000';
}

export function getSiteUrl(): string {
  return resolveSiteUrl({
    SITE_URL: process.env.SITE_URL,
    VERCEL_ENV: process.env.VERCEL_ENV,
    VERCEL_PROJECT_PRODUCTION_URL: process.env.VERCEL_PROJECT_PRODUCTION_URL,
    VERCEL_URL: process.env.VERCEL_URL,
  });
}

/**
 * Builds the MapLibre style URL for the configured tile provider.
 *
 * Kept as one pure function, per `docs/adr/0005-map-tile-provider.md`, so
 * switching provider later means changing this module, not every call site
 * that renders a map.
 *
 * The key is a MapTiler publishable key, meant for client-side code and
 * restricted by allowed domain in the provider's dashboard. It is not a
 * secret, unlike `DATABASE_URL`, which is why it is read from a
 * `NEXT_PUBLIC_` variable rather than through `lib/env/server.ts`.
 */

/**
 * `dataviz-dark` is MapTiler's muted/dark style, chosen to satisfy
 * `DESIGN.md` section 8's basemap requirement without authoring a custom
 * style. Revisit only alongside a provider change in ADR 0005.
 */
const MAPTILER_STYLE_ID = 'dataviz-dark';

/**
 * Builds the style URL for a given key. Returns `null` for an empty or
 * whitespace-only key so a caller cannot accidentally build a URL that
 * would fail at MapTiler with an authentication error instead of showing
 * the app's own fallback state.
 */
export function buildMapStyleUrl(apiKey: string | undefined): string | null {
  const trimmed = apiKey?.trim();
  if (!trimmed) return null;

  return `https://api.maptiler.com/maps/${MAPTILER_STYLE_ID}/style.json?key=${encodeURIComponent(trimmed)}`;
}

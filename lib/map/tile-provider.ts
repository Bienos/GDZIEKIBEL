/**
 * The MapLibre style URL for this project's tile provider.
 *
 * OpenFreeMap (`docs/adr/0024-openfreemap-tile-provider.md`, superseding
 * `docs/adr/0005-map-tile-provider.md`'s MapTiler choice): a free,
 * keyless, production-safe OSM vector tile source. `MAP_STYLE_URL` is a
 * fixed constant now — there is no key left to build a URL from — but
 * stays in its own module, per ADR 0005's original reasoning, so
 * switching provider again later touches this one file, not every call
 * site.
 *
 * `positron` (light, desaturated, minimal labels) is the closest of
 * OpenFreeMap's three standard styles to `DESIGN.md` section 8's basemap
 * requirement ("muted dark or desaturated... so toilet markers
 * dominate"); `liberty` and `bright`, OpenFreeMap's other options, are
 * both colourful general-purpose styles that would fight the toilet
 * markers for attention instead.
 */
export const MAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/positron';

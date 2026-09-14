/**
 * Where the browser loads MapLibre's tile-loading Web Worker from.
 *
 * MapLibre GL JS 6 ships that worker as a separate ES module
 * (`dist/maplibre-gl-worker.mjs`, importing `./maplibre-gl-shared.mjs`) and
 * locates it, by default, relative to its own `import.meta.url`. Bundled by
 * Turbopack that URL is not an http(s) one, so MapLibre quietly falls back
 * to an empty worker URL: the browser then starts the worker from the
 * page's own URL, it dies at once, and not one tile is ever requested. The
 * style and its TileJSON still load, the controls and attribution still
 * appear, and the canvas stays blank with nothing in the console — exactly
 * what the live site showed in Safari, reproduced in headless Chromium
 * (`docs/adr/0026-maplibre-worker-static-asset.md`).
 *
 * So the worker is served as a plain static file instead: copied, with
 * the sibling module it imports, from the installed package into `public/`
 * by `scripts/map/copy-maplibre-worker.ts` on every `dev`/`build`, and
 * named explicitly via `setWorkerUrl` before the first map is created.
 */
export const MAP_WORKER_URL = '/maplibre-gl/maplibre-gl-worker.mjs';

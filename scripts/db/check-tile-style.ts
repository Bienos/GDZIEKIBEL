/**
 * One-off diagnostic: walks the whole real tile chain a browser walks —
 * the configured style, each source's TileJSON, and then an actual tile
 * for Warsaw's default view — reporting status, CORS headers and body
 * size at every hop. This sandboxed session has never had egress to any
 * tile host; Vercel's own build environment does, so this runs there.
 *
 * Headers are printed deliberately: Node's own `fetch` never enforces
 * CORS the way a real browser does, so a clean 200 here does not by
 * itself prove a browser can use the response — only a present,
 * permissive `access-control-allow-origin` does.
 *
 * Usage: pnpm db:check-tile-style
 */
import { MAP_STYLE_URL } from '../../lib/map/tile-provider';
import {
  WARSAW_CENTER_LAT,
  WARSAW_CENTER_LNG,
  WARSAW_DEFAULT_ZOOM,
} from '../../lib/map/warsaw-view';

const out = (text: string): void => void process.stdout.write(`${text}\n`);

interface Fetched {
  body: string;
  ok: boolean;
}

async function check(label: string, url: string, asText = true): Promise<Fetched> {
  out(`\n--- ${label}: ${url} ---`);
  try {
    const response = await fetch(url);
    const buffer = await response.arrayBuffer();
    out(`Status: ${response.status} ${response.statusText}`);
    out(`Bytes: ${buffer.byteLength}`);
    out(`content-type: ${response.headers.get('content-type')}`);
    out(`content-encoding: ${response.headers.get('content-encoding')}`);
    out(`access-control-allow-origin: ${response.headers.get('access-control-allow-origin')}`);
    const body = asText ? new TextDecoder().decode(buffer) : '';
    if (asText) out(`Body (first 300 chars):\n${body.slice(0, 300)}`);
    return { body, ok: response.ok };
  } catch (error) {
    out(`FETCH THREW: ${(error as Error).message}`);
    return { body: '', ok: false };
  }
}

/** Web-Mercator tile covering a coordinate, the same maths MapLibre uses. */
function tileCoordinates(lat: number, lng: number, zoom: number): { x: number; y: number } {
  const scale = 2 ** zoom;
  const latRad = (lat * Math.PI) / 180;
  return {
    x: Math.floor(((lng + 180) / 360) * scale),
    y: Math.floor(((1 - Math.asinh(Math.tan(latRad)) / Math.PI) / 2) * scale),
  };
}

async function main(): Promise<void> {
  const style = await check('style', MAP_STYLE_URL);
  if (!style.ok) return;

  const parsed = JSON.parse(style.body) as {
    sources?: Record<string, { type?: string; url?: string; tiles?: string[] }>;
  };
  const sources = Object.entries(parsed.sources ?? {});
  out(`\nStyle declares ${sources.length} source(s): ${sources.map(([name]) => name).join(', ')}`);

  const { x, y } = tileCoordinates(WARSAW_CENTER_LAT, WARSAW_CENTER_LNG, WARSAW_DEFAULT_ZOOM);
  out(`Warsaw default view is tile z=${WARSAW_DEFAULT_ZOOM} x=${x} y=${y}\n`);

  for (const [name, source] of sources) {
    let templates = source.tiles ?? [];

    // A source given by `url` names a second document (TileJSON) that
    // MapLibre fetches itself, in the browser, to learn the real tile URL
    // template — the hop no earlier check followed.
    if (source.url !== undefined) {
      const tileJson = await check(`source "${name}" TileJSON`, source.url);
      if (!tileJson.ok) continue;
      templates = (JSON.parse(tileJson.body) as { tiles?: string[] }).tiles ?? [];
      out(`tiles templates: ${JSON.stringify(templates)}`);
    }

    const template = templates[0];
    if (template === undefined) {
      out(`source "${name}": no tile template to test`);
      continue;
    }

    // The real payload. Never decoded as text: a vector tile is protobuf,
    // a raster tile an image; status, size and CORS are what matter.
    const tileUrl = template
      .replace('{z}', String(WARSAW_DEFAULT_ZOOM))
      .replace('{x}', String(x))
      .replace('{y}', String(y));
    await check(`source "${name}" REAL TILE`, tileUrl, false);
  }
}

main().catch((error: unknown) => {
  process.exitCode = 1;
  process.stderr.write(`Tile style check failed: ${(error as Error).message}\n`);
});

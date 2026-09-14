/**
 * One-off diagnostic: fetches the configured OpenFreeMap style URL (and
 * the vector source it references) directly and reports status, headers,
 * and a body snippet, to determine whether the URL itself is correct —
 * this sandboxed session has never had egress to any tile host, so this
 * cannot be tested locally; Vercel's own build environment can.
 *
 * Headers are printed in full deliberately: Node's own `fetch` never
 * enforces CORS the way a real browser does, so a clean 200 here does
 * not by itself prove a browser can use the response — only a present,
 * permissive `access-control-allow-origin` does.
 *
 * Usage: pnpm db:check-tile-style
 */
import { MAP_STYLE_URL } from '../../lib/map/tile-provider';

async function check(label: string, url: string): Promise<void> {
  process.stdout.write(`\n--- ${label}: ${url} ---\n`);
  const response = await fetch(url);
  const text = await response.text();
  process.stdout.write(`Status: ${response.status} ${response.statusText}\n`);
  process.stdout.write(
    `access-control-allow-origin: ${response.headers.get('access-control-allow-origin')}\n`,
  );
  for (const [key, value] of response.headers.entries()) {
    process.stdout.write(`  ${key}: ${value}\n`);
  }
  process.stdout.write(`Body (first 500 chars):\n${text.slice(0, 500)}\n`);
}

async function main(): Promise<void> {
  await check('style', MAP_STYLE_URL);
  // The style's own `sources.openmaptiles.url` — a second document
  // MapLibre fetches itself, in the browser, to learn the real tile URL
  // template. A CORS or reachability problem here would explain a map
  // that never finishes loading without ever reaching the style fetch
  // above.
  await check('vector source (openmaptiles)', 'https://tiles.openfreemap.org/planet');
}

main().catch((error: unknown) => {
  process.exitCode = 1;
  process.stderr.write(`Tile style check failed: ${(error as Error).message}\n`);
});

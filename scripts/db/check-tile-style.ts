/**
 * One-off diagnostic: fetches the configured OpenFreeMap style URL
 * directly and reports its status and a snippet of its body, to
 * determine whether the URL itself is correct — this sandboxed session
 * has never had egress to any tile host, so this cannot be tested
 * locally; Vercel's own build environment can.
 *
 * Usage: pnpm db:check-tile-style
 */
import { MAP_STYLE_URL } from '../../lib/map/tile-provider';

async function main(): Promise<void> {
  process.stdout.write(`Fetching ${MAP_STYLE_URL}\n`);
  const response = await fetch(MAP_STYLE_URL);
  const text = await response.text();
  process.stdout.write(`Status: ${response.status} ${response.statusText}\n`);
  process.stdout.write(`Content-Type: ${response.headers.get('content-type')}\n`);
  process.stdout.write(`Body (first 500 chars):\n${text.slice(0, 500)}\n`);
}

main().catch((error: unknown) => {
  process.exitCode = 1;
  process.stderr.write(`Tile style check failed: ${(error as Error).message}\n`);
});

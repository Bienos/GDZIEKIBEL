/**
 * Copies MapLibre's worker module (and the sibling it imports) from the
 * installed package into `public/`, where `lib/map/worker-url.ts` points the
 * browser. Runs before every `dev` and `build` (see `package.json`), so the
 * served worker always matches the bundled library version; the output
 * directory is gitignored, never committed.
 *
 * Usage: pnpm map:copy-worker
 */
import path from 'node:path';
import { copyMapLibreWorkerAssets } from '../../lib/map/worker-assets';
import { MAP_WORKER_URL } from '../../lib/map/worker-url';

async function main(): Promise<void> {
  const distDir = path.join(process.cwd(), 'node_modules', 'maplibre-gl', 'dist');
  const destDir = path.join(process.cwd(), 'public', path.dirname(MAP_WORKER_URL));
  const copied = await copyMapLibreWorkerAssets({
    distDir,
    destDir,
    workerFileName: path.basename(MAP_WORKER_URL),
  });
  process.stdout.write(`Copied MapLibre worker assets to ${destDir}: ${copied.join(', ')}\n`);
}

main().catch((error: unknown) => {
  process.exitCode = 1;
  process.stderr.write(`MapLibre worker copy failed: ${(error as Error).message}\n`);
});

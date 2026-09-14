import { copyFile, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';

/** `from "./x.mjs"` — the one import shape MapLibre's ESM worker uses for its siblings. */
const RELATIVE_IMPORT_PATTERN = /\bfrom\s*["'`](\.\/[^"'`]+)["'`]/g;

export interface CopyMapLibreWorkerAssetsOptions {
  /** The installed package's `dist/` directory. */
  distDir: string;
  /** Where the files are served from; created if missing. */
  destDir: string;
  /** The worker module's own filename inside `distDir`. */
  workerFileName: string;
}

/**
 * Copies MapLibre's worker module, and every sibling module it imports by a
 * `./` path (`./maplibre-gl-shared.mjs` in 6.9), from `distDir` into
 * `destDir`, keeping filenames so those imports still resolve once served
 * from there (`lib/map/worker-url.ts`). Returns the copied filenames.
 *
 * Only the worker's own direct imports are followed: that is the full set
 * in 6.9, and the e2e suite exercises the real worker end to end, so a
 * deeper dependency in a future version fails a test rather than a user.
 * A named sibling that does not exist fails here, at build time, instead
 * of as a 404 inside a worker nobody can see.
 */
export async function copyMapLibreWorkerAssets(
  options: CopyMapLibreWorkerAssetsOptions,
): Promise<string[]> {
  const { distDir, destDir, workerFileName } = options;
  const workerSource = await readFile(path.join(distDir, workerFileName), 'utf8');

  const fileNames = [workerFileName];
  for (const match of workerSource.matchAll(RELATIVE_IMPORT_PATTERN)) {
    const specifier = match[1];
    if (specifier === undefined) continue;
    const fileName = specifier.slice('./'.length);
    if (fileName.includes('/') || fileName.includes('..')) {
      throw new Error(`MapLibre worker imports outside its own directory: ${specifier}`);
    }
    if (!fileNames.includes(fileName)) fileNames.push(fileName);
  }

  await mkdir(destDir, { recursive: true });
  for (const fileName of fileNames) {
    await copyFile(path.join(distDir, fileName), path.join(destDir, fileName));
  }
  return fileNames;
}

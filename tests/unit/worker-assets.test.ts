import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { copyMapLibreWorkerAssets } from '@/lib/map/worker-assets';
import { MAP_WORKER_URL } from '@/lib/map/worker-url';

const tempDirs: string[] = [];

async function makeTempDir(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'worker-assets-'));
  tempDirs.push(dir);
  return dir;
}

async function makeDist(files: Record<string, string>): Promise<string> {
  const distDir = path.join(await makeTempDir(), 'dist');
  await mkdir(distDir);
  for (const [name, content] of Object.entries(files)) {
    await writeFile(path.join(distDir, name), content);
  }
  return distDir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('copyMapLibreWorkerAssets', () => {
  it('copies the worker and every sibling it imports by a ./ path, byte for byte', async () => {
    const distDir = await makeDist({
      'worker.mjs': 'import{a}from"./shared.mjs";import b from \'./other.mjs\';a(b);',
      'shared.mjs': 'export const a = () => {};',
      'other.mjs': 'export default 1;',
      'unrelated.mjs': 'never copied',
    });
    const destDir = path.join(await makeTempDir(), 'public', 'maplibre-gl');

    const copied = await copyMapLibreWorkerAssets({
      distDir,
      destDir,
      workerFileName: 'worker.mjs',
    });

    expect(copied).toEqual(['worker.mjs', 'shared.mjs', 'other.mjs']);
    for (const name of copied) {
      expect(await readFile(path.join(destDir, name), 'utf8')).toBe(
        await readFile(path.join(distDir, name), 'utf8'),
      );
    }
    await expect(readFile(path.join(destDir, 'unrelated.mjs'))).rejects.toMatchObject({
      code: 'ENOENT',
    });
  });

  it('fails at copy time when a sibling the worker names does not exist', async () => {
    const distDir = await makeDist({ 'worker.mjs': 'import{a}from"./missing.mjs";' });
    const destDir = path.join(await makeTempDir(), 'out');

    await expect(
      copyMapLibreWorkerAssets({ distDir, destDir, workerFileName: 'worker.mjs' }),
    ).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('refuses an import that leaves the worker directory rather than serving a broken layout', async () => {
    const distDir = await makeDist({ 'worker.mjs': 'import{a}from"./../secret.mjs";' });
    const destDir = path.join(await makeTempDir(), 'out');

    await expect(
      copyMapLibreWorkerAssets({ distDir, destDir, workerFileName: 'worker.mjs' }),
    ).rejects.toThrow(/outside its own directory/);
  });

  it('copies exactly the worker and shared module of the installed maplibre-gl', async () => {
    // Pins the assumption `lib/map/worker-url.ts` and the copy script make
    // about the real package: a future upgrade that renames or restructures
    // the worker fails here, before it ships as a silently blank map.
    const distDir = path.join(process.cwd(), 'node_modules', 'maplibre-gl', 'dist');
    const destDir = path.join(await makeTempDir(), 'out');

    const copied = await copyMapLibreWorkerAssets({
      distDir,
      destDir,
      workerFileName: path.basename(MAP_WORKER_URL),
    });

    expect(copied).toEqual(['maplibre-gl-worker.mjs', 'maplibre-gl-shared.mjs']);
  });
});

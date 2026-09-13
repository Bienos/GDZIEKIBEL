/**
 * Health check: verifies that the configured database is reachable and that the
 * PostGIS extension is available and installed.
 *
 * Usage: pnpm db:check
 *
 * Exits non-zero with a readable message when the requirement is not met. The
 * connection string is never printed: it carries credentials.
 */
import { config as loadEnvFile } from 'dotenv';
import { closePool, getPool } from '../../db/client';
import { readPostgisStatus } from '../../db/postgis';

loadEnvFile({ path: '.env.local', quiet: true });
loadEnvFile({ quiet: true });

async function main(): Promise<void> {
  const pool = getPool();
  const status = await readPostgisStatus(pool);

  if (!status.available) {
    throw new Error(
      'PostGIS is not available on this PostgreSQL server. Install the PostGIS extension ' +
        'package, or select a managed plan that provides it.',
    );
  }

  if (!status.installed) {
    throw new Error(
      `PostGIS is available (server default version ${status.defaultVersion ?? 'unknown'}) but ` +
        'not installed in this database. Run: pnpm db:migrate',
    );
  }

  process.stdout.write(`PostGIS OK — installed version ${status.installedVersion}\n`);
}

main()
  .then(async () => {
    await closePool();
  })
  .catch(async (error: unknown) => {
    process.exitCode = 1;
    process.stderr.write(`PostGIS check failed: ${(error as Error).message}\n`);
    await closePool();
  });

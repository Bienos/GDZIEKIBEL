/**
 * One-time reconciliation for a database whose schema was created out of
 * band (directly, not through `node-pg-migrate`), so its own bookkeeping
 * table (`pgmigrations`) does not yet reflect which migrations' objects
 * already exist. Without this, `pnpm db:migrate` tries to re-run every
 * migration from the start and fails the moment it hits an object that
 * already exists (e.g. `CREATE TYPE access_type` erroring "already
 * exists").
 *
 * For each migration, in chronological order, checks whether its own
 * defining object is really present; if so, and `pgmigrations` does not
 * already record it, inserts a row for it. Stops at the first migration
 * whose object does not exist, since migrations are strictly sequential —
 * nothing after an unapplied migration could genuinely be applied either.
 * Never marks the object `pnpm db:migrate` should actually run for real.
 *
 * Safe to run more than once: an already-reconciled or freshly-migrated
 * database has nothing left to insert, on every check.
 *
 * Usage: pnpm db:reconcile-migration-history
 */
import { config as loadEnvFile } from 'dotenv';
import type { Pool } from 'pg';
import { closePool, getPool } from '../../db/client';

loadEnvFile({ path: '.env.local', quiet: true });
loadEnvFile({ quiet: true });

interface MigrationCheck {
  name: string;
  /** Resolves true only if this migration's own object genuinely exists. */
  exists: (pool: Pool) => Promise<boolean>;
}

async function regclassExists(pool: Pool, qualifiedName: string): Promise<boolean> {
  const result = await pool.query<{ exists: boolean }>(
    'SELECT to_regclass($1) IS NOT NULL AS exists',
    [qualifiedName],
  );
  return result.rows[0]?.exists ?? false;
}

const MIGRATIONS: MigrationCheck[] = [
  {
    name: '1789277236377_enable-postgis',
    exists: async (pool) => {
      const result = await pool.query<{ exists: boolean }>(
        "SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'postgis') AS exists",
      );
      return result.rows[0]?.exists ?? false;
    },
  },
  {
    name: '1789312508934_toilet-schema',
    exists: (pool) => regclassExists(pool, 'public.toilets'),
  },
  {
    name: '1789337554904_add-confidence-access-raw',
    exists: async (pool) => {
      const result = await pool.query<{ exists: boolean }>(
        `SELECT EXISTS (
           SELECT 1 FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = 'toilets' AND column_name = 'access_raw'
         ) AS exists`,
      );
      return result.rows[0]?.exists ?? false;
    },
  },
  {
    name: '1789338426626_add-toilet-reports',
    exists: (pool) => regclassExists(pool, 'public.toilet_reports'),
  },
  {
    name: '1789339405690_add-report-rate-limit',
    exists: (pool) => regclassExists(pool, 'public.report_rate_limit_windows'),
  },
  {
    name: '1789375665896_add-dedup-candidates',
    exists: (pool) => regclassExists(pool, 'public.dedup_candidates'),
  },
  {
    name: '1789377927185_add-analytics-events',
    exists: (pool) => regclassExists(pool, 'public.analytics_events'),
  },
  {
    name: '1789398398680_add-analytics-rate-limit',
    exists: (pool) => regclassExists(pool, 'public.analytics_rate_limit_windows'),
  },
];

async function main(): Promise<void> {
  const pool = getPool();

  await pool.query(
    'CREATE TABLE IF NOT EXISTS pgmigrations (id SERIAL PRIMARY KEY, name varchar(255) NOT NULL, run_on timestamp NOT NULL)',
  );

  const alreadyRecorded = await pool.query<{ name: string }>('SELECT name FROM pgmigrations');
  const recordedNames = new Set(alreadyRecorded.rows.map((row) => row.name));

  for (const migration of MIGRATIONS) {
    if (recordedNames.has(migration.name)) {
      process.stdout.write(`${migration.name}: already recorded, skipped\n`);
      continue;
    }

    const exists = await migration.exists(pool);
    if (!exists) {
      process.stdout.write(
        `${migration.name}: object not found — stopping here, this and later migrations will run for real\n`,
      );
      break;
    }

    await pool.query('INSERT INTO pgmigrations (name, run_on) VALUES ($1, NOW())', [
      migration.name,
    ]);
    process.stdout.write(`${migration.name}: object exists, recorded as already run\n`);
  }
}

main()
  .then(async () => {
    await closePool();
  })
  .catch(async (error: unknown) => {
    process.exitCode = 1;
    process.stderr.write(`Migration history reconciliation failed: ${(error as Error).message}\n`);
    await closePool();
  });

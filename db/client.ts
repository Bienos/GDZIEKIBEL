import { Pool } from 'pg';
import { getServerEnv } from '@/lib/env/server';

/**
 * Shared PostgreSQL connection pool.
 *
 * The pool is created on first use and cached on `globalThis` so that Next.js
 * development hot reloads do not open a new pool on every module evaluation.
 */
const globalForDb = globalThis as typeof globalThis & { __gdziekibelPool?: Pool };

export function getPool(): Pool {
  globalForDb.__gdziekibelPool ??= new Pool({
    connectionString: getServerEnv().DATABASE_URL,
  });
  return globalForDb.__gdziekibelPool;
}

/** Closes the shared pool. Intended for scripts and test teardown. */
export async function closePool(): Promise<void> {
  const pool = globalForDb.__gdziekibelPool;
  if (pool) {
    globalForDb.__gdziekibelPool = undefined;
    await pool.end();
  }
}

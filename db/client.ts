import { Pool } from 'pg';
import { getServerEnv } from '@/lib/env/server';
import { logRuntimeError } from '@/lib/observability/log-runtime-error';

/**
 * Shared PostgreSQL connection pool.
 *
 * The pool is created on first use and cached on `globalThis` so that Next.js
 * development hot reloads do not open a new pool on every module evaluation.
 *
 * `pool.on('error', ...)` (TASK-024, `docs/adr/0019-runtime-error-logging.md`)
 * is required, not incidental: an idle client's connection can fail (the
 * database restarting underneath a live server, for instance) with no
 * request in flight at all, and `node-postgres` documents that an
 * unhandled listener here becomes an uncaught exception — a raw,
 * unstructured dump straight to `stderr`, discovered by this task's own
 * smoke test, which is exactly the invisible-runtime-error problem this
 * task exists to close. Routed through the same `logRuntimeError` every
 * route handler uses, so this failure mode is structured and consistent
 * too.
 */
const globalForDb = globalThis as typeof globalThis & { __gdziekibelPool?: Pool };

/**
 * Exported separately from {@link getPool} so the wiring can be unit
 * tested without a real `DATABASE_URL`, the same reason
 * `lib/env/server.ts` exports `parseServerEnv` apart from `getServerEnv`.
 */
export function attachPoolErrorLogging(pool: Pool): void {
  pool.on('error', (error) => {
    logRuntimeError('db/client.ts:pool', error);
  });
}

export function getPool(): Pool {
  if (!globalForDb.__gdziekibelPool) {
    const pool = new Pool({ connectionString: getServerEnv().DATABASE_URL });
    attachPoolErrorLogging(pool);
    globalForDb.__gdziekibelPool = pool;
  }
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

import type { Pool } from 'pg';

export interface PostgisStatus {
  /** True when the PostGIS extension is installed in the connected database. */
  installed: boolean;
  /** True when the server has the extension available to install. */
  available: boolean;
  /** Installed extension version, or null when it is not installed. */
  installedVersion: string | null;
  /** Version the server would install, or null when the extension is unknown. */
  defaultVersion: string | null;
}

/**
 * Reads the PostGIS state of the connected database.
 *
 * Uses `pg_available_extensions`, which reports both what the server can
 * install and what is currently installed, so a missing extension can be told
 * apart from a server that does not ship PostGIS at all.
 */
export async function readPostgisStatus(pool: Pool): Promise<PostgisStatus> {
  const result = await pool.query<{
    default_version: string | null;
    installed_version: string | null;
  }>(
    `SELECT default_version, installed_version
       FROM pg_available_extensions
      WHERE name = $1`,
    ['postgis'],
  );

  const row = result.rows[0];

  if (!row) {
    return { installed: false, available: false, installedVersion: null, defaultVersion: null };
  }

  return {
    installed: row.installed_version !== null,
    available: true,
    installedVersion: row.installed_version,
    defaultVersion: row.default_version,
  };
}

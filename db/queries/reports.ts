import type { Pool } from 'pg';
import type { IssueType } from '@/lib/reports/types';

/**
 * Thin data access for `toilet_reports` (TASK-020,
 * `docs/adr/0015-toilet-reports.md`) — the same separation
 * `db/queries/nearby.ts` already established between plain queries and the
 * route handler that shapes a response around them.
 */

/** Checked before an insert so an unknown toilet id fails as a clean `404`,
 * not a raw foreign-key violation. */
export async function toiletExists(pool: Pool, toiletId: string): Promise<boolean> {
  const result = await pool.query('SELECT 1 FROM toilets WHERE id = $1', [toiletId]);
  return (result.rowCount ?? 0) > 0;
}

export interface InsertReportParams {
  toiletId: string;
  issueType: IssueType;
  /** `null` means no note was given — never stored as an empty string. */
  note: string | null;
}

/** Inserts one report. Never writes location, an IP, or any device
 * identifier: the report carries only what `InsertReportParams` names. */
export async function insertReport(
  pool: Pool,
  params: InsertReportParams,
): Promise<{ id: string }> {
  const result = await pool.query<{ id: string }>(
    `INSERT INTO toilet_reports (toilet_id, issue_type, note)
     VALUES ($1, $2, $3)
     RETURNING id`,
    [params.toiletId, params.issueType, params.note],
  );
  const row = result.rows[0];
  if (!row) throw new Error('insertReport: INSERT ... RETURNING id returned no row');
  return row;
}

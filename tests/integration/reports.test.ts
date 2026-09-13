import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { closePool, getPool } from '@/db/client';
import { insertReport, toiletExists } from '@/db/queries/reports';

/**
 * Proves the report write path against a real PostGIS database (TASK-020,
 * `docs/adr/0015-toilet-reports.md`): a report against a real toilet is
 * stored with no location, `toiletExists` tells a real toilet apart from
 * an absent one, and a blank note is stored as `null`, never `''`.
 */
const hasDatabaseUrl = Boolean(process.env.DATABASE_URL);

const PREFIX = 'report-test-';

async function insertToilet(name: string): Promise<string> {
  const result = await getPool().query<{ id: string }>(
    `INSERT INTO toilets (name, geom)
     VALUES ($1, ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography)
     RETURNING id`,
    [name, 21.0122, 52.2297],
  );
  const id = result.rows[0]?.id;
  if (!id) throw new Error('fixture insert returned no id');
  return id;
}

describe.skipIf(!hasDatabaseUrl)('toilet reports', () => {
  afterEach(async () => {
    await getPool().query(
      `DELETE FROM toilet_reports WHERE toilet_id IN (
         SELECT id FROM toilets WHERE name LIKE '${PREFIX}%')`,
    );
    await getPool().query(`DELETE FROM toilets WHERE name LIKE '${PREFIX}%'`);
  });

  afterAll(async () => {
    await closePool();
  });

  it('reports a real toilet as existing, and a random id as not', async () => {
    const toiletId = await insertToilet(`${PREFIX}exists`);

    expect(await toiletExists(getPool(), toiletId)).toBe(true);
    expect(await toiletExists(getPool(), randomUUID())).toBe(false);
  });

  it('inserts a report with no location, defaulting to status new', async () => {
    const toiletId = await insertToilet(`${PREFIX}insert`);

    const { id } = await insertReport(getPool(), {
      toiletId,
      issueType: 'wrong_hours',
      note: 'Actually closes at 20:00',
    });

    const row = await getPool().query<{
      toilet_id: string;
      issue_type: string;
      note: string | null;
      status: string;
    }>(`SELECT toilet_id, issue_type, note, status FROM toilet_reports WHERE id = $1`, [id]);

    expect(row.rows[0]).toEqual({
      toilet_id: toiletId,
      issue_type: 'wrong_hours',
      note: 'Actually closes at 20:00',
      status: 'new',
    });
    // ARCHITECTURE.md section 5.3: no precise user location stored with a report.
    expect(row.rows[0]).not.toHaveProperty('lat');
    expect(row.rows[0]).not.toHaveProperty('lng');
  });

  it('stores a null note as null, never an empty string', async () => {
    const toiletId = await insertToilet(`${PREFIX}no-note`);

    const { id } = await insertReport(getPool(), { toiletId, issueType: 'other', note: null });

    const row = await getPool().query<{ note: string | null }>(
      `SELECT note FROM toilet_reports WHERE id = $1`,
      [id],
    );

    expect(row.rows[0]?.note).toBeNull();
  });

  it('rejects an unknown issue_type at the database level, not just in application code', async () => {
    const toiletId = await insertToilet(`${PREFIX}bad-enum`);

    await expect(
      getPool().query(
        `INSERT INTO toilet_reports (toilet_id, issue_type) VALUES ($1, 'smells_bad')`,
        [toiletId],
      ),
    ).rejects.toThrow();
  });
});

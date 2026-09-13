import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ISSUE_TYPES } from '@/lib/reports/types';

/**
 * `ISSUE_TYPES` and the SQL `toilet_report_issue_type` enum must agree
 * member for member and in order (TASK-020). Mirrors
 * `tests/unit/toilets-types.test.ts`'s technique: reads the migration
 * rather than trusting either side.
 */
const migrationsDir = fileURLToPath(new URL('../../db/migrations/', import.meta.url));
const schemaFile = readdirSync(migrationsDir).find((name) =>
  name.endsWith('_add-toilet-reports.sql'),
);
const sql = schemaFile ? readFileSync(`${migrationsDir}${schemaFile}`, 'utf8') : '';

function sqlEnumMembers(typeName: string): string[] | null {
  const match = new RegExp(`CREATE TYPE ${typeName} AS ENUM \\(([^)]*)\\);`, 's').exec(sql);
  if (!match?.[1]) return null;
  return [...match[1].matchAll(/'([^']+)'/g)].map((item) => item[1] ?? '');
}

describe('toilet_report_issue_type and ISSUE_TYPES', () => {
  it('finds the migration', () => {
    expect(schemaFile).toBeDefined();
  });

  it('agree member for member and in order', () => {
    expect(sqlEnumMembers('toilet_report_issue_type')).toEqual([...ISSUE_TYPES]);
  });
});

import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { EVENT_NAMES } from '@/lib/analytics/types';

/**
 * `EVENT_NAMES` and the SQL `analytics_event_name` enum must agree member
 * for member and in order (TASK-023). Mirrors `tests/unit/toilets-types.test.ts`'s
 * technique: reads the migration rather than trusting either side.
 */
const migrationsDir = fileURLToPath(new URL('../../db/migrations/', import.meta.url));
const schemaFile = readdirSync(migrationsDir).find((name) =>
  name.endsWith('_add-analytics-events.sql'),
);
const sql = schemaFile ? readFileSync(`${migrationsDir}${schemaFile}`, 'utf8') : '';

function sqlEnumMembers(typeName: string): string[] | null {
  const match = new RegExp(`CREATE TYPE ${typeName} AS ENUM \\(([^)]*)\\);`, 's').exec(sql);
  if (!match?.[1]) return null;
  return [...match[1].matchAll(/'([^']+)'/g)].map((item) => item[1] ?? '');
}

describe('analytics_event_name and EVENT_NAMES', () => {
  it('finds the migration', () => {
    expect(schemaFile).toBeDefined();
  });

  it('agree member for member and in order', () => {
    expect(sqlEnumMembers('analytics_event_name')).toEqual([...EVENT_NAMES]);
  });
});

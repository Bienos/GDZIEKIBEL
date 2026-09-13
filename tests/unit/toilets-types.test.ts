import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { SQL_ENUM_MIRROR } from '@/lib/toilets/types';

/**
 * The SQL enum types and the TypeScript lists must agree member for member and
 * in order. This reads the migration rather than trusting either side.
 */
const migrationsDir = fileURLToPath(new URL('../../db/migrations/', import.meta.url));
const schemaFile = readdirSync(migrationsDir).find((name) => name.endsWith('_toilet-schema.sql'));
const sql = schemaFile ? readFileSync(`${migrationsDir}${schemaFile}`, 'utf8') : '';

function sqlEnumMembers(typeName: string): string[] | null {
  const match = new RegExp(`CREATE TYPE ${typeName} AS ENUM \\(([^)]*)\\);`).exec(sql);
  if (!match?.[1]) return null;
  return [...match[1].matchAll(/'([^']+)'/g)].map((item) => item[1] ?? '');
}

describe('SQL enum types and TypeScript lists', () => {
  it('finds the schema migration', () => {
    expect(schemaFile).toBeDefined();
  });

  it.each(Object.keys(SQL_ENUM_MIRROR))('agree on %s', (typeName) => {
    const expected = SQL_ENUM_MIRROR[typeName as keyof typeof SQL_ENUM_MIRROR];
    expect(sqlEnumMembers(typeName)).toEqual([...expected]);
  });

  it('gives every inferable attribute an explicit unknown member', () => {
    expect(SQL_ENUM_MIRROR.access_type).toContain('unknown');
    expect(SQL_ENUM_MIRROR.price_state).toContain('unknown');
    expect(SQL_ENUM_MIRROR.feature_state).toContain('unknown');
  });
});

import { describe, expect, it } from 'vitest';
import {
  readCatalogue,
  readDatastore,
  readOverpassCount,
  readTagCoverage,
} from '@/scripts/research/parse';

/**
 * The TASK-002 probe cannot reach its sources from every environment, so the
 * readers are tested against recorded response shapes instead. What matters
 * here is not only that a well-formed payload parses, but that a malformed one
 * yields nothing rather than a plausible-looking value.
 */
describe('readCatalogue', () => {
  const response = JSON.stringify({
    success: true,
    result: {
      count: 1,
      results: [
        {
          id: 'abc-123',
          name: 'toalety-publiczne',
          title: 'Toalety publiczne',
          license_id: 'cc-by',
          license_title: 'Creative Commons Attribution',
          metadata_modified: '2026-08-01T10:00:00.000000',
          resources: [
            { id: 'res-json', format: 'JSON', url: 'https://example.invalid/toilets.json' },
            { format: 'CSV' },
          ],
        },
      ],
    },
  });

  it('reads the licence fields a source decision depends on', () => {
    const [dataset] = readCatalogue('toalety', 'https://example.invalid', response);

    expect(dataset?.id).toBe('abc-123');
    expect(dataset?.licenseId).toBe('cc-by');
    expect(dataset?.licenseTitle).toBe('Creative Commons Attribution');
    expect(dataset?.metadataModified).toBe('2026-08-01T10:00:00.000000');
  });

  it('keeps the resource id so the datastore can be queried for schema', () => {
    const [dataset] = readCatalogue('toalety', 'https://example.invalid', response);

    expect(dataset?.resources[0]?.id).toBe('res-json');
  });

  it('keeps a resource whose id and url are absent rather than dropping the row', () => {
    const [dataset] = readCatalogue('toalety', 'https://example.invalid', response);

    expect(dataset?.resources).toHaveLength(2);
    expect(dataset?.resources[1]).toEqual({ id: null, format: 'CSV', url: null });
  });

  it('reports a missing licence as null instead of guessing one', () => {
    const raw = JSON.stringify({ result: { results: [{ id: 'x' }] } });

    const [dataset] = readCatalogue('toalety', 'https://example.invalid', raw);

    expect(dataset?.licenseId).toBeNull();
    expect(dataset?.licenseTitle).toBeNull();
  });

  it('returns nothing for malformed or unexpected payloads', () => {
    expect(readCatalogue('t', 'h', 'not json')).toEqual([]);
    expect(readCatalogue('t', 'h', '{"result":{}}')).toEqual([]);
    expect(readCatalogue('t', 'h', '{"error":"denied"}')).toEqual([]);
  });
});

describe('readDatastore', () => {
  const response = JSON.stringify({
    success: true,
    result: {
      resource_id: 'res-json',
      fields: [
        { id: '_id', type: 'int' },
        { id: 'nazwa', type: 'text' },
        { id: 'czynne_od' },
        { type: 'text' },
      ],
      records: [{ _id: 1, nazwa: 'Toaleta Metro Centrum', czynne_od: '06:00' }],
      total: 312,
    },
  });

  it('reads the field list, the total and the first record', () => {
    const sample = readDatastore(response);

    expect(sample?.total).toBe(312);
    expect(sample?.fields).toEqual([
      { id: '_id', type: 'int' },
      { id: 'nazwa', type: 'text' },
      { id: 'czynne_od', type: null },
    ]);
    expect(sample?.example).toEqual({ _id: 1, nazwa: 'Toaleta Metro Centrum', czynne_od: '06:00' });
  });

  it('accepts a total given as a digit string but nothing else', () => {
    const asString = JSON.stringify({ result: { fields: [{ id: 'x' }], total: '42' } });
    const asWords = JSON.stringify({ result: { fields: [{ id: 'x' }], total: 'many' } });

    expect(readDatastore(asString)?.total).toBe(42);
    expect(readDatastore(asWords)?.total).toBeNull();
  });

  it('reports a missing total or record as null rather than zero or empty', () => {
    const raw = JSON.stringify({ result: { fields: [{ id: 'x' }], records: [] } });

    const sample = readDatastore(raw);

    expect(sample?.total).toBeNull();
    expect(sample?.example).toBeNull();
  });

  it('returns null when the payload carries no field list', () => {
    expect(readDatastore('not json')).toBeNull();
    expect(readDatastore('{"result":{"records":[]}}')).toBeNull();
    expect(readDatastore('{"success":false,"error":{"message":"Not found"}}')).toBeNull();
  });
});

describe('readOverpassCount', () => {
  it('reads the total from an out count response', () => {
    const raw = JSON.stringify({
      elements: [{ type: 'count', id: 0, tags: { total: '421', nodes: '400' } }],
    });

    expect(readOverpassCount(raw)).toBe('421');
  });

  it('returns null when the response carries no count', () => {
    expect(readOverpassCount('{"elements":[]}')).toBeNull();
    expect(readOverpassCount('{"elements":[{"type":"node"}]}')).toBeNull();
    expect(readOverpassCount('<html>rate limited</html>')).toBeNull();
  });
});

describe('readTagCoverage', () => {
  const raw = JSON.stringify({
    elements: [
      { type: 'node', tags: { amenity: 'toilets', opening_hours: '06:00-22:00', fee: 'no' } },
      { type: 'node', tags: { amenity: 'toilets', fee: 'yes', wheelchair: 'yes' } },
      { type: 'node', tags: { amenity: 'toilets' } },
      { type: 'node' },
    ],
  });

  it('counts only elements that actually carry the tag', () => {
    const coverage = readTagCoverage(raw);

    expect(coverage?.total).toBe(4);
    expect(coverage?.counts.opening_hours).toBe(1);
    expect(coverage?.counts.fee).toBe(2);
    expect(coverage?.counts.wheelchair).toBe(1);
  });

  it('counts an absent tag as zero, which means unknown and never no', () => {
    const coverage = readTagCoverage(raw);

    expect(coverage?.counts.changing_table).toBe(0);
  });

  it('returns null when the payload is not an element list', () => {
    expect(readTagCoverage('not json')).toBeNull();
    expect(readTagCoverage('{"remark":"timed out"}')).toBeNull();
  });
});

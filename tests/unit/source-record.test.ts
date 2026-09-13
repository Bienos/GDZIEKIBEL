import { describe, expect, it } from 'vitest';
import {
  parseSourceToiletRecord,
  sourceToiletRecordSchema,
  type SourceToiletRecordInput,
} from '@/lib/toilets/source-record';

/** The smallest record the contract accepts: identity, position, provenance. */
const minimal: SourceToiletRecordInput = {
  source_name: 'osm',
  source_record_id: 'node/123',
  source_url: 'https://www.openstreetmap.org/node/123',
  fetched_at: '2026-09-13T12:12:40Z',
  position: { lat: 52.2192425, lon: 21.0266934 },
  position_kind: 'point',
  raw_payload: { type: 'node', id: 123, tags: { amenity: 'toilets' } },
  licence: 'ODbL-1.0',
};

describe('sourceToiletRecordSchema', () => {
  it('accepts a full OSM-derived record', () => {
    const record = parseSourceToiletRecord({
      ...minimal,
      source_updated_at: '2026-09-09T00:00:00+02:00',
      name: 'Automatyczna toaleta miejska',
      operator: 'Zarząd Zieleni m.st. Warszawy',
      address: { street: 'Agrykola', housenumber: null, city: 'Warszawa', postcode: null },
      access: 'customers',
      fee: 'paid',
      price: { amount_minor: 100, currency: 'PLN' },
      payment: { cash: null, cards: null, coins: true, contactless: true },
      opening_hours_raw: '24/7',
      opening_hours_format: 'osm',
      wheelchair: 'yes',
      changing_table: 'yes',
      unisex: 'yes',
      level: '0',
      indoor: false,
      portable: false,
      description: null,
      attribution: 'OpenStreetMap',
    });

    expect(record.fee).toBe('paid');
    expect(record.price).toEqual({ amount_minor: 100, currency: 'PLN' });
    expect(record.address?.housenumber).toBeNull();
  });

  it('parses omitted unknowns to null and never to false', () => {
    const record = parseSourceToiletRecord(minimal);

    const nullableKeys = [
      'source_updated_at',
      'name',
      'operator',
      'address',
      'access',
      'fee',
      'price',
      'payment',
      'opening_hours_raw',
      'opening_hours_format',
      'wheelchair',
      'changing_table',
      'unisex',
      'level',
      'indoor',
      'portable',
      'description',
      'attribution',
    ] as const;

    for (const key of nullableKeys) {
      expect(record[key], key).toBeNull();
    }

    // Nothing in the parsed record is a boolean false or a stand-in for unknown.
    for (const [key, value] of Object.entries(record)) {
      expect(value, key).not.toBe(false);
      expect(value, key).not.toBe('unknown');
      expect(value, key).not.toBe('');
    }
  });

  it('rejects a record without a source_url', () => {
    const { source_url: _omitted, ...withoutUrl } = minimal;
    void _omitted;

    expect(() => parseSourceToiletRecord(withoutUrl)).toThrowError(/source_url/);
  });

  it('rejects a position outside WGS84 bounds', () => {
    expect(() =>
      parseSourceToiletRecord({ ...minimal, position: { lat: 95, lon: 21 } }),
    ).toThrowError(/position\.lat/);
    expect(() =>
      parseSourceToiletRecord({ ...minimal, position: { lat: 52, lon: 181 } }),
    ).toThrowError(/position\.lon/);
  });

  it('rejects a fee value outside the contract set', () => {
    expect(() => parseSourceToiletRecord({ ...minimal, fee: 'gratis' })).toThrowError(/fee/);
  });

  it('rejects boolean-like fields supplied as strings', () => {
    expect(() => parseSourceToiletRecord({ ...minimal, indoor: 'yes' })).toThrowError(/indoor/);
    expect(() => parseSourceToiletRecord({ ...minimal, payment: { cards: 'true' } })).toThrowError(
      /payment\.cards/,
    );
  });

  it('rejects an unknown source name and an unknown key', () => {
    expect(() => parseSourceToiletRecord({ ...minimal, source_name: 'google' })).toThrowError(
      /source_name/,
    );
    expect(() => parseSourceToiletRecord({ ...minimal, wheelchair_ok: true })).toThrowError(
      /wheelchair_ok/,
    );
  });

  it('rejects a non-integer or negative price and a lowercase currency', () => {
    expect(() =>
      parseSourceToiletRecord({ ...minimal, price: { amount_minor: 4.5, currency: 'PLN' } }),
    ).toThrowError(/price\.amount_minor/);
    expect(() =>
      parseSourceToiletRecord({ ...minimal, price: { amount_minor: 450, currency: 'pln' } }),
    ).toThrowError(/price\.currency/);
  });

  it('does not echo supplied values in the error message', () => {
    const secretLooking = 'ftp://do-not-log-this';

    expect(() => parseSourceToiletRecord({ ...minimal, source_url: secretLooking })).toThrowError(
      expect.objectContaining({ message: expect.not.stringContaining(secretLooking) }),
    );
  });

  it('exposes the schema for adapters that want safeParse', () => {
    expect(sourceToiletRecordSchema.safeParse(minimal).success).toBe(true);
    expect(sourceToiletRecordSchema.safeParse({}).success).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import {
  normalizedSourceRecordSchema,
  parseNormalizedSourceRecord,
  type NormalizedSourceRecord,
} from '@/lib/toilets/normalized-source-record';

/**
 * A record an adapter would emit for an OSM node that carries only
 * amenity=toilets and a position. Everything it does not know is unknown or
 * null, written out in full, which is what the schema demands.
 */
const bare: NormalizedSourceRecord = {
  sourceName: 'osm',
  sourceRecordId: 'node/123456',
  sourceVersion: '3',
  sourceUrl: 'https://www.openstreetmap.org/node/123456',
  sourceUpdatedAt: '2026-08-01T10:00:00Z',
  position: { lat: 52.2297, lon: 21.0122 },
  name: null,
  operatorName: null,
  openingHoursRaw: null,
  open24h: null,
  openingHoursNormalized: null,
  priceState: 'unknown',
  chargeRaw: null,
  paymentMethodsRaw: null,
  accessType: 'unknown',
  accessRaw: null,
  wheelchair: 'unknown',
  changingTable: 'unknown',
  male: 'unknown',
  female: 'unknown',
  unisex: 'unknown',
  level: null,
  indoor: null,
  sourceVerifiedAt: null,
  notesRaw: null,
};

describe('normalizedSourceRecordSchema', () => {
  it('accepts a record that states every unknown explicitly', () => {
    expect(parseNormalizedSourceRecord(bare)).toEqual(bare);
  });

  it('accepts a fully described record', () => {
    const full: NormalizedSourceRecord = {
      ...bare,
      name: 'Toaleta miejska',
      operatorName: 'ZOM',
      openingHoursRaw: 'Mo-Su 06:00-22:00',
      openingHoursNormalized: {
        rules: [
          { days: [0, 1, 2, 3, 4, 5, 6], closed: false, ranges: [{ start: 360, end: 1320 }] },
        ],
      },
      priceState: 'free',
      accessType: 'public_unconditional',
      accessRaw: 'yes',
      wheelchair: 'yes',
      changingTable: 'limited',
      unisex: 'yes',
      level: '-1',
      indoor: true,
      sourceVerifiedAt: '2026-07-15',
      paymentMethodsRaw: { 'payment:cards': 'yes' },
    };

    expect(parseNormalizedSourceRecord(full)).toEqual(full);
  });

  it('refuses to default a missing feature to anything', () => {
    // If wheelchair could be omitted, an adapter that forgot it would ship
    // whatever the default was. There is no default; the field is required.
    const withoutWheelchair: Record<string, unknown> = { ...bare };
    delete withoutWheelchair.wheelchair;

    expect(normalizedSourceRecordSchema.safeParse(withoutWheelchair).success).toBe(false);
  });

  it('keeps unknown and no as different values', () => {
    const unknown = parseNormalizedSourceRecord({ ...bare, wheelchair: 'unknown' });
    const no = parseNormalizedSourceRecord({ ...bare, wheelchair: 'no' });

    expect(unknown.wheelchair).not.toBe(no.wheelchair);
  });

  it('rejects an access type outside the enumerated list', () => {
    expect(normalizedSourceRecordSchema.safeParse({ ...bare, accessType: 'public' }).success).toBe(
      false,
    );
  });

  it('rejects unknown keys so a typo cannot drop a value silently', () => {
    expect(normalizedSourceRecordSchema.safeParse({ ...bare, wheelChair: 'yes' }).success).toBe(
      false,
    );
  });

  it('rejects coordinates outside the valid range', () => {
    expect(
      normalizedSourceRecordSchema.safeParse({ ...bare, position: { lat: 91, lon: 21 } }).success,
    ).toBe(false);
    expect(
      normalizedSourceRecordSchema.safeParse({ ...bare, position: { lat: 52, lon: 181 } }).success,
    ).toBe(false);
  });

  it('rejects an empty source name or record id', () => {
    expect(normalizedSourceRecordSchema.safeParse({ ...bare, sourceName: '' }).success).toBe(false);
    expect(normalizedSourceRecordSchema.safeParse({ ...bare, sourceRecordId: '' }).success).toBe(
      false,
    );
  });

  it('accepts a boolean-with-unknown indoor value and nothing looser', () => {
    expect(parseNormalizedSourceRecord({ ...bare, indoor: false }).indoor).toBe(false);
    expect(normalizedSourceRecordSchema.safeParse({ ...bare, indoor: 'no' }).success).toBe(false);
  });
});

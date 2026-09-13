import { describe, expect, it } from 'vitest';
import { toNearbyResult, type NearbyToiletRow } from '@/lib/toilets/nearby-response';

const NOW = new Date('2026-09-14T10:00:00Z'); // an arbitrary, fixed instant

const baseRow: NearbyToiletRow = {
  id: 'a1b2c3d4-0000-0000-0000-000000000000',
  name: 'Toaleta',
  lat: 52.2297,
  lng: 21.0122,
  distanceMeters: 240,
  priceState: 'unknown',
  confidenceLevel: 'low',
  accessType: 'unknown',
  wheelchair: 'unknown',
  changingTable: 'unknown',
  unisex: 'unknown',
  open24h: null,
  openingHoursNormalized: null,
};

describe('toNearbyResult', () => {
  it('carries every schema value through unchanged', () => {
    const result = toNearbyResult(
      {
        ...baseRow,
        priceState: 'free',
        confidenceLevel: 'high',
        accessType: 'public_unconditional',
      },
      NOW,
    );

    expect(result.priceState).toBe('free');
    expect(result.confidenceLevel).toBe('high');
    expect(result.accessType).toBe('public_unconditional');
  });

  it('reports UNKNOWN when the row has no stored hours data, never inferring one', () => {
    expect(toNearbyResult(baseRow, NOW).openingStatus).toBe('UNKNOWN');
  });

  it('computes a real status from the row, wiring open24h and confidenceLevel through', () => {
    // Real computation (LIKELY_OPEN, not OPEN, since confidence is 'low')
    // is computeOpeningStatus's own job to prove exhaustively; this only
    // proves toNearbyResult actually passes the row's fields to it.
    const result = toNearbyResult({ ...baseRow, open24h: true, confidenceLevel: 'low' }, NOW);

    expect(result.openingStatus).toBe('LIKELY_OPEN');
  });

  it('keeps limited distinct from yes and from unknown, never collapsing it to a boolean', () => {
    const result = toNearbyResult({ ...baseRow, wheelchair: 'limited' }, NOW);

    expect(result.features.wheelchair).toBe('limited');
    expect(result.features.wheelchair).not.toBe('yes');
    expect(result.features.wheelchair).not.toBe('unknown');
  });

  it('derives approxWalkingMinutes from the row distance', () => {
    expect(toNearbyResult({ ...baseRow, distanceMeters: 750 }, NOW).approxWalkingMinutes).toBe(10);
  });

  it('exposes no source-record or raw-payload fields', () => {
    const result = toNearbyResult(baseRow, NOW);

    expect(result).not.toHaveProperty('rawPayload');
    expect(result).not.toHaveProperty('sourceName');
    expect(result).not.toHaveProperty('sourceRecordId');
  });
});

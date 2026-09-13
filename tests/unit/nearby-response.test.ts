import { describe, expect, it } from 'vitest';
import { toNearbyResult, type NearbyToiletRow } from '@/lib/toilets/nearby-response';

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
};

describe('toNearbyResult', () => {
  it('carries every schema value through unchanged', () => {
    const result = toNearbyResult({
      ...baseRow,
      priceState: 'free',
      confidenceLevel: 'high',
      accessType: 'public_unconditional',
    });

    expect(result.priceState).toBe('free');
    expect(result.confidenceLevel).toBe('high');
    expect(result.accessType).toBe('public_unconditional');
  });

  it('always reports UNKNOWN opening status, never inferring one', () => {
    expect(toNearbyResult(baseRow).openingStatus).toBe('UNKNOWN');
  });

  it('keeps limited distinct from yes and from unknown, never collapsing it to a boolean', () => {
    const result = toNearbyResult({ ...baseRow, wheelchair: 'limited' });

    expect(result.features.wheelchair).toBe('limited');
    expect(result.features.wheelchair).not.toBe('yes');
    expect(result.features.wheelchair).not.toBe('unknown');
  });

  it('derives approxWalkingMinutes from the row distance', () => {
    expect(toNearbyResult({ ...baseRow, distanceMeters: 750 }).approxWalkingMinutes).toBe(10);
  });

  it('exposes no source-record or raw-payload fields', () => {
    const result = toNearbyResult(baseRow);

    expect(result).not.toHaveProperty('rawPayload');
    expect(result).not.toHaveProperty('sourceName');
    expect(result).not.toHaveProperty('sourceRecordId');
  });
});

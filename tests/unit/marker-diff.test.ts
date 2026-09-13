import { describe, expect, it } from 'vitest';
import { diffMarkers } from '@/lib/toilets/marker-diff';
import type { NearbyToiletResult } from '@/lib/toilets/nearby-response';

function toilet(id: string): NearbyToiletResult {
  return {
    id,
    name: `Toilet ${id}`,
    lat: 52.2297,
    lng: 21.0122,
    distanceMeters: 100,
    approxWalkingMinutes: 2,
    openingStatus: 'UNKNOWN',
    priceState: 'unknown',
    priceAmountMinor: null,
    currency: null,
    confidenceLevel: 'low',
    accessType: 'unknown',
    features: { wheelchair: 'unknown', changingTable: 'unknown', unisex: 'unknown' },
    paymentMethods: { cash: 'unknown', cards: 'unknown', coins: 'unknown' },
  };
}

describe('diffMarkers', () => {
  it('adds everything when there was nothing before', () => {
    const diff = diffMarkers(new Set(), [toilet('a'), toilet('b')]);

    expect(diff.toAdd.map((t) => t.id)).toEqual(['a', 'b']);
    expect(diff.toRemove).toEqual([]);
  });

  it('removes everything when the new list is empty', () => {
    const diff = diffMarkers(new Set(['a', 'b']), []);

    expect(diff.toAdd).toEqual([]);
    expect(diff.toRemove.sort()).toEqual(['a', 'b']);
  });

  it('leaves an id present in both alone', () => {
    const diff = diffMarkers(new Set(['a']), [toilet('a')]);

    expect(diff.toAdd).toEqual([]);
    expect(diff.toRemove).toEqual([]);
  });

  it('adds a new id and removes a dropped one in the same pass', () => {
    const diff = diffMarkers(new Set(['a', 'b']), [toilet('b'), toilet('c')]);

    expect(diff.toAdd.map((t) => t.id)).toEqual(['c']);
    expect(diff.toRemove).toEqual(['a']);
  });
});

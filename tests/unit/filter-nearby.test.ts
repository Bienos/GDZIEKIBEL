import { describe, expect, it } from 'vitest';
import { filterNearbyToilets, matchesFilters } from '@/lib/toilets/filter-nearby';
import type { NearbyToiletRow } from '@/lib/toilets/nearby-response';

const BASE_TOILET = {
  priceState: 'unknown' as const,
  wheelchair: 'unknown' as const,
  changingTable: 'unknown' as const,
  open24h: null,
  openNow: false,
};

describe('matchesFilters', () => {
  it('passes everything when no filter is active', () => {
    expect(matchesFilters(BASE_TOILET, {})).toBe(true);
  });

  it('excludes an unknown price when free is required', () => {
    expect(matchesFilters(BASE_TOILET, { free: true })).toBe(false);
    expect(matchesFilters({ ...BASE_TOILET, priceState: 'paid' }, { free: true })).toBe(false);
    expect(matchesFilters({ ...BASE_TOILET, priceState: 'free' }, { free: true })).toBe(true);
  });

  it('excludes unknown and limited wheelchair access when the filter is active', () => {
    expect(matchesFilters(BASE_TOILET, { wheelchairAccessible: true })).toBe(false);
    expect(
      matchesFilters({ ...BASE_TOILET, wheelchair: 'limited' }, { wheelchairAccessible: true }),
    ).toBe(false);
    expect(
      matchesFilters({ ...BASE_TOILET, wheelchair: 'no' }, { wheelchairAccessible: true }),
    ).toBe(false);
    expect(
      matchesFilters({ ...BASE_TOILET, wheelchair: 'yes' }, { wheelchairAccessible: true }),
    ).toBe(true);
  });

  it('excludes unknown and limited changing-table access when the filter is active', () => {
    expect(matchesFilters(BASE_TOILET, { babyChanging: true })).toBe(false);
    expect(
      matchesFilters({ ...BASE_TOILET, changingTable: 'limited' }, { babyChanging: true }),
    ).toBe(false);
    expect(matchesFilters({ ...BASE_TOILET, changingTable: 'yes' }, { babyChanging: true })).toBe(
      true,
    );
  });

  it('requires open24h to be exactly true, never null standing in for false', () => {
    expect(matchesFilters(BASE_TOILET, { open24h: true })).toBe(false);
    expect(matchesFilters({ ...BASE_TOILET, open24h: false }, { open24h: true })).toBe(false);
    expect(matchesFilters({ ...BASE_TOILET, open24h: true }, { open24h: true })).toBe(true);
  });

  it('requires a confirmed open-now signal, not merely the absence of closed', () => {
    expect(matchesFilters(BASE_TOILET, { openNow: true })).toBe(false);
    expect(matchesFilters({ ...BASE_TOILET, openNow: true }, { openNow: true })).toBe(true);
  });

  it('combines every active filter with AND, not OR', () => {
    const toilet = { ...BASE_TOILET, priceState: 'free' as const, wheelchair: 'yes' as const };

    expect(matchesFilters(toilet, { free: true, wheelchairAccessible: true })).toBe(true);
    expect(matchesFilters(toilet, { free: true, babyChanging: true })).toBe(false);
  });
});

function row(overrides: Partial<NearbyToiletRow> = {}): NearbyToiletRow {
  return {
    id: 'a1b2c3d4-0000-0000-0000-000000000000',
    name: 'Toaleta',
    lat: 52.2297,
    lng: 21.0122,
    distanceMeters: 100,
    priceState: 'unknown',
    priceAmountMinor: null,
    currency: null,
    confidenceLevel: 'low',
    accessType: 'unknown',
    wheelchair: 'unknown',
    changingTable: 'unknown',
    unisex: 'unknown',
    open24h: null,
    openingHoursNormalized: null,
    paymentMethods: null,
    ...overrides,
  };
}

describe('filterNearbyToilets', () => {
  const NOW = new Date('2026-09-14T10:00:00Z');

  it('keeps every row when no filter is active', () => {
    const rows = [row({ id: 'a' }), row({ id: 'b' })];

    expect(filterNearbyToilets(rows, {}, NOW)).toHaveLength(2);
  });

  it('drops a row failing an active filter, keeps one satisfying it', () => {
    const rows = [row({ id: 'a', priceState: 'free' }), row({ id: 'b', priceState: 'unknown' })];

    const filtered = filterNearbyToilets(rows, { free: true }, NOW);

    expect(filtered.map((r) => r.id)).toEqual(['a']);
  });

  it('evaluates openNow against the real computed status, not a stored column', () => {
    const rows = [row({ id: 'always-open', open24h: true, confidenceLevel: 'high' })];

    expect(filterNearbyToilets(rows, { openNow: true }, NOW)).toHaveLength(1);
    expect(filterNearbyToilets([row({ id: 'unknown-hours' })], { openNow: true }, NOW)).toEqual([]);
  });
});

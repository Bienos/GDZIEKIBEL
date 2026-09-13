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
  priceAmountMinor: null,
  currency: null,
  verifiedAt: null,
  accessType: 'unknown',
  accessRaw: null,
  wheelchair: 'unknown',
  changingTable: 'unknown',
  unisex: 'unknown',
  open24h: null,
  openingHoursNormalized: null,
  paymentMethods: null,
};

describe('toNearbyResult', () => {
  it('carries every schema value through unchanged', () => {
    const result = toNearbyResult(
      {
        ...baseRow,
        priceState: 'free',
        accessType: 'public_unconditional',
      },
      NOW,
    );

    expect(result.priceState).toBe('free');
    expect(result.accessType).toBe('public_unconditional');
  });

  it('reports UNKNOWN when the row has no stored hours data, never inferring one', () => {
    expect(toNearbyResult(baseRow, NOW).openingStatus).toBe('UNKNOWN');
  });

  it('computes a real status from the row, wiring open24h and the computed confidence through', () => {
    // Real computation (LIKELY_OPEN, not OPEN, since nothing here reaches
    // 'high' confidence) is computeOpeningStatus's own job to prove
    // exhaustively; this only proves toNearbyResult actually passes the
    // computed confidence to it.
    const result = toNearbyResult({ ...baseRow, open24h: true }, NOW);

    expect(result.openingStatus).toBe('LIKELY_OPEN');
  });

  it('computes MEDIUM confidence from a recent verification with a non-uncertain access basis (TASK-019)', () => {
    const result = toNearbyResult(
      { ...baseRow, verifiedAt: new Date('2026-06-01'), accessRaw: 'yes' },
      NOW,
    );

    expect(result.confidenceLevel).toBe('medium');
  });

  it('keeps LOW confidence for an uncertain access basis, even with a recent verification', () => {
    const result = toNearbyResult(
      { ...baseRow, verifiedAt: new Date('2026-06-01'), accessRaw: 'permissive' },
      NOW,
    );

    expect(result.confidenceLevel).toBe('low');
  });

  it('keeps LOW confidence for a stale verification', () => {
    const result = toNearbyResult(
      { ...baseRow, verifiedAt: new Date('2020-01-01'), accessRaw: 'yes' },
      NOW,
    );

    expect(result.confidenceLevel).toBe('low');
  });

  it('never reaches HIGH confidence: a single source is never enough (docs/adr/0014)', () => {
    const result = toNearbyResult(
      { ...baseRow, verifiedAt: new Date('2026-09-14'), accessRaw: 'yes' },
      NOW,
    );

    expect(result.confidenceLevel).not.toBe('high');
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

  it('carries the parsed charge amount and currency through unchanged', () => {
    const result = toNearbyResult({ ...baseRow, priceAmountMinor: 200, currency: 'PLN' }, NOW);

    expect(result.priceAmountMinor).toBe(200);
    expect(result.currency).toBe('PLN');
  });

  it('reports paymentMethods as all-unknown, never null, for a row with none recorded', () => {
    const result = toNearbyResult(baseRow, NOW);

    expect(result.paymentMethods).toEqual({ cash: 'unknown', cards: 'unknown', coins: 'unknown' });
  });

  it('carries a row with recorded payment methods through unchanged', () => {
    const result = toNearbyResult(
      { ...baseRow, paymentMethods: { cash: 'yes', cards: 'no', coins: 'unknown' } },
      NOW,
    );

    expect(result.paymentMethods).toEqual({ cash: 'yes', cards: 'no', coins: 'unknown' });
  });
});

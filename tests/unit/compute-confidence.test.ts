import { describe, expect, it } from 'vitest';
import {
  computeConfidenceLevel,
  VERIFICATION_FRESHNESS_DAYS,
} from '@/lib/toilets/compute-confidence';

const NOW = new Date('2026-09-14T10:00:00Z');

function daysBefore(days: number): Date {
  return new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000);
}

describe('computeConfidenceLevel', () => {
  it('is LOW when nothing has ever verified the toilet', () => {
    expect(computeConfidenceLevel({ verifiedAt: null, accessRaw: 'yes' }, NOW)).toBe('low');
  });

  it('is MEDIUM for a recent verification with a non-uncertain access basis', () => {
    expect(computeConfidenceLevel({ verifiedAt: daysBefore(10), accessRaw: 'yes' }, NOW)).toBe(
      'medium',
    );
  });

  it('is MEDIUM when access was never tagged at all, not just when it says "yes"', () => {
    expect(computeConfidenceLevel({ verifiedAt: daysBefore(10), accessRaw: null }, NOW)).toBe(
      'medium',
    );
  });

  it('stays MEDIUM exactly at the freshness boundary, LOW one day past it', () => {
    expect(
      computeConfidenceLevel(
        { verifiedAt: daysBefore(VERIFICATION_FRESHNESS_DAYS), accessRaw: 'yes' },
        NOW,
      ),
    ).toBe('medium');
    expect(
      computeConfidenceLevel(
        { verifiedAt: daysBefore(VERIFICATION_FRESHNESS_DAYS + 1), accessRaw: 'yes' },
        NOW,
      ),
    ).toBe('low');
  });

  it('is LOW for a stale verification', () => {
    expect(computeConfidenceLevel({ verifiedAt: daysBefore(1000), accessRaw: 'yes' }, NOW)).toBe(
      'low',
    );
  });

  it('is LOW for a merely-tolerated ("permissive") access basis, even when recently verified', () => {
    expect(
      computeConfidenceLevel({ verifiedAt: daysBefore(1), accessRaw: 'permissive' }, NOW),
    ).toBe('low');
  });

  it('is LOW for a future verification date, not "extra fresh"', () => {
    const oneDayInFuture = new Date(NOW.getTime() + 24 * 60 * 60 * 1000);
    expect(computeConfidenceLevel({ verifiedAt: oneDayInFuture, accessRaw: 'yes' }, NOW)).toBe(
      'low',
    );
  });

  it('never returns HIGH: a single source is never enough (docs/adr/0014)', () => {
    const result = computeConfidenceLevel({ verifiedAt: daysBefore(0), accessRaw: 'yes' }, NOW);
    expect(result).not.toBe('high');
  });
});

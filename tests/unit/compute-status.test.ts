import { describe, expect, it } from 'vitest';
import { computeOpeningStatus } from '@/lib/opening-hours/compute-status';
import { parseOpeningHours } from '@/lib/opening-hours/parse-opening-hours';

const MONDAY_NOON = new Date('2026-01-05T11:00:00Z'); // Mon 12:00 CET
const MONDAY_EARLY_MORNING = new Date('2026-01-05T00:30:00Z'); // Mon 01:30 CET

describe('computeOpeningStatus', () => {
  it('reports UNKNOWN when there is no stored hours data at all', () => {
    const status = computeOpeningStatus(
      { open24h: null, openingHoursNormalized: null },
      'high',
      MONDAY_NOON,
    );

    expect(status).toBe('UNKNOWN');
  });

  it('reports OPEN for open24h with high confidence', () => {
    const status = computeOpeningStatus(
      { open24h: true, openingHoursNormalized: null },
      'high',
      MONDAY_NOON,
    );

    expect(status).toBe('OPEN');
  });

  it('qualifies open24h into LIKELY_OPEN when confidence is not high', () => {
    expect(
      computeOpeningStatus({ open24h: true, openingHoursNormalized: null }, 'low', MONDAY_NOON),
    ).toBe('LIKELY_OPEN');
    expect(
      computeOpeningStatus({ open24h: true, openingHoursNormalized: null }, 'medium', MONDAY_NOON),
    ).toBe('LIKELY_OPEN');
  });

  it('reports OPEN when the current Warsaw moment falls inside a rule range, high confidence', () => {
    const normalized = parseOpeningHours('Mo-Fr 08:00-16:00'); // Monday noon is inside
    const status = computeOpeningStatus(
      { open24h: null, openingHoursNormalized: normalized },
      'high',
      MONDAY_NOON,
    );

    expect(status).toBe('OPEN');
  });

  it('reports CLOSED when the current moment falls outside every range, high confidence', () => {
    const normalized = parseOpeningHours('Mo-Fr 08:00-16:00'); // 01:30 is outside
    const status = computeOpeningStatus(
      { open24h: null, openingHoursNormalized: normalized },
      'high',
      MONDAY_EARLY_MORNING,
    );

    expect(status).toBe('CLOSED');
  });

  it('reports CLOSED for a day with an explicit off rule', () => {
    const normalized = parseOpeningHours('Mo-Sa 08:00-16:00; Su off');
    // Use a Sunday moment: 2026-01-04 is the Sunday before our Monday fixture.
    const sunday = new Date('2026-01-04T11:00:00Z');

    expect(
      computeOpeningStatus({ open24h: null, openingHoursNormalized: normalized }, 'high', sunday),
    ).toBe('CLOSED');
  });

  it('reports OPEN in the early morning via an overnight range from the previous day', () => {
    const normalized = parseOpeningHours('Su 22:00-02:00'); // Sunday night into Monday
    const status = computeOpeningStatus(
      { open24h: null, openingHoursNormalized: normalized },
      'high',
      MONDAY_EARLY_MORNING, // Monday 01:30 — still within Sunday's overnight range
    );

    expect(status).toBe('OPEN');
  });

  it('qualifies a real day/time match into LIKELY_OPEN/LIKELY_CLOSED when confidence is not high', () => {
    const normalized = parseOpeningHours('Mo-Fr 08:00-16:00');

    expect(
      computeOpeningStatus(
        { open24h: null, openingHoursNormalized: normalized },
        'low',
        MONDAY_NOON,
      ),
    ).toBe('LIKELY_OPEN');
    expect(
      computeOpeningStatus(
        { open24h: null, openingHoursNormalized: normalized },
        'medium',
        MONDAY_EARLY_MORNING,
      ),
    ).toBe('LIKELY_CLOSED');
  });
});

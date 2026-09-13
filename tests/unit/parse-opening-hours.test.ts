import { describe, expect, it } from 'vitest';
import { deriveOpeningHours, parseOpeningHours } from '@/lib/opening-hours/parse-opening-hours';

describe('parseOpeningHours', () => {
  it('parses a single weekday-range rule', () => {
    expect(parseOpeningHours('Mo-Fr 08:00-16:00')).toEqual({
      rules: [{ days: [0, 1, 2, 3, 4], closed: false, ranges: [{ start: 480, end: 960 }] }],
    });
  });

  it('parses multiple semicolon-separated rules', () => {
    expect(parseOpeningHours('Mo-Fr 08:00-16:00; Sa 08:00-14:00')).toEqual({
      rules: [
        { days: [0, 1, 2, 3, 4], closed: false, ranges: [{ start: 480, end: 960 }] },
        { days: [5], closed: false, ranges: [{ start: 480, end: 840 }] },
      ],
    });
  });

  it('parses a comma-separated day list', () => {
    expect(parseOpeningHours('Mo,We,Fr 09:00-17:00')).toEqual({
      rules: [{ days: [0, 2, 4], closed: false, ranges: [{ start: 540, end: 1020 }] }],
    });
  });

  it('parses multiple time ranges in one day (a lunch break)', () => {
    expect(parseOpeningHours('Mo-Fr 08:00-12:00,13:00-16:00')).toEqual({
      rules: [
        {
          days: [0, 1, 2, 3, 4],
          closed: false,
          ranges: [
            { start: 480, end: 720 },
            { start: 780, end: 960 },
          ],
        },
      ],
    });
  });

  it('parses an explicit off/closed day', () => {
    expect(parseOpeningHours('Su off')).toEqual({
      rules: [{ days: [6], closed: true, ranges: [] }],
    });
    expect(parseOpeningHours('Su closed')).toEqual({
      rules: [{ days: [6], closed: true, ranges: [] }],
    });
  });

  it('parses a time range crossing midnight, both notations', () => {
    expect(parseOpeningHours('Fr-Sa 22:00-02:00')).toEqual({
      rules: [{ days: [4, 5], closed: false, ranges: [{ start: 1320, end: 1560 }] }],
    });
    expect(parseOpeningHours('Fr-Sa 22:00-26:00')).toEqual({
      rules: [{ days: [4, 5], closed: false, ranges: [{ start: 1320, end: 1560 }] }],
    });
  });

  it('parses a day range that wraps the week (Fr-Mo), sorted ascending', () => {
    expect(parseOpeningHours('Fr-Mo 10:00-12:00')).toEqual({
      rules: [{ days: [0, 4, 5, 6], closed: false, ranges: [{ start: 600, end: 720 }] }],
    });
  });

  it('fails the whole string on a public-holiday rule', () => {
    expect(parseOpeningHours('Mo-Fr 08:00-16:00; PH off')).toBeNull();
  });

  it('fails the whole string on a rule with no recognisable day part', () => {
    expect(parseOpeningHours('08:00-16:00')).toBeNull();
  });

  it('fails on an unrecognised time format', () => {
    expect(parseOpeningHours('Mo-Fr 8am-4pm')).toBeNull();
  });

  it('fails on empty input', () => {
    expect(parseOpeningHours('')).toBeNull();
    expect(parseOpeningHours('   ')).toBeNull();
  });
});

describe('deriveOpeningHours', () => {
  it('recognises 24/7 as open24h, with no normalized schedule', () => {
    expect(deriveOpeningHours('24/7')).toEqual({ open24h: true, openingHoursNormalized: null });
  });

  it('reports both fields null for no raw data at all', () => {
    expect(deriveOpeningHours(null)).toEqual({ open24h: null, openingHoursNormalized: null });
  });

  it('delegates anything else to parseOpeningHours', () => {
    const result = deriveOpeningHours('Mo-Fr 08:00-16:00');

    expect(result.open24h).toBeNull();
    expect(result.openingHoursNormalized).toEqual({
      rules: [{ days: [0, 1, 2, 3, 4], closed: false, ranges: [{ start: 480, end: 960 }] }],
    });
  });
});

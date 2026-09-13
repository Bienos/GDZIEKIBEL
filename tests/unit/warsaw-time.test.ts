import { describe, expect, it } from 'vitest';
import { toWarsawMoment } from '@/lib/opening-hours/warsaw-time';

describe('toWarsawMoment', () => {
  it('reads the Warsaw-local weekday and time, winter (CET, UTC+1)', () => {
    // 2026-01-05 is a Monday. 10:30 UTC is 11:30 CET.
    const moment = toWarsawMoment(new Date('2026-01-05T10:30:00Z'));

    expect(moment.weekday).toBe(0); // Monday
    expect(moment.minutesSinceMidnight).toBe(11 * 60 + 30);
  });

  it('reads the Warsaw-local weekday and time, summer (CEST, UTC+2)', () => {
    // 2026-07-05 is a Sunday. 22:15 UTC is 00:15 CEST the next day (Monday).
    const moment = toWarsawMoment(new Date('2026-07-05T22:15:00Z'));

    expect(moment.weekday).toBe(0); // Monday, after the CEST rollover
    expect(moment.minutesSinceMidnight).toBe(15);
  });

  it('reports midnight as 00:00, not 24:00', () => {
    // 2026-01-05T23:00Z is 2026-01-06T00:00 CET exactly.
    const moment = toWarsawMoment(new Date('2026-01-05T23:00:00Z'));

    expect(moment.minutesSinceMidnight).toBe(0);
    expect(moment.weekday).toBe(1); // Tuesday
  });
});

import { describe, expect, it } from 'vitest';
import {
  approxWalkingMinutes,
  CONSERVATIVE_WALKING_METERS_PER_MINUTE,
} from '@/lib/toilets/walking-time';

describe('approxWalkingMinutes', () => {
  it('derives minutes from the stated conservative pace', () => {
    expect(approxWalkingMinutes(CONSERVATIVE_WALKING_METERS_PER_MINUTE)).toBe(1);
    expect(approxWalkingMinutes(CONSERVATIVE_WALKING_METERS_PER_MINUTE * 10)).toBe(10);
  });

  it('rounds up rather than down, so the app never under-promises', () => {
    // One metre over an exact minute must still read as the next minute.
    expect(approxWalkingMinutes(CONSERVATIVE_WALKING_METERS_PER_MINUTE + 1)).toBe(2);
  });

  it('never returns zero, even for a distance of zero', () => {
    expect(approxWalkingMinutes(0)).toBe(1);
  });
});

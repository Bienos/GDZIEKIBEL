import { describe, expect, it } from 'vitest';
import { buildMarkerLabel } from '@/lib/toilets/marker-label';

describe('buildMarkerLabel', () => {
  it('combines the name and a rounded distance', () => {
    expect(buildMarkerLabel({ name: 'Toaleta', distanceMeters: 239.6 })).toBe('Toaleta, 240 m');
  });

  it('rounds down as well as up, to the nearest metre', () => {
    expect(buildMarkerLabel({ name: 'Toaleta', distanceMeters: 100.2 })).toBe('Toaleta, 100 m');
  });
});

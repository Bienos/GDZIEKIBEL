import { describe, expect, it } from 'vitest';
import { isWithinWarsawBbox, WARSAW_BBOX } from '@/lib/geo/warsaw';

describe('isWithinWarsawBbox', () => {
  it('accepts the city centre', () => {
    expect(isWithinWarsawBbox({ lat: 52.2297, lon: 21.0122 })).toBe(true);
  });

  it('accepts the edges', () => {
    expect(isWithinWarsawBbox({ lat: WARSAW_BBOX.south, lon: WARSAW_BBOX.west })).toBe(true);
    expect(isWithinWarsawBbox({ lat: WARSAW_BBOX.north, lon: WARSAW_BBOX.east })).toBe(true);
  });

  it('rejects Kraków, Berlin and the wrong hemisphere', () => {
    expect(isWithinWarsawBbox({ lat: 50.0647, lon: 19.945 })).toBe(false);
    expect(isWithinWarsawBbox({ lat: 52.52, lon: 13.405 })).toBe(false);
    expect(isWithinWarsawBbox({ lat: -52.2297, lon: 21.0122 })).toBe(false);
  });
});

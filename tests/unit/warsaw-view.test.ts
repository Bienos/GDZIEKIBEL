import { describe, expect, it } from 'vitest';
import { WARSAW_BBOX } from '@/lib/geo/warsaw';
import { WARSAW_CENTER, WARSAW_MAX_BOUNDS } from '@/lib/map/warsaw-view';

describe('Warsaw map view', () => {
  it('centres inside the coarse Warsaw box, not merely near it', () => {
    const center = WARSAW_CENTER as { lat: number; lng: number };

    expect(center.lat).toBeGreaterThan(WARSAW_BBOX.south);
    expect(center.lat).toBeLessThan(WARSAW_BBOX.north);
    expect(center.lng).toBeGreaterThan(WARSAW_BBOX.west);
    expect(center.lng).toBeLessThan(WARSAW_BBOX.east);
  });

  it('derives the max bounds from the same bounding box ingestion uses, not a second definition', () => {
    expect(WARSAW_MAX_BOUNDS).toEqual([
      WARSAW_BBOX.west,
      WARSAW_BBOX.south,
      WARSAW_BBOX.east,
      WARSAW_BBOX.north,
    ]);
  });
});

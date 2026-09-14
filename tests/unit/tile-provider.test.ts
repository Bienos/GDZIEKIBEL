import { describe, expect, it } from 'vitest';
import { MAP_STYLE_URL } from '@/lib/map/tile-provider';

describe('MAP_STYLE_URL', () => {
  it('points at OpenFreeMap, not a key-gated provider', () => {
    expect(MAP_STYLE_URL).toBe('https://tiles.openfreemap.org/styles/positron');
  });

  it('is a plain https URL with no key/token query parameter', () => {
    const url = new URL(MAP_STYLE_URL);
    expect(url.protocol).toBe('https:');
    expect([...url.searchParams.keys()]).toEqual([]);
  });
});
